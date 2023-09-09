import {
    Action,
    apply,
    BatchAction,
    extractPaths,
    isPathPrefix,
    selectUniquePathPrefixes,
    selectUniquePaths,
    StateChange,
    StateRecord,
    StateValue
} from './Utils';
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
    /** If true, the subject will compute and emit old value and affected subpaths. */
    isAllDetailsMode = false;
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


    constructor(private rootState: RootStateType) {
    }

    /**
     * Returns current store state for the root path.
     * Note: it is unsafe to modify the returned state because the store and observers
     * will not be aware of the modifications and this can lead to undefined behavior.
     */
    get state(): RootStateType {
        return this.rootState;
    }

    get state$(): Observable<RootStateType> {
        return this.observe([]);
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
        return this._observeChanges<T>(path, pathsToExclude, 'new-value-only').pipe(map(v => v.value));
    }

    /** Creates an observable to monitor changes on the specified path and all subpaths. */
    observeChanges<T extends StateValue>(path: string[], pathsToExclude: Array<string[]> = []): Observable<StateChange<T>> {
        return this._observeChanges<T>(path, pathsToExclude, 'all-details');
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
                                           compareFn?: ((oldValue: T | undefined, newValue: T, path: string[]) => boolean)
    ): void {
        if (!compareFn?.(this.get(path), value, path)) {
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
        // Notify subscribers about the update. The 'updateTrie' contains boolean flags for nodes to notify.
        const uniquePathsInActions = extractPaths(action, 'unique-and-sorted');
        const childPathsWithObservers = this.selectChildPathsWithObservers(uniquePathsInActions);
        const pathsToNotify = selectUniquePaths([...uniquePathsInActions, ...childPathsWithObservers]);
        const updateTrie = new Trie<string, boolean>();
        for (const path of pathsToNotify) {
            updateTrie.fillPath(path, () => true);
        }
        updateTrie.visitDfs('pre-order', (_, path) => {
            const subject = this.observersTrie.get(path);
            if (subject) {
                const value = this.get(path);
                const oldValue = subject.isAllDetailsMode ? this._get(this.rootStateBeforeBatchStart, path) : undefined;
                subject.next({action, value, oldValue});
            }
        });
    }

    private stubForUnusedPaths: Array<string[]> = [];

    /** Creates an observable to monitor changes on the specified path and all sub-paths. */
    private _observeChanges<T extends StateValue>(path: string[],
                                                  pathsToExclude: Array<string[]> = [],
                                                  changeDetailsFlag: 'all-details' | 'new-value-only'
    ): Observable<StateChange<T>> {
        const excludeTrie = pathsToExclude.length === 0 ? undefined : new Trie<string, boolean>();
        for (const pathToExclude of pathsToExclude) {
            excludeTrie?.set(pathToExclude, true);
        }
        return new Observable<StateChange<T>>((observer: Observer<StateChange<T>>): TeardownLogic => {
            const subject = this.observersTrie.getOrSet(path, () => new ObserversTrieSubject<StateValue>());
            subject.isAllDetailsMode = subject.isAllDetailsMode || changeDetailsFlag === 'all-details';
            const initialChange: StateChange<T> = {oldValue: undefined, value: this.get(path) as T, paths: [[]]};
            observer.next(initialChange);
            const subscription = subject.pipe(
                // Remove `pathsToExclude`.
                filter(({action}) => excludeTrie === undefined || extractPaths(action, 'as-is').some(path => !excludeTrie.get(path))),
                // Extract `StateChange` from `ObserversTrieSubjectData` observable and send it to the observer.
                map(({action, value, oldValue}) => {
                    let paths = this.stubForUnusedPaths;
                    if (subject.isAllDetailsMode) {
                        const fullPaths = extractPaths(action, 'as-is');
                        const subPaths = path.length > 0
                            ? fullPaths.filter(fullPath => isPathPrefix(fullPath, path))
                                .map(fullPath => fullPath.slice(path.length))
                            : fullPaths;
                        paths = selectUniquePathPrefixes(subPaths);
                    }
                    return {value, oldValue, paths} as StateChange<T>;
                })
            ).subscribe(observer);

            // Return a function `()=>void` of a type RxJS.TeardownLogic.
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

    private selectChildPathsWithObservers(parentPaths: Array<string[]>): Array<string[]> {
        const childPaths: Array<string[]> = [];
        for (const path of parentPaths) {
            if ((this.observersTrie.getNode(path)?.childrenWithValue || 0) > 0) {
                this.observersTrie.visitDfs('pre-order', (trieSubject, childPath) => {
                    if (trieSubject) {
                        childPaths.push([...childPath]);
                    }
                }, path);
            }
        }
        return childPaths;
    }
}

