import {beforeEach, describe, expect, it} from '@jest/globals';
import {TrieStore} from '../src/TrieStore';
import {firstValueFrom} from 'rxjs';
import {StateRecord} from '../src/Utils';

describe('TrieStore', () => {

    let store: TrieStore = new TrieStore({});

    // Observed events for the following topology: { a1:{b1:1}, a2:{b2:2} } (graphRootState).
    let observedRootEvents: Array<unknown> = [];
    let observedNodeA1Events: Array<unknown> = [];
    let observedNodeA2Events: Array<unknown> = [];
    let observedNodeB1Events: Array<unknown> = [];
    let observedNodeB2Events: Array<unknown> = [];
    let graphRootState: StateRecord = {};

    beforeEach(() => {
        observedRootEvents = [];
        observedNodeA1Events = [];
        observedNodeA2Events = [];
        observedNodeB1Events = [];
        observedNodeB2Events = [];
        graphRootState = {a1: {b1: 1}, a2: {b2: 2}};
        store = new TrieStore({});
        store.observe([]).subscribe(e => observedRootEvents.push(e));
        store.observe(['a1']).subscribe(e => observedNodeA1Events.push(e));
        store.observe(['a2']).subscribe(e => observedNodeA2Events.push(e));
        store.observe(['a1', 'b1']).subscribe(e => observedNodeB1Events.push(e));
        store.observe(['a2', 'b2']).subscribe(e => observedNodeB2Events.push(e));
    });

    describe('constructor', () => {
        it('store can be created with an empty state and the store emits it', async () => {
            const observer = store.observe([]);
            expect(store.state).toEqual({});
            expect(await firstValueFrom(observer)).toBe(store.state);
        });

        it('store can be created with a custom state and the store emits it', async () => {
            const initialState = {a: 1};
            const newStore = new TrieStore(initialState);
            const observer = newStore.observe([]);
            expect(newStore.state).toBe(initialState);
            expect(newStore.state).toEqual({a: 1});
            expect(await firstValueFrom(observer)).toBe(newStore.state);
        });
    });

    describe('state', () => {
        it('is empty for a new store with an empty state', () => {
            const state = {};
            expect(new TrieStore(state).state).toBe(state);
        });

        it('is referentially equal to the provided state', () => {
            const state = {a: 1, b: 2};
            expect(new TrieStore(state).state).toBe(state);
            expect(state).toEqual({a: 1, b: 2});
        });

        it('is the current value after updates', () => {
            store.set(['a'], 1);
            expect(store.state).toEqual({a: 1});
        });
    });

    describe('get', () => {
        it('returns top-level state for an empty path', () => {
            expect(store.get([])).toBe(store.state);
            store.set(['a'], 1);
            expect(store.get([])).toBe(store.state);
        });

        it('returns undefined for unknown paths', () => {
            expect(store.get(['1'])).toBe(undefined);
        });

        it('returns an expected value', () => {
            const path = ['1', '2', '3'];
            store.set(path, 1);
            expect(store.get(path)).toBe(1);
        });

        it('returns an sub-state for path prefix value', () => {
            store.set(['1', '2', '3'], 1);
            expect(store.get(['1', '2'])).toEqual({'3': 1});
        });

        it('returns array elements', () => {
            store.set(['1', '2'], [3, 4]);
            expect(store.get(['1', '2'])).toEqual([3, 4]);
            expect(store.get(['1', '2', '1'])).toEqual(4);
        });

        it('sees through arrays', () => {
            store.set(['1', '2'], [{'3': 4}]);
            expect(store.get(['1', '2', '0', '3'])).toEqual(4);
        });

        it('returns undefined for missed array elements', () => {
            store.set(['1', '2'], [1]);
            expect(store.get(['1', '2', '1'])).toBe(undefined);
        });

        it('returns undefined for negative array elements', () => {
            store.set(['1', '2'], [1]);
            expect(store.get(['1', '2', '-1'])).toBe(undefined);
        });

        it('supports empty strings as keys', () => {
            store.set(['1', ''], 3);
            expect(store.get(['1', ''])).toBe(3);
        });
    });

    describe('set', () => {
        it('can set root state', () => {
            const newState = {a: 1};
            store.set([], newState);
            expect(store.state).toBe(newState);
            expect(newState).toEqual({a: 1});
        });

        it('root state must be a record', () => {
            expect(() => store.set([], true)).toThrow('must be a record');
            expect(() => store.set([], 1)).toThrow('must be a record');
            expect(() => store.set([], null)).toThrow('must be a record');
            expect(() => store.set([], () => {})).toThrow('must be a record');
            expect(() => store.set([], BigInt(10))).toThrow('must be a record');
            expect(() => store.set([], NaN)).toThrow('must be a record');
            expect(() => store.set([], Infinity)).toThrow('must be a record');
            expect(() => store.set([], [])).toThrow('must be a record');

            expect(() => store.set([], undefined)).toThrow('delete an empty path');
        });

        it('can set a top-level property', () => {
            store.set(['a'], 1);
            expect(store.get(['a'])).toBe(1);
            expect(store.state).toEqual({a: 1});
        });

        it('can set a multi-level property', () => {
            store.set(['a', 'b'], 2);
            expect(store.get(['a', 'b'])).toBe(2);
            expect(store.get(['a'])).toEqual({b: 2});
            expect(store.state).toEqual({a: {b: 2}});
        });

        it('can set use empty string as a path token', () => {
            store.set([''], 1);
            expect(store.get([''])).toBe(1);
        });

        it('set of undefined is a no-op', async () => {
            const globalStateBefore = store.state;
            const observer = store.observe(['a']);
            store.set(['a'], undefined);
            expect(store.state).toBe(globalStateBefore);
            expect(store.state).toEqual({});
            expect(await firstValueFrom(observer)).toBe(undefined);
        });

        it('can set object', () => {
            const o = {b: {c: 3}};
            store.set(['a'], o);
            expect(store.get(['a'])).toBe(o);
            expect(o).toEqual({b: {c: 3}});
        });

        it('can set string', () => {
            store.set(['a'], 'b');
            expect(store.get(['a'])).toBe('b');
        });

        it('can set number', () => {
            store.set(['a'], 1);
            expect(store.get(['a'])).toBe(1);
        });

        it('can set boolean', () => {
            store.set(['a'], true);
            expect(store.get(['a'])).toBe(true);
        });

        it('can set null', () => {
            store.set(['a'], null);
            expect(store.get(['a'])).toBe(null);
        });

        it('can set bigint', () => {
            store.set(['a'], BigInt('100000000000000000000'));
            expect(store.get(['a'])).toBe(BigInt('100000000000000000000'));
        });

        it('can set function', () => {
            const f = (): void => {};
            store.set(['a'], f);
            expect(store.get(['a'])).toBe(f);
        });

        it('can set array', () => {
            const a = [1, 2, 3];
            store.set(['a'], a);
            expect(store.get(['a'])).toBe(a);
            expect(a).toEqual([1, 2, 3]);
        });

        it('replaces old path', () => {
            store.set(['a', 'b1'], {c1: 1});
            store.set(['a'], {b2: {c2: 2}});
            expect(store.state).toEqual({a: {b2: {c2: 2}}});
        });

        it('builds new path', () => {
            store.set(['a', 'b1'], {c1: 1});
            store.set(['a', 'b2'], {c2: 2});
            expect(store.state).toEqual({a: {b1: {c1: 1}, b2: {c2: 2}}});
        });

        it('default compareFn uses referential equality', () => {
            const state0 = store.state;
            expect(observedRootEvents.length).toBe(1);
            expect(observedRootEvents).toEqual([{}]);

            store.set(['a'], 1);
            expect(observedRootEvents.length).toBe(2);
            expect(observedRootEvents).toEqual([{}, {a: 1}]);
            const state1 = store.state;
            expect(state1).not.toBe(state0);

            store.set(['a'], 1);
            expect(observedRootEvents.length).toBe(2);
            expect(observedRootEvents).toEqual([{}, {a: 1}]);
            expect(state1).toBe(store.state);

            store.set(['a'], '1');
            expect(observedRootEvents.length).toBe(3);
            expect(observedRootEvents).toEqual([{}, {a: 1}, {a: '1'}]);
            const state2 = store.state;
            expect(state2).not.toBe(state1);
        });

        it('supports non default compareFn', () => {
            const state0 = store.state;

            store.set(['a'], 1, () => true);
            expect(observedRootEvents.length).toBe(1);
            expect(observedRootEvents).toEqual([{}]);

            store.set(['a'], 1);
            expect(observedRootEvents.length).toBe(2);
            expect(observedRootEvents).toEqual([{}, {a: 1}]);
            const state1 = store.state;
            expect(state1).not.toBe(state0);

            store.set(['a'], 2, () => true);
            expect(observedRootEvents.length).toBe(2);
            expect(observedRootEvents).toEqual([{}, {a: 1}]);
            expect(state1).toBe(store.state);
        });

        it('non default compareFn does affect referential equality', () => {
            store.set(['a'], 1);
            expect(observedRootEvents.length).toBe(2);
            expect(observedRootEvents).toEqual([{}, {a: 1}]);

            store.set(['a'], 1, () => false);
            expect(observedRootEvents.length).toBe(2);
            expect(observedRootEvents).toEqual([{}, {a: 1}]);
        });

        it('compareFn gets correct arguments', () => {
            let cachedOldValue: unknown | undefined;
            let cachedNewValue: unknown | undefined;
            let cachedPath: string[] | undefined;
            const compareFn = (oldValue: unknown, newValue: unknown, path: string[]): boolean => {
                cachedOldValue = oldValue;
                cachedNewValue = newValue;
                cachedPath = path;
                return false;
            };
            const value11 = {a: 1};
            const path1: string[] = [];
            store.set(path1, value11, compareFn);
            expect(cachedOldValue).toEqual({});
            expect(cachedNewValue).toBe(value11);
            expect(cachedPath).toBe(path1);

            const value12 = {a: 2};
            store.set(path1, value12, compareFn);
            expect(cachedOldValue).toBe(value11);
            expect(cachedNewValue).toBe(value12);
            expect(cachedPath).toBe(path1);

            const value21 = 3;
            const path2: string[] = ['a'];
            store.set(path2, value21, compareFn);
            expect(cachedOldValue).toBe(2);
            expect(cachedNewValue).toBe(value21);
            expect(cachedPath).toBe(path2);

            const value22 = 4;
            store.set(path2, value22, compareFn);
            expect(cachedOldValue).toBe(value21);
            expect(cachedNewValue).toEqual(value22);
            expect(cachedPath).toBe(path2);
        });
    });

    describe('delete', () => {
        it('does not allow delete empty path', () => {
            expect(() => store.delete([])).toThrow('empty path');
        });

        it('no-op on empty key deletion', () => {
            store.set(['a'], {});
            store.delete(['a', 'b']);
            store.delete(['c']);
            expect(store.state).toEqual({a: {}});
        });

        it('does not allow deletion from non-record types', () => {
            store.set(['a'], 1);
            expect(() => store.delete(['a', 'b'])).toThrow(`Path: 'a', type: number`);

            store.set(['a'], []);
            store.delete(['a', 'b']);
            expect(store.state).toEqual({a: []});

            store.set(['a'], true);
            expect(() => store.delete(['a', 'b'])).toThrow(`Path: 'a', type: boolean`);

            store.set(['a'], null);
            expect(() => store.delete(['a', 'b'])).toThrow(`Path: 'a', type: <null>`);

            store.set(['a'], '');
            expect(() => store.delete(['a', 'b'])).toThrow(`Path: 'a', type: string`);

            store.set(['a'], BigInt(0));
            expect(() => store.delete(['a', 'b'])).toThrow(`Path: 'a', type: bigint`);
        });

        it('deletes leaf keys', () => {
            store.set(['a'], {});
            store.set(['a', 'b'], 2);
            store.delete(['a', 'b']);
            expect(store.state).toEqual({a: {}});
        });

        it('deletes middle keys', () => {
            store.set(['a'], {});
            store.set(['a', 'b'], {});
            store.set(['a', 'b', 'c'], 3);
            store.delete(['a', 'b']);
            expect(store.state).toEqual({a: {}});
        });

        it('deletes top keys', () => {
            store.set(['a'], {});
            store.set(['a', 'b'], {});
            store.delete(['a']);
            expect(store.state).toEqual({});
        });

        it('throws on array item deletion', () => {
            store.set(['a'], [0]);
            expect(() => store.delete(['a', '0'])).toThrow('array');
        });

        it('does not emit on no-op', () => {
            store.set(['a'], {});
            store.set(['a', 'b'], {});
            const eventCountBefore = observedRootEvents.length;
            store.delete(['a', 'b', 'c']);
            expect(observedRootEvents.length).toEqual(eventCountBefore);
        });

        it('emits when deleted', () => {
            store.set([], graphRootState);
            const rootEventCountOnStart = observedRootEvents.length;
            const a1EventCountOnStart = observedNodeA1Events.length;
            const b1EventCountOnStart = observedNodeB1Events.length;
            const a2EventCountOnStart = observedNodeA1Events.length;

            store.delete(['a1', 'b1']);

            expect(observedRootEvents.length).toBe(rootEventCountOnStart + 1);
            expect(observedNodeA1Events.length).toBe(a1EventCountOnStart + 1);
            expect(observedNodeB1Events.length).toBe(b1EventCountOnStart + 1);
            expect(observedNodeA2Events.length).toBe(a2EventCountOnStart);

            expect(observedRootEvents.at(-1)).toEqual({a1: {}, a2: {b2: 2}});
            expect(observedNodeA1Events.at(-1)).toEqual({});
            expect(observedNodeB1Events.at(-1)).toBe(undefined);

            store.set(['a1', 'b1'], 3);
            expect(observedNodeB1Events.length).toBe(b1EventCountOnStart + 2);
            expect(observedNodeB1Events.at(-1)).toBe(3);
        });
    });

    describe('runInBatch', () => {
        it('emits once after batch ends', () => {
            expect(observedRootEvents.length).toBe(1);
            store.runInBatch(() => {
                store.set(['a'], 1);
                expect(store.get(['a'])).toBe(1);
                expect(observedRootEvents.length).toBe(1); // Not emitted.
                store.set(['a'], 2);
                expect(observedRootEvents.length).toBe(1); // Not emitted.
                store.set(['b'], 3);
                expect(observedRootEvents.length).toBe(1); // Not emitted.
            });
            expect(observedRootEvents.length).toBe(2);
            expect(observedRootEvents).toEqual([{}, {a: 2, b: 3}]);
        });
    });
});
