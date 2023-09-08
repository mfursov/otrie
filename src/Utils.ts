import {assertTruthy} from 'assertic';

export type StateValue =
    string
    | boolean
    | number
    | null
    | undefined
    | object
    | Array<StateValue>
    | StateRecord
    | bigint;

export type StateRecord = { [key: string]: StateValue };

export type Action = SetAction | DeleteAction | BatchAction;

/** Details about a single or a batch change. */
export interface StateChange<T extends StateValue = StateValue> {
    /** A node value before the change. */
    oldValue: T | undefined,
    /** A node value after the change. */
    value: T,
    /**
     * All changed paths relative to the observed node (starting from the observed node path).
     * The order of the paths may not correlate with the order of the applied changes.
     *
     * It can be a single path for an atomic change or a set of paths for a batch.
     * If multiple paths are present only non-overlapping paths are reported
     * and for 2 overlapping paths the shorter one is reported.
     * An empty array of paths will be returned if the node value is changed because its parent was overwritten
     * and the node value is undefined now.
     *
     * Examples:
     * For two changes in the batch ["a", "b", "c"] and ["a", "b"] only one shorter path will be reported: [["a", "b"]].
     * For the state `{a: {b: {c: 1}}}` after `set(['a', 'b', 'c'], 2)` operation the following paths will be reported:
     *  - For an observer at path ['a', 'b', 'c'] => [[]].
     *  - For an observer at path ['a', 'b'] => [['c']].
     *  - For an observer at path [] => [['b', 'c']].
     *  - For an observer at path [] => [['a', 'b', 'c']].
     *  For the state `{a: {b: {c: 1}}}` after `set(['a', 'b'], {})` operation the following paths will be reported:
     *   - For an observer at path ['a', 'b', 'c'] => []. (no paths -> parent was modified, not node 'c').
     *   - For an observer at path ['a', 'b'] => [[]].
     *   - For an observer at path [] => ['b'].
     *   - For an observer at path [] => ['a', 'b'].
     */
    paths: Array<string[]>;
}

export interface SetAction {
    type: 'set';
    path: string[];
    value: StateValue;
}

export interface DeleteAction {
    type: 'delete';
    path: string[];
}

export interface BatchAction {
    type: 'batch';
    actions: Array<Action>;
}

export function apply(state: StateRecord, action: Action): StateRecord {
    switch (action.type) {
        case 'set':
            return setInPath(state, action.path, action.value);
        case 'delete':
            return deleteInPath(state, action.path);
        case 'batch':
            return action.actions.reduce((result, actionInBatch) => apply(result, actionInBatch), state);
    }
}

/**
 * Sets a new state to the path.
 * Allows to re-set a root path, but requires the new root state to be a record.
 * Never modifies existing state: optimally deep-clones the existing state on the modified path and returns a new cloned state.
 * Returns the original state if there are no changes as the result of the call or if the root path was reset.
 * Setting an undefined value is equal to a call of `deleteInPath`.
 */
export function setInPath(state: StateRecord, path: ReadonlyArray<string>, newValue: StateValue): StateRecord {
    if (newValue === undefined) {
        return deleteInPath(state, path);
    }
    if (path.length === 0) {
        assertTruthy(typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue),
            () => `Root state must be a record. Trying to set '${newValue}', type: ${typeof newValue}`);
        return newValue as StateRecord;
    }

    function isValidArrayIndex(key: string): boolean {
        const index = Number(key);
        return !isNaN(index) && index >= 0 && index !== Infinity;
    }

    let subState: StateRecord | undefined = state;
    for (let i = 0; i < path.length - 1 && subState !== undefined; i++) {
        const key = path[i];
        assertTruthy(!Array.isArray(subState) || isValidArrayIndex(key),
            () => `Invalid array index. Path: '${path.slice(0, i + 1)}', index: '${key}'`);
        subState = subState[key] as StateRecord | undefined;
        assertTruthy(subState === undefined || (typeof subState === 'object' && subState !== null),
            () => `Cannot set a property to a non-record parent. Path: '${path.slice(0, i + 1)}', type: '${subState === null ? '<null>' : typeof subState}'`);
    }
    const leafKey = path[path.length - 1];
    assertTruthy(!Array.isArray(subState) || isValidArrayIndex(leafKey), () => `Invalid array index Path: '${path}`);
    return subState?.[leafKey] === newValue
        ? state
        : deepCloneOnPath(state, path, newValue);
}

/**
 * Deletes a value in the path.
 * Returns a new changed state.
 * If there is no value to delete, does nothing and returns the original state.
 * The method will throw an error
 */
export function deleteInPath(state: StateRecord, path: ReadonlyArray<string>): StateRecord {
    assertTruthy(path.length !== 0, `Can't delete an empty path`);
    let subState: StateRecord | undefined = state;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        subState = subState[key] as StateRecord | undefined;
        if (subState === undefined) {
            return state; // Nothing to delete.
        }
        assertTruthy(typeof subState === 'object' && subState !== null,
            () => `Cannot delete a property from a non-record parent. Path: '${path.slice(0, i + 1)}', type: ${subState === null ? '<null>' : typeof subState}`);
    }
    const leafKey = path[path.length - 1];
    return subState[leafKey] === undefined ? state : deepCloneOnPath(state, path, undefined);
}

/**
 * Clones `state` and patches the record in the cloned state specified by the `path` with `patchValue` .
 * The result is always a cloned object.
 */
export function deepCloneOnPath(originalState: Readonly<StateRecord>,
                                path: ReadonlyArray<string>,
                                patchValue: StateValue | undefined): StateRecord {
    function deleteKey(stateRecord: StateRecord, key: string): void {
        assertTruthy(!Array.isArray(stateRecord), () => `Can't delete element of array. Path: '${path}'`);
        delete stateRecord[key];
    }

    const result = {...originalState};
    let clonedState = result;
    for (let i = 0; i < path.length - 1; i++) { // Clone objects on the path except the last node in the path.
        const key = path[i];
        const sharedSubState = clonedState[key];
        assertTruthy(sharedSubState === undefined || (typeof sharedSubState === 'object' && sharedSubState !== null),
            () => `Internal error: sub-path has an invalid type and can't be patched: '${path.slice(0, i + 1)}', type: '${sharedSubState === null ? null : typeof sharedSubState}'`);
        const clonedSubState = sharedSubState === undefined
            ? (patchValue === undefined ? undefined : {})
            : (Array.isArray(sharedSubState) ? [...sharedSubState] : {...sharedSubState});
        if (clonedSubState === undefined) {
            deleteKey(clonedState, key);
            return clonedState;
        }
        clonedState[key] = clonedSubState;
        clonedState = clonedSubState as StateRecord;
    }
    const leafKey = path[path.length - 1];
    if (patchValue === undefined) {
        deleteKey(clonedState, leafKey);
    } else {
        clonedState[leafKey] = patchValue;
    }
    return result;
}

/**
 * Extracts all paths from actions into a single array of paths.
 * Returns a sorted array of unique actions if `mode` is `unique-and-sorted`
 * or all paths in the original order if `mode` is `as-is`.
 */
export function extractPaths(action: Action, mode: 'unique-and-sorted' | 'as-is'): Array<string[]> {
    const result: Array<string[]> = [];
    if (action.type === 'set' || action.type === 'delete') {
        result.push(action.path);
    } else if (action.type === 'batch') {
        for (const nestedAction of action.actions) {
            result.push(...extractPaths(nestedAction, 'as-is'));
        }
    }
    return mode === 'unique-and-sorted' ? selectUniquePaths(result) : result;
}

/** Returns true if `path` has a prefix equal to `prefixPath` or is equal to `prefixPath`. */
export function isPathPrefix(path: string[], prefixPath: string[]): boolean {
    if (path.length < prefixPath.length) {
        return false;
    }
    for (let i = 0; i < prefixPath.length; i++) {
        if (path[i] !== prefixPath[i]) {
            return false;
        }
    }
    return true;
}

/** Sorts paths by string value and next by length. */
export function sortPaths(paths: Array<string[]>): Array<string[]> {
    const sortedPaths = [...paths];
    sortedPaths.sort((p1, p2) => {
        for (let i = 0; i < p1.length; i++) {
            if (i === p2.length) {
                return 1; // p1 and p2 have equal prefixes but p2 is shorter and must go first.
            }
            const delta = p1[i].localeCompare(p2[i]);
            if (delta !== 0) {
                return delta;
            }
        }
        return p1.length - p2.length; // Paths are either equal or p1 goes first (result is <= -1).
    });
    return sortedPaths;
}

/**
 * Remove child subpaths from the list of paths.
 * Keeps only short parent paths.
 */
export function selectUniquePathPrefixes(paths: Array<string[]>): Array<string[]> {
    if (paths.length === 1) {
        return [...paths];
    }
    if (paths.some(p => p.length === 0)) { // Simple case: there is a root path in the list.
        return [[]];
    }
    const sortedPaths = sortPaths(paths);
    // Now remove duplicated paths and child paths.
    const filteredSubPaths: Array<string[] | undefined> = sortedPaths;
    for (let i = 0; i < filteredSubPaths.length - 1; i++) {
        const shortParentPath = sortedPaths[i];
        for (let j = i + 1; j < sortedPaths.length; j++) {
            const longChildPath = sortedPaths[j];
            if (isPathPrefix(longChildPath, shortParentPath)) {
                filteredSubPaths[j] = undefined;
                i++;
            }
        }
    }
    return filteredSubPaths.filter(p => p !== undefined) as Array<string[]>;
}

/**
 * Selects unique paths from the given path array.
 * The returned array contains sorted paths.
 */
export function selectUniquePaths(paths: Array<string[]>): Array<string[]> {
    const sortedPaths = sortPaths(paths);
    const uniquePaths: Array<string[] | undefined> = sortedPaths;
    for (let i = 0; i < sortedPaths.length - 1; i++) {
        const pi = sortedPaths[i];
        for (let j = i + 1; j < sortedPaths.length; j++) {
            const pj = sortedPaths[j];
            if (pi.length === pj.length && isPathPrefix(pi, pj)) {
                uniquePaths[j] = undefined;
                i++;
            }
        }
    }
    return uniquePaths.filter(p => p !== undefined) as Array<string[]>;
}
