import {assertTruthy} from 'assertic';

export type StateValue = string | boolean | number | null | undefined | object | Array<StateValue> | StateRecord | bigint;

export type StateRecord = { [key: string]: StateValue };

export type Action = SetAction | DeleteAction | BatchAction;

export interface StateChange<T extends StateValue = StateValue> {
    oldValue: T | undefined,
    value: T,
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
            () => `Invalid array index Path: '${path.slice(0, i + 1)}', index: '${key}'`);
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
            () => `Cannot delete a property from a non-record parent. Path: '${path.slice(0, i)}', type: ${subState === null ? '<null>' : typeof subState}`);
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
