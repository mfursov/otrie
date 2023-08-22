import {Action, apply, BatchAction, StateChange, StateRecord, StateValue} from './Utils';
import {Observable, Observer, Subject, TeardownLogic} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {Trie} from 'ptrie';

/** Data type for `ObserversTrieSubject`. */
interface ObserversTrieSubjectData<T extends StateValue = StateValue> {
    action: Action,
    value: T,
    oldValue: T | undefined;
}

/** Subject stored in every trie node with at least one active observer. */
class ObserversTrieSubject<T extends StateValue = StateValue> extends Subject<ObserversTrieSubjectData<T>> {
    /** If true, the subject will compute and emit old value. */
    isOldValueNeeded = false;
}

/**
 * Rxjs-observable Path Trie Store.
 * Keeps an instance of Rxjs Subject associated with every monitored field of State
 * and notifies observers on changes.
 */
export class TrieStore<RootStateType extends StateRecord = StateRecord> {
    /** Trie of observers. */
    private readonly observersTrie = new Trie<string, ObserversTrieSubject>();

    /**
     * Current depth of active batch operations.
     * Changes are delivered only after all operations within a batch are completed.
     */
    private batchDepth = 0;

    /**
     * Current batch actions in-flight.
     * The actions will be dispatched when the last top-level batch completes.
     */
    private appliedBatchActions: Array<Action> = [];

    private rootStateBeforeBatchStart = this.rootState;


    constructor(
        /** Initial state of the store. */
        private rootState: RootStateType,
    ) {
    }

    /**
     * Returns current store state for the root path.
     * Note: it is unsafe to modify the returned state because the store and observers
     * will not be aware of the modifications and this can lead to undefined behavior.
     */
    get state(): RootStateType {
        return this.rootState;
    }

    /**
     * Returns a state value stored in the path.
     * If there is no value associated with the path returns `undefined`.
     */
    get<T extends StateValue = StateValue>(path: ReadonlyArray<string>): T | undefined {
        return this._get<T>(this.rootState, path);
    }

    /** Creates an observable to monitor current value on the specified path and all subpaths. */
    observe<T extends StateValue>(path: string[], pathsToExclude: Array<string[]> = []): Observable<T> {
        return this._observeChanges<T>(path, pathsToExclude, 'without-old-value').pipe(map(v => v.value));
    }

    /** Creates an observable to monitor changes on the specified path and all subpaths. */
    observeChanges<T extends StateValue>(path: string[], pathsToExclude: Array<string[]> = []): Observable<StateChange<T>> {
        return this._observeChanges<T>(path, pathsToExclude, 'with-old-value');
    }

    /**
     * Sets a new state to the path.
     * If the state contains a referentially equal value at the path does nothing.
     *
     * The `compareFn` compares an old and new values before the action:
     * if the values are equal (`true` is returned), the operation makes no changes to the state.
     *
     * As a result of this operation, the store state is affected immediately.
     * If there is no active batch operation, the observers receive a notification immediately.
     * Otherwise, a notification will be sent after the top-level batch function completes.
     */
    set<T extends StateValue = StateValue>(path: string[],
                                           value: T,
                                           compareFn?: ((oldValue: T | undefined, newValue: T) => boolean)
    ): void {
        if (!compareFn?.(this.get(path), value)) {
            this._apply({type: 'set', path, value: value});
        }
    }

    /**
     * Deletes a value in `path`. The path must be non-empty.
     * Results to no-op if there is no value stored under `path` .
     *
     * As a result of this operation, the store state is affected immediately.
     * If there is no active batch operation, the observers receive a notification immediately.
     * Otherwise, a notification will be sent after the top-level batch function completes.
     */
    delete(path: string[]): void {
        this._apply({type: 'delete', path});
    }

    /**
     * Completes and removes all subscriptions and resets the store state.
     * No update is sent to any observers as the result of this operation: all subscriptions are completed before the cleanup.
     */
    reset(newState: RootStateType): void {
        this.observersTrie.visitDfs('pre-order', subject => subject?.complete());
        this.observersTrie.delete([]);
        this.rootState = newState;
    }

    /**
     * Runs a `batchFn` code within a batch.
     *
     * All changes done to store inside `batchFn` state are applied immediately,
     * but will be delivered to observers only after `batchFn` is finished.
     *
     * The store state and notifications do not depend on `batchFn` result:
     * the changes are made, and notifications are sent even if the `batchFn` completes with an Error.
     */
    runInBatch(batchFn: () => unknown): void {
        this.batchDepth++;
        try {
            batchFn();
        } finally {
            this.batchDepth--;
            if (this.batchDepth === 0 && this.appliedBatchActions.length > 0) {
                const batchAction: BatchAction = {type: 'batch', actions: this.appliedBatchActions};
                this.appliedBatchActions = [];
                this._notify(batchAction);
            }
        }
    }

    /**
     * Applies changes to the store state immediately, but delays observer
     * notification until all active batch operations are completed.
     */
    private _apply(action: Action): void {
        if (this.batchDepth === 0) {
            this.rootStateBeforeBatchStart = this.rootState;
        }
        this.rootState = apply(this.rootState, action) as RootStateType;
        if (this.rootState === this.rootStateBeforeBatchStart || this.observersTrie.isEmpty) {
            return; // Nothing is changed.
        }
        if (this.batchDepth > 0) {
            this.appliedBatchActions.push(action);
            return;
        }
        this._notify(action);
    }

    /** Notifies all pending observers selected by the action path. */
    private _notify(action: Action): void {
        // Notify subscribers about the update.
        const flagTrie = new Trie<string, boolean>();
        const allPaths = extractPaths(action);
        allPaths.sort((p1, p2) => p2.length - p1.length); // Sort 'allPaths' so the longest paths come first. It makes fillPath more optimal.
        for (const path of allPaths) {
            flagTrie.fillPath(path, currentValue => currentValue ? Trie.StopFillToken : true);
        }
        flagTrie.visitDfs('pre-order', (_, path) => {
            const subject = this.observersTrie.get(path);
            if (subject) {
                const value = this.get(path);
                const oldValue = subject.isOldValueNeeded ? this._get(this.rootStateBeforeBatchStart, path) : undefined;
                subject.next({action, value, oldValue});
            }
        });
    }

    /** Creates an observable to monitor changes on the specified path and all subpaths. */
    private _observeChanges<T extends StateValue>(path: string[],
                                                  pathsToExclude: Array<string[]> = [],
                                                  oldValueFlag: 'with-old-value' | 'without-old-value'): Observable<StateChange<T>> {
        const excludeTrie = pathsToExclude.length === 0 ? undefined : new Trie<string, boolean>();
        for (const pathToExclude of pathsToExclude) {
            excludeTrie?.set(pathToExclude, true);
        }
        return new Observable<StateChange<T>>((observer: Observer<StateChange<T>>): TeardownLogic => {
            const subject = this.observersTrie.getOrSet(path, () => new ObserversTrieSubject<StateValue>());
            subject.isOldValueNeeded = subject.isOldValueNeeded || oldValueFlag === 'with-old-value';
            const initialChange: StateChange<T> = {oldValue: undefined, value: this.get(path) as T};
            observer.next(initialChange);
            const subscription = subject.pipe(
                // Remove `pathsToExclude`.
                filter(({action}) => excludeTrie === undefined || extractPaths(action).some(path => !excludeTrie.get(path))),
                // Extract `StateChange` from `ObserversTrieSubjectData` observable and send it to the observer.
                map(({value, oldValue}) => ({value, oldValue} as StateChange<T>))
            ).subscribe(observer);

            // Return a function `()=>void` of a type TeardownLogic.
            return (): void => {
                subscription.unsubscribe();
                // Remove 'ObserversTrieSubject' from trie when no observers left.
                if (!subject.observed) {
                    this.observersTrie.delete(path);
                }
            };
        });
    }

    /** Returns state value for the given root state and path. */
    private _get<T extends StateValue = StateValue>(customRootState: StateRecord, path: ReadonlyArray<string>): T | undefined {
        let result: StateRecord | undefined = customRootState;
        for (let i = 0; i < path.length && result !== undefined; i++) {
            const key = path[i];
            result = result?.[key] as StateRecord | undefined;
        }
        return result as T | undefined;
    }
}

/** Extracts all paths from actions into a single array of paths. */
export function extractPaths(action: Action): Array<string[]> {
    const result: Array<string[]> = [];
    if (action.type === 'set' || action.type === 'delete') {
        result.push(action.path);
    } else if (action.type === 'batch') {
        for (const batchAction of action.actions) {
            result.push(...extractPaths(batchAction));
        }
    }
    return result;
}
