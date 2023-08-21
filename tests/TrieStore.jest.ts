import {beforeEach, describe, expect, it} from '@jest/globals';
import {TrieStore} from '../src/TrieStore';
import {firstValueFrom} from 'rxjs';

describe('TrieStore', () => {
    let store: TrieStore = new TrieStore();

    beforeEach(() => {
        store = new TrieStore();
    });

    describe('constructor', () => {
        it('store is created with empty state by default and emits it', async () => {
            const observer = store.observe([]);
            expect(store.state).toEqual({});
            expect(await firstValueFrom(observer)).toBe(store.state);
        });

        it('store can be created with a specified state and emits it', async () => {
            const initialState = {a: 1};
            const newStore = new TrieStore(initialState);
            const observer = newStore.observe([]);
            expect(newStore.state).toBe(initialState);
            expect(newStore.state).toEqual({a: 1});
            expect(await firstValueFrom(observer)).toBe(newStore.state);
        });
    });

    describe('state', () => {
        it('is empty for a new store', () => {
            expect(store.state).toEqual({});
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
        it('sets state object to the root path', () => {
            const newGlobalState = {a: 1};
            store.set([], newGlobalState);
            expect(store.state).toBe(newGlobalState);
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
    });
});
