import { beforeEach, describe, expect, it } from '@jest/globals';
import { TrieStore } from '../src';
import { firstValueFrom } from 'rxjs';

describe('TrieStore', () => {
  let store: TrieStore = new TrieStore({});

  // Observed events for the following topology: { a1:{b1:1}, a2:{b2:2} } (graphRootState).
  let observedRootValues: Array<unknown> = [];
  let observedA1Values: Array<unknown> = [];
  let observedA2Values: Array<unknown> = [];
  let observedB1Values: Array<unknown> = [];
  let observedB2Values: Array<unknown> = [];
  let observedC1Values: Array<unknown> = [];

  let observedRootOldValues: Array<unknown> = [];
  let observedA1OldValues: Array<unknown> = [];
  let observedA2EventsOldValues: Array<unknown> = [];
  let observedB1OldValues: Array<unknown> = [];
  let observedB2OldValues: Array<unknown> = [];
  let observedC1OldValues: Array<unknown> = [];

  // Paths from the last event.
  let observedRootLastPaths: Array<string[]> | undefined;
  let observedA1LastPaths: Array<string[]> | undefined;
  let observedA2LastPaths: Array<string[]> | undefined;
  let observedB1LastPaths: Array<string[]> | undefined;
  let observedB2LastPaths: Array<string[]> | undefined;
  let observedC1LastPaths: Array<string[]> | undefined;

  let orderedNotifications: Array<unknown> = [];
  let graphRootState: { a1: { b1: number }; a2: { b2: number } } = {
    a1: { b1: 1 },
    a2: { b2: 2 },
  };
  let abcRootState: { a1: { b1: { c1: number } } } = { a1: { b1: { c1: 1 } } };

  function subscribeAndClearObservers(): void {
    subscribeObservers();
    clearObservations();
  }

  function subscribeObservers(): void {
    store.observe([]).subscribe(e => {
      observedRootValues.push(e);
      orderedNotifications.push(observedRootValues);
    });
    store.observe(['a1']).subscribe(e => {
      observedA1Values.push(e);
      orderedNotifications.push(observedA1Values);
    });
    store.observe(['a2']).subscribe(e => {
      observedA2Values.push(e);
      orderedNotifications.push(observedA2Values);
    });
    store.observe(['a1', 'b1']).subscribe(e => {
      observedB1Values.push(e);
      orderedNotifications.push(observedB1Values);
    });
    store.observe(['a2', 'b2']).subscribe(e => {
      observedB2Values.push(e);
      orderedNotifications.push(observedB2Values);
    });
    store.observe(['a1', 'b1', 'c1']).subscribe(e => {
      observedC1Values.push(e);
    });
    store.observeChanges([]).subscribe(e => {
      expect(e.value).toBe(observedRootValues.at(-1));
      observedRootOldValues.push(e.oldValue);
      observedRootLastPaths = e.paths;
    });
    store.observeChanges(['a1']).subscribe(e => {
      expect(e.value).toBe(observedA1Values.at(-1));
      observedA1OldValues.push(e.oldValue);
      observedA1LastPaths = e.paths;
    });
    store.observeChanges(['a2']).subscribe(e => {
      expect(e.value).toBe(observedA2Values.at(-1));
      observedA2EventsOldValues.push(e.oldValue);
      observedA2LastPaths = e.paths;
    });
    store.observeChanges(['a1', 'b1']).subscribe(e => {
      expect(e.value).toBe(observedB1Values.at(-1));
      observedB1OldValues.push(e.oldValue);
      observedB1LastPaths = e.paths;
    });
    store.observeChanges(['a2', 'b2']).subscribe(e => {
      expect(e.value).toBe(observedB2Values.at(-1));
      observedB2OldValues.push(e.oldValue);
      observedB2LastPaths = e.paths;
    });
    store.observeChanges(['a1', 'b1', 'c1']).subscribe(e => {
      expect(e.value).toBe(observedC1Values.at(-1));
      observedC1OldValues.push(e.oldValue);
      observedC1LastPaths = e.paths;
    });
  }

  function clearObservations(): void {
    observedRootValues = [];
    observedA1Values = [];
    observedA2Values = [];
    observedB1Values = [];
    observedB2Values = [];
    observedC1Values = [];

    observedRootOldValues = [];
    observedA1OldValues = [];
    observedA2EventsOldValues = [];
    observedB1OldValues = [];
    observedB2OldValues = [];
    observedC1OldValues = [];

    observedRootLastPaths = undefined;
    observedA1LastPaths = undefined;
    observedA2LastPaths = undefined;
    observedB1LastPaths = undefined;
    observedB2LastPaths = undefined;
    observedC1LastPaths = undefined;

    orderedNotifications = [];
  }

  beforeEach(() => {
    clearObservations();
    graphRootState = { a1: { b1: 1 }, a2: { b2: 2 } };
    abcRootState = { a1: { b1: { c1: 1 } } };
    store = new TrieStore({});
  });

  describe('constructor', () => {
    it('store can be created with an empty state and the store emits it', async () => {
      const observer = store.observe([]);
      expect(store.state).toEqual({});
      expect(await firstValueFrom(observer)).toBe(store.state);
    });

    it('store can be created with a custom state and the store emits it', async () => {
      const initialState = { a: 1 };
      const store = new TrieStore(initialState);
      const observer = store.observe([]);
      expect(store.state).toBe(initialState);
      expect(store.state).toEqual({ a: 1 });
      expect(await firstValueFrom(observer)).toBe(store.state);
    });

    it('runs a docs example with no issues', async () => {
      const initialState = {
        users: {
          user1: { wants: 'apple' },
          user2: { wants: 'orange' },
        },
      };
      const store = new TrieStore(initialState);
      const userLevelObserver = store.observe(['users']);
      const user1LevelObserver = store.observe(['users', 'user1']);
      const user1WantsLevelObserver = store.observe(['users', 'user1', 'wants']);

      // When the store is constructed first, it emits an initial state to all observers.
      expect(await firstValueFrom(userLevelObserver)).toEqual({
        user1: { wants: 'apple' },
        user2: { wants: 'orange' },
      });
      expect(await firstValueFrom(user1LevelObserver)).toEqual({
        wants: 'apple',
      });
      expect(await firstValueFrom(user1WantsLevelObserver)).toBe('apple');

      // When a trie node value is changed all parent node observers are notified.
      store.set(['users', 'user1', 'wants'], 'carrot');
      expect(await firstValueFrom(userLevelObserver)).toEqual({
        user1: { wants: 'carrot' },
        user2: { wants: 'orange' },
      });
      expect(await firstValueFrom(user1LevelObserver)).toEqual({
        wants: 'carrot',
      });
      expect(await firstValueFrom(user1WantsLevelObserver)).toBe('carrot');
    });
  });

  describe('state', () => {
    it('is empty for a new store with an empty state', () => {
      const state = {};
      expect(new TrieStore(state).state).toBe(state);
    });

    it('is referentially equal to the provided state', () => {
      const state = { a: 1, b: 2 };
      expect(new TrieStore(state).state).toBe(state);
      expect(state).toEqual({ a: 1, b: 2 });
    });

    it('is the current value after updates', () => {
      store.set(['a'], 1);
      expect(store.state).toEqual({ a: 1 });
    });
  });

  describe('state$', () => {
    it('same as root observable', async () => {
      const rootState1 = {};
      const store = new TrieStore(rootState1);
      expect(await firstValueFrom(store.state$)).toBe(rootState1);

      const rootState2 = { a: 1 };
      store.reset(rootState2);
      expect(await firstValueFrom(store.state$)).toBe(rootState2);
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
      expect(store.get(['1', '2'])).toEqual({ '3': 1 });
    });

    it('returns array elements', () => {
      store.set(['1', '2'], [3, 4]);
      expect(store.get(['1', '2'])).toStrictEqual([3, 4]);
      expect(store.get(['1', '2', '1'])).toEqual(4);
    });

    it('sees through arrays', () => {
      store.set(['1', '2'], [{ '3': 4 }]);
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

  describe('observe', () => {
    it('emits default on store creation', () => {
      store = new TrieStore(graphRootState);
      subscribeObservers();
      expect(observedRootValues.length).toBe(1);
      expect(observedA1Values.length).toBe(1);
      expect(observedA2Values.length).toBe(1);
      expect(observedB1Values.length).toBe(1);
      expect(observedB2Values.length).toBe(1);
    });

    it('uses correct notification order on initialization', () => {
      store = new TrieStore(graphRootState);
      subscribeObservers();
      expect(orderedNotifications).toStrictEqual([
        observedRootValues,
        observedA1Values,
        observedA2Values,
        observedB1Values,
        observedB2Values,
      ]);
    });

    it('uses correct notification order when child is updated', () => {
      store = new TrieStore(graphRootState);
      subscribeObservers();
      orderedNotifications = [];
      store.set(['a1', 'b1'], 3);
      expect(orderedNotifications).toStrictEqual([observedRootValues, observedA1Values, observedB1Values]);
    });

    it('observation is preserved even if the observed node is deleted', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();

      store.set(['a1'], { b3: 3 });
      expect(observedA1Values).toStrictEqual([{ b3: 3 }]);
      expect(observedB1Values).toStrictEqual([undefined]);

      store.set(['a1'], { b1: 4 });
      expect(observedB1Values).toStrictEqual([undefined, 4]);
    });

    it('can set observation before the value is set', () => {
      store = new TrieStore(graphRootState);

      const observedB3Values: Array<unknown> = [];
      const observer$ = store.observe(['a1', 'b3']);
      observer$.subscribe(v => observedB3Values.push(v));

      expect(observedB3Values.length).toBe(1); // Initial (current) state is undefined.
      expect(observedB3Values).toStrictEqual([undefined]);

      store.set(['a1', 'b3'], 3);
      expect(observedB3Values.length).toBe(2);
      expect(observedB3Values).toStrictEqual([undefined, 3]);
    });

    it('notifies when a value is removed and added back', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();
      expect(observedB1Values).toStrictEqual([]);

      store.set(['a1'], {});
      expect(observedB1Values.length).toBe(1);
      expect(observedB1Values).toStrictEqual([undefined]);

      store.set(['a1', 'b1'], 3);
      expect(observedB1Values.length).toBe(2);
      expect(observedB1Values).toStrictEqual([undefined, 3]);
    });

    it('child observers are notified when their value changes because of parent update', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();

      store.set(['a1'], { b1: 3 });
      expect(observedB1Values).toStrictEqual([3]);
    });

    it('does not emits events from inside of the batch', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();
      store.runInBatch(() => {
        store.set(['a1', 'b1'], 10);
        store.set(['a1', 'b1'], 20);
      });
      expect(observedRootValues.length).toBe(1);
      expect(observedA1Values.length).toBe(1);
      expect(observedB1Values.length).toBe(1);
      expect(observedA2Values.length).toBe(0);
      expect(observedB2Values.length).toBe(0);

      expect(observedRootValues).toStrictEqual([{ a1: { b1: 20 }, a2: { b2: 2 } }]);
      expect(observedA1Values).toStrictEqual([{ b1: 20 }]);
      expect(observedB1Values).toStrictEqual([20]);

      expect(observedRootOldValues).toStrictEqual([graphRootState]);
      expect(observedA1OldValues).toStrictEqual([graphRootState.a1]);
      expect(observedB1OldValues).toStrictEqual([graphRootState.a1.b1]);
      expect(observedA2EventsOldValues.length).toBe(0);
      expect(observedB2OldValues.length).toBe(0);

      expect(orderedNotifications).toStrictEqual([observedRootValues, observedA1Values, observedB1Values]);
    });
  });

  describe('observeChanges', () => {
    it('emits undefined as previous value on store creation', () => {
      store = new TrieStore(graphRootState);
      subscribeObservers();
      expect(observedRootOldValues).toStrictEqual([undefined]);
      expect(observedA1OldValues).toStrictEqual([undefined]);
      expect(observedA2EventsOldValues).toStrictEqual([undefined]);
      expect(observedB1OldValues).toStrictEqual([undefined]);
      expect(observedB2OldValues).toStrictEqual([undefined]);
    });

    it('emits previous value when it is changed', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();
      store.set(['a1', 'b1'], 3);
      expect(observedRootOldValues).toStrictEqual([{ a1: { b1: 1 }, a2: { b2: 2 } }]);
      expect(observedA1OldValues).toStrictEqual([{ b1: 1 }]);
      expect(observedA2EventsOldValues).toStrictEqual([]);
      expect(observedB1OldValues).toStrictEqual([1]);
      expect(observedB2OldValues).toStrictEqual([]);
      expect(observedB1Values).toStrictEqual([3]);
    });

    it('reports a correct path in single change mode', () => {
      store = new TrieStore(graphRootState);
      subscribeObservers();

      expect(observedRootLastPaths).toStrictEqual([[]]);
      expect(observedA1LastPaths).toStrictEqual([[]]);
      expect(observedA2LastPaths).toStrictEqual([[]]);
      expect(observedB1LastPaths).toStrictEqual([[]]);
      expect(observedB2LastPaths).toStrictEqual([[]]);

      clearObservations();
      store.set(['a1'], { b3: 3 });

      expect(observedRootLastPaths).toStrictEqual([['a1']]);
      expect(observedA1LastPaths).toStrictEqual([[]]);
      expect(observedA2LastPaths).toBeUndefined();
      expect(observedB1LastPaths).toStrictEqual([]); // 'b1' was set to undefined via parent node 'a1' update.
      expect(observedB2LastPaths).toBeUndefined();

      clearObservations();
      store.set(['a1', 'b1'], 4);
      expect(observedRootLastPaths).toStrictEqual([['a1', 'b1']]);
      expect(observedA1LastPaths).toStrictEqual([['b1']]);
      expect(observedA2LastPaths).toBeUndefined();
      expect(observedB1LastPaths).toStrictEqual([[]]);
      expect(observedB2LastPaths).toBeUndefined();
    });

    it('correctly report multiple paths in batch mode', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();

      store.runInBatch(() => {
        expect(observedRootLastPaths).toBeUndefined();
        store.set(['a1', 'b1'], 3);
        expect(observedRootLastPaths).toBeUndefined();
        store.set(['a2', 'b2'], 4);
        expect(observedRootLastPaths).toBeUndefined();
      });
      expect(observedRootLastPaths).toStrictEqual([
        ['a1', 'b1'],
        ['a2', 'b2'],
      ]);
      expect(observedA1LastPaths).toStrictEqual([['b1']]);
      expect(observedB1LastPaths).toStrictEqual([[]]);
      expect(observedA2LastPaths).toStrictEqual([['b2']]);
      expect(observedB2LastPaths).toStrictEqual([[]]);
    });

    it('correctly merges observed paths in batch mode', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();

      store.runInBatch(() => {
        expect(observedRootLastPaths).toBeUndefined();
        store.set(['a1'], { b1: 3 });
        expect(observedRootLastPaths).toBeUndefined();
        store.set(['a1', 'b1'], 4);
        expect(observedRootLastPaths).toBeUndefined();
      });
      expect(observedRootLastPaths).toStrictEqual([['a1']]);
      expect(observedA1LastPaths).toStrictEqual([[]]);
      expect(observedB1LastPaths).toStrictEqual([[]]);
    });

    it('for two changes in batch ["a1", "b1", "c1"] and ["a1", "b1"] only one shorter path will be reported: [["a1", "b1"]]', () => {
      store = new TrieStore(abcRootState);
      subscribeAndClearObservers();
      store.runInBatch(() => {
        expect(observedRootLastPaths).toBeUndefined();
        store.set(['a1', 'b1'], {});
        expect(observedRootLastPaths).toBeUndefined();
        store.set(['a1', 'b1', 'c1'], 10);
        expect(observedRootLastPaths).toBeUndefined();
      });
      expect(observedRootLastPaths).toStrictEqual([['a1', 'b1']]);
      expect(observedA1LastPaths).toStrictEqual([['b1']]);
      expect(observedB1LastPaths).toStrictEqual([[]]);
      expect(observedC1LastPaths).toStrictEqual([[]]);
    });

    it(`check state {a1: {b1: {c1: 1}}} after set(['a1', 'b1', 'c1'], 2)`, () => {
      store = new TrieStore(abcRootState);
      subscribeAndClearObservers();
      store.set(['a1', 'b1', 'c1'], 2);
      expect(observedRootLastPaths).toStrictEqual([['a1', 'b1', 'c1']]);
      expect(observedA1LastPaths).toStrictEqual([['b1', 'c1']]);
      expect(observedB1LastPaths).toStrictEqual([['c1']]);
      expect(observedC1LastPaths).toStrictEqual([[]]);
    });

    it(`check state {a1: {b1: {c1: 1}}} after set(['a1', 'b1'], {})`, () => {
      store = new TrieStore(abcRootState);
      subscribeAndClearObservers();
      store.set(['a1', 'b1'], {});
      expect(observedRootLastPaths).toStrictEqual([['a1', 'b1']]);
      expect(observedA1LastPaths).toStrictEqual([['b1']]);
      expect(observedB1LastPaths).toStrictEqual([[]]);
      expect(observedC1LastPaths).toStrictEqual([]);
      expect(observedC1OldValues).toStrictEqual([1]);
    });
  });

  describe('set', () => {
    it('can set root state', () => {
      const newState = { a: 1 };
      store.set([], newState);
      expect(store.state).toBe(newState);
      expect(newState).toEqual({ a: 1 });
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
      expect(store.state).toEqual({ a: 1 });
    });

    it('can set a multi-level property', () => {
      store.set(['a', 'b'], 2);
      expect(store.get(['a', 'b'])).toBe(2);
      expect(store.get(['a'])).toEqual({ b: 2 });
      expect(store.state).toEqual({ a: { b: 2 } });
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
      const o = { b: { c: 3 } };
      store.set(['a'], o);
      expect(store.get(['a'])).toBe(o);
      expect(o).toEqual({ b: { c: 3 } });
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
      expect(a).toStrictEqual([1, 2, 3]);
    });

    it('replaces old path', () => {
      store.set(['a', 'b1'], { c1: 1 });
      store.set(['a'], { b2: { c2: 2 } });
      expect(store.state).toEqual({ a: { b2: { c2: 2 } } });
    });

    it('builds new path', () => {
      store.set(['a', 'b1'], { c1: 1 });
      store.set(['a', 'b2'], { c2: 2 });
      expect(store.state).toEqual({ a: { b1: { c1: 1 }, b2: { c2: 2 } } });
    });

    it('does not allow to set child nodes of primitive values', () => {
      store.set(['a'], 1);
      expect(() => store.set(['a', 'b'], 1)).toThrow('non-record parent');

      store.set(['a'], BigInt(1));
      expect(() => store.set(['a', 'b'], 1)).toThrow('non-record parent');

      store.set(['a'], true);
      expect(() => store.set(['a', 'b'], 1)).toThrow('non-record parent');

      store.set(['a'], 'text');
      expect(() => store.set(['a', 'b'], 1)).toThrow('non-record parent');

      store.set(['a'], []);
      expect(() => store.set(['a', 'b'], 1)).toThrow('Invalid array index');
    });

    it('default compareFn uses referential equality', () => {
      subscribeObservers();
      const state0 = store.state;
      expect(observedRootValues.length).toBe(1);
      expect(observedRootValues).toStrictEqual([{}]);

      store.set(['a'], 1);
      expect(observedRootValues.length).toBe(2);
      expect(observedRootValues).toStrictEqual([{}, { a: 1 }]);
      const state1 = store.state;
      expect(state1).not.toBe(state0);

      store.set(['a'], 1);
      expect(observedRootValues.length).toBe(2);
      expect(observedRootValues).toStrictEqual([{}, { a: 1 }]);
      expect(state1).toBe(store.state);

      store.set(['a'], '1');
      expect(observedRootValues.length).toBe(3);
      expect(observedRootValues).toStrictEqual([{}, { a: 1 }, { a: '1' }]);
      const state2 = store.state;
      expect(state2).not.toBe(state1);
    });

    it('supports non default compareFn', () => {
      subscribeObservers();
      const state0 = store.state;

      store.set(['a'], 1, () => true);
      expect(observedRootValues.length).toBe(1);
      expect(observedRootValues).toStrictEqual([{}]);

      store.set(['a'], 1);
      expect(observedRootValues.length).toBe(2);
      expect(observedRootValues).toStrictEqual([{}, { a: 1 }]);
      const state1 = store.state;
      expect(state1).not.toBe(state0);

      store.set(['a'], 2, () => true);
      expect(observedRootValues.length).toBe(2);
      expect(observedRootValues).toStrictEqual([{}, { a: 1 }]);
      expect(state1).toBe(store.state);
    });

    it('non default compareFn does affect referential equality', () => {
      subscribeObservers();
      store.set(['a'], 1);
      expect(observedRootValues.length).toBe(2);
      expect(observedRootValues).toStrictEqual([{}, { a: 1 }]);

      store.set(['a'], 1, () => false);
      expect(observedRootValues.length).toBe(2);
      expect(observedRootValues).toStrictEqual([{}, { a: 1 }]);
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
      const value11 = { a: 1 };
      const path1: string[] = [];
      store.set(path1, value11, compareFn);
      expect(cachedOldValue).toEqual({});
      expect(cachedNewValue).toBe(value11);
      expect(cachedPath).toBe(path1);

      const value12 = { a: 2 };
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
      expect(store.state).toEqual({ a: {} });
    });

    it('does not allow deletion from non-record types', () => {
      store.set(['a'], 1);
      expect(() => store.delete(['a', 'b'])).toThrow(`Path: 'a', type: number`);

      store.set(['a'], []);
      store.delete(['a', 'b']);
      expect(store.state).toEqual({ a: [] });

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
      expect(store.state).toEqual({ a: {} });
    });

    it('deletes middle keys', () => {
      store.set(['a'], {});
      store.set(['a', 'b'], {});
      store.set(['a', 'b', 'c'], 3);
      store.delete(['a', 'b']);
      expect(store.state).toEqual({ a: {} });
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
      subscribeObservers();
      store.set(['a'], {});
      store.set(['a', 'b'], {});
      const eventCountBefore = observedRootValues.length;
      store.delete(['a', 'b', 'c']);
      expect(observedRootValues.length).toEqual(eventCountBefore);
    });

    it('emits when deleted', () => {
      subscribeObservers();
      store.set([], graphRootState);
      const rootEventCountOnStart = observedRootValues.length;
      const a1EventCountOnStart = observedA1Values.length;
      const b1EventCountOnStart = observedB1Values.length;
      const a2EventCountOnStart = observedA1Values.length;

      store.delete(['a1', 'b1']);

      expect(observedRootValues.length).toBe(rootEventCountOnStart + 1);
      expect(observedA1Values.length).toBe(a1EventCountOnStart + 1);
      expect(observedB1Values.length).toBe(b1EventCountOnStart + 1);
      expect(observedA2Values.length).toBe(a2EventCountOnStart);

      expect(observedRootValues.at(-1)).toEqual({ a1: {}, a2: { b2: 2 } });
      expect(observedA1Values.at(-1)).toEqual({});
      expect(observedB1Values.at(-1)).toBe(undefined);

      store.set(['a1', 'b1'], 3);
      expect(observedB1Values.length).toBe(b1EventCountOnStart + 2);
      expect(observedB1Values.at(-1)).toBe(3);
    });
  });

  describe('reset', () => {
    it('does not emit any events ', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();
      const newState = { a1: { b1: 3 }, a2: { b2: 4 } };
      store.reset(newState);
      expect(store.state).toBe(newState);

      expect(observedRootValues.length).toBe(0);
      expect(observedA1Values.length).toBe(0);
      expect(observedB1Values.length).toBe(0);
      expect(observedA2Values.length).toBe(0);
      expect(observedB2Values.length).toBe(0);

      store.set(['a1'], 5);
      expect(store.state).toEqual({ a1: 5, a2: { b2: 4 } });
      expect(observedRootValues.length).toBe(0);
      expect(observedA1Values.length).toBe(0);
      expect(observedB1Values.length).toBe(0);
    });
  });
  describe('runInBatch', () => {
    it('emits once after batch ends', () => {
      subscribeAndClearObservers();
      expect(observedRootValues.length).toBe(0);
      store.runInBatch(() => {
        store.set(['a'], 1);
        expect(store.get(['a'])).toBe(1);
        expect(observedRootValues.length).toBe(0); // Not emitted.
        store.set(['a'], 2);
        expect(observedRootValues.length).toBe(0); // Not emitted.
        store.set(['b'], 3);
        expect(observedRootValues.length).toBe(0); // Not emitted.
      });
      expect(observedRootValues.length).toBe(1);
      expect(observedRootValues).toStrictEqual([{ a: 2, b: 3 }]);
    });

    it('handles different paths', () => {
      subscribeAndClearObservers();
      store.runInBatch(() => {
        store.set(['a1'], 1);
        store.set(['a2'], 2);
      });
      expect(observedRootValues.length).toBe(1);
      expect(observedA1Values.length).toBe(1);
      expect(observedA2Values.length).toBe(1);

      expect(observedRootValues).toStrictEqual([{ a1: 1, a2: 2 }]);
      expect(observedA1Values).toStrictEqual([1]);
      expect(observedA2Values).toStrictEqual([2]);
    });

    it('nested batch is merged into the parent batch', () => {
      store = new TrieStore(graphRootState);
      subscribeAndClearObservers();
      store.runInBatch(() => {
        store.set(['a1'], {});
        store.set(['a2'], {});
        store.runInBatch(() => {
          store.set(['a1', 'b1'], 3);
          store.set(['a2', 'b3'], 4);
        });
      });
      expect(observedRootValues.length).toBe(1);
      expect(observedA1Values.length).toBe(1);
      expect(observedA2Values.length).toBe(1);
      expect(observedB1Values.length).toBe(1);
      expect(observedB2Values.length).toBe(1);

      expect(observedRootValues).toStrictEqual([{ a1: { b1: 3 }, a2: { b3: 4 } }]);
      expect(observedA1Values).toStrictEqual([{ b1: 3 }]);
      expect(observedA2Values).toStrictEqual([{ b3: 4 }]);
      expect(observedB2Values.length).toBe(1);
      expect(observedB2Values).toStrictEqual([undefined]);

      expect(observedRootOldValues).toStrictEqual([graphRootState]);
      expect(observedA1OldValues).toStrictEqual([graphRootState.a1]);
      expect(observedA2EventsOldValues).toStrictEqual([graphRootState.a2]);
    });
  });
});
