import { describe, expect, it } from '@jest/globals';
import {
  apply,
  deepCloneOnPath,
  deleteInPath,
  extractPaths,
  isPathPrefix,
  selectUniquePathPrefixes,
  selectUniquePaths,
  setInPath,
  sortPaths,
} from '../src';

describe('Utils', () => {
  describe('deepCloneOnPath', () => {
    describe('patchValue is undefined', () => {
      it('deletes a property', () => {
        const originalState = { a: 1, b: 2 };
        expect(deepCloneOnPath(originalState, ['a'], undefined)).toEqual({
          b: 2,
        });
        expect(originalState).toEqual({ a: 1, b: 2 });
      });

      it('deletes a subtree', () => {
        const originalState = { a: { c: 3 }, b: 2 };
        expect(deepCloneOnPath(originalState, ['a'], undefined)).toEqual({
          b: 2,
        });
        expect(originalState).toEqual({ a: { c: 3 }, b: 2 });
      });

      it('ignores unknown state', () => {
        const originalState = { a: 1, b: 2 };
        expect(deepCloneOnPath(originalState, ['c'], undefined)).toEqual({
          a: 1,
          b: 2,
        });
        expect(originalState).toEqual({ a: 1, b: 2 });
      });

      it('ignores deep unknown state, variant 1', () => {
        const originalState = { a: 1, b: 2 };
        expect(deepCloneOnPath(originalState, ['c', 'd'], undefined)).toEqual({
          a: 1,
          b: 2,
        });
        expect(originalState).toEqual({ a: 1, b: 2 });
      });

      it('ignores deep unknown state, variant 2', () => {
        const originalState = { a: 1, b: 2, c: { d: 4 } };
        expect(deepCloneOnPath(originalState, ['c', 'e'], undefined)).toEqual({
          a: 1,
          b: 2,
          c: { d: 4 },
        });
        expect(originalState).toEqual({ a: 1, b: 2, c: { d: 4 } });
      });

      it('clones only affected path', () => {
        const originalState = { a1: { a2: 1 }, b1: { b2: 2 } };
        const clonedState = deepCloneOnPath(originalState, ['b1'], undefined);
        expect(clonedState).toEqual({ a1: { a2: 1 } });
        expect(originalState).toEqual({ a1: { a2: 1 }, b1: { b2: 2 } });
        expect(originalState.a1).toBe(clonedState.a1);
      });

      it('keeps an empty object if last field is deleted', () => {
        const originalState = { a1: { a2: 2 } };
        expect(deepCloneOnPath(originalState, ['a1', 'a2'], undefined)).toEqual({ a1: {} });
        expect(originalState).toEqual({ a1: { a2: 2 } });
      });

      it('does not allow to delete elements of array', () => {
        const originalState = { a: [1, 2, 3] };
        expect(() => deepCloneOnPath(originalState, ['a', '1'], undefined)).toThrow('element of array');
        expect(originalState).toEqual({ a: [1, 2, 3] });
      });

      it('can delete fields of objects in an array', () => {
        const originalState = { a: [0, 1, { b: { c: 2 } }] };
        expect(deepCloneOnPath(originalState, ['a', '2', 'b', 'c'], undefined)).toEqual({ a: [0, 1, { b: {} }] });
        expect(originalState).toEqual({ a: [0, 1, { b: { c: 2 } }] });
      });

      it('does not support fractional values as array indexes when path key is not an integer', () => {
        const originalState = { a: [0, 1, { b: { c: 2 } }] };
        expect(() => deepCloneOnPath(originalState, ['a', '2.1', 'b', 'c'], undefined)).toThrow('element of array');
        expect(originalState).toEqual({ a: [0, 1, { b: { c: 2 } }] });
      });

      it('does not support fractional values as array indexes even if path key is an integer', () => {
        const originalState = { a: [0, 1, { b: { c: 2 } }] };
        expect(() => deepCloneOnPath(originalState, ['a', '2.0', 'b', 'c'], undefined)).toThrow('element of array');
        expect(originalState).toEqual({ a: [0, 1, { b: { c: 2 } }] });
      });
    });

    describe('patchValue a defined value', () => {
      it('updates property', () => {
        const originalState = { a: 1, b: 2 };
        expect(deepCloneOnPath(originalState, ['a'], 11)).toEqual({
          a: 11,
          b: 2,
        });
        expect(originalState).toEqual({ a: 1, b: 2 });
      });

      it('updates a deep property', () => {
        const originalState = { a: { c: 3 }, b: 2 };
        expect(deepCloneOnPath(originalState, ['a', 'c'], 'hello')).toEqual({
          a: { c: 'hello' },
          b: 2,
        });
        expect(originalState).toEqual({ a: { c: 3 }, b: 2 });
      });

      it('builds a subtree if missed', () => {
        const originalState = { a: { c: {} }, b: 2 };
        expect(deepCloneOnPath(originalState, ['a', 'c', 'd', 'e'], 5)).toEqual({ a: { c: { d: { e: 5 } } }, b: 2 });
        expect(originalState).toEqual({ a: { c: {} }, b: 2 });
      });

      it('does not build subtree for primitive roots', () => {
        const originalState = { a: { c: 3 }, b: 2 };
        expect(() => deepCloneOnPath(originalState, ['a', 'c', 'd', 'e'], 5)).toThrow('Internal error');
        expect(originalState).toEqual({ a: { c: 3 }, b: 2 });
      });

      it('clones only affected paths', () => {
        const originalState = { a1: { a2: 1 }, b1: { b2: 2 } };
        const clonedState = deepCloneOnPath(originalState, ['b1'], { b3: 3 });
        expect(clonedState).toEqual({ a1: { a2: 1 }, b1: { b3: 3 } });
        expect(originalState).toEqual({ a1: { a2: 1 }, b1: { b2: 2 } });
        expect(originalState.a1).toBe(clonedState.a1);
      });
    });
  });

  describe('setInPath', () => {
    it('restricts root path values to Record', () => {
      expect(() => setInPath({}, [], '')).toThrow('must be a record');
      expect(() => setInPath({}, [], [])).toThrow('must be a record');
      expect(() => setInPath({}, [], (): void => {})).toThrow('must be a record');
      expect(() => setInPath({}, [], BigInt(1))).toThrow('must be a record');
    });

    it('allows record as a root path', () => {
      const newState = {};
      const result = setInPath({ a: 1 }, [], newState);
      expect(result).toBe(newState);
    });

    it('returns a cloned state on a change in sub-tree', () => {
      const state = { a: { a1: 1 }, b: { b1: 1 } };
      const newState = setInPath(state, ['b'], { b1: 2 });
      expect(newState).toEqual({ a: { a1: 1 }, b: { b1: 2 } });
      expect(state).toEqual({ a: { a1: 1 }, b: { b1: 1 } }); // Not changed.
      expect(state.a).toBe(newState.a); // Not cloned.
    });

    it('does not clone on no-op change in sub-tree', () => {
      const state = { a: { a1: 1 }, b: { b1: 1 } };
      const newState = setInPath(state, ['b'], state.b);
      expect(newState).toBe(state);
      expect(state).toEqual({ a: { a1: 1 }, b: { b1: 1 } }); // Not changed.
    });

    it('returns a cloned state on a primitive value change in sub-tree', () => {
      const state = { a: { a1: 1 }, b: { b1: 1 } };
      const newState = setInPath(state, ['b', 'b1'], 2);
      expect(newState).toEqual({ a: { a1: 1 }, b: { b1: 2 } });
      expect(state).toEqual({ a: { a1: 1 }, b: { b1: 1 } }); // Not changed.
      expect(state.a).toBe(newState.a); // Not cloned.
    });

    it('does not clone on no-op for a primitive value in sub-tree', () => {
      const state = { a: { a1: 1 }, b: { b1: 1 } };
      const newState = setInPath(state, ['b', 'b1'], 1);
      expect(newState).toBe(state);
      expect(state).toEqual({ a: { a1: 1 }, b: { b1: 1 } }); // Not changed.
    });

    it('can overwrite a sub-tree', () => {
      const state = { a: { a1: 1 }, b: { b1: 1 } };
      const newState = setInPath(state, ['b', 'b1'], { b2: 2 });
      expect(newState).toEqual({ a: { a1: 1 }, b: { b1: { b2: 2 } } });
      expect(state).toEqual({ a: { a1: 1 }, b: { b1: 1 } }); // Not changed.
      expect(state.a).toBe(newState.a); // Not cloned.
    });

    it('can set array elements', () => {
      const state = { a: { a1: 1 }, b: [0, 1, 2] };
      const newState = setInPath(state, ['b', '1'], 3);
      expect(newState).toEqual({ a: { a1: 1 }, b: [0, 3, 2] });
      expect(state).toEqual({ a: { a1: 1 }, b: [0, 1, 2] }); // Not changed.
      expect(state.a).toBe(newState.a); // Not cloned.
    });

    it('can change type of array elements', () => {
      const state = { a: { a1: 1 }, b: [0, 1, 2] };
      const newState = setInPath(state, ['b', '1'], { v: 3 });
      expect(newState).toEqual({ a: { a1: 1 }, b: [0, { v: 3 }, 2] });
      expect(state).toEqual({ a: { a1: 1 }, b: [0, 1, 2] }); // Not changed.
      expect(state.a).toBe(newState.a); // Not cloned.
    });

    it('can set sub-objects of array elements', () => {
      const state = { a: { a1: 1 }, b: [0, { v: 1 }, 2] };
      const newState = setInPath(state, ['b', '1', 'v'], 3);
      expect(newState).toEqual({ a: { a1: 1 }, b: [0, { v: 3 }, 2] });
      expect(state).toEqual({ a: { a1: 1 }, b: [0, { v: 1 }, 2] }); // Not changed.
      expect(state.a).toBe(newState.a); // Not cloned.
    });

    it('expands array on positive out of bound indexes', () => {
      const state = { a: [0, 1, 2] };
      const newState = setInPath(state, ['a', '4'], 4);
      expect(newState).toEqual({ a: [0, 1, 2, undefined, 4] });
      expect(state).toEqual({ a: [0, 1, 2] });
    });

    it('throws on negative array index', () => {
      expect(() => setInPath({ a: [0, 1, 2] }, ['a', '-1'], {})).toThrow('Invalid array index');
    });

    it('no-op on negative array index in the middle of the path', () => {
      expect(() => setInPath({ a: [0, 1, 2] }, ['a', '-1', 'c'], {})).toThrow('Invalid array index');
    });

    it('set undefined value works as delete', () => {
      const state = { a: { a1: 1 }, b: { b1: 1 } };
      const newState = setInPath(state, ['b', 'b1'], undefined);
      expect(newState).toEqual({ a: { a1: 1 }, b: {} });
      expect(state).toEqual({ a: { a1: 1 }, b: { b1: 1 } });
    });
  });

  describe('deleteInPath', () => {
    it('does not allow empty path', () => {
      expect(() => deleteInPath({}, [])).toThrow('empty path');
    });

    it(`returns original state on no-op deletion, variant 1`, () => {
      const state = { a: {} };
      expect(deleteInPath(state, ['a', 'b'])).toBe(state);
      expect(state).toEqual({ a: {} });
    });

    it(`returns original state on no-op deletion, variant 2`, () => {
      const state = { a: { b: undefined } };
      expect(deleteInPath(state, ['a', 'b'])).toBe(state);
      expect(state).toEqual({ a: { b: undefined } });
    });

    it(`returns original state on no-op deletion, variant 3`, () => {
      const state = { a: { b: {} } };
      expect(deleteInPath(state, ['a', 'b', 'c'])).toBe(state);
      expect(state).toEqual({ a: { b: {} } });
    });

    it(`deletes by path`, () => {
      const state = { a: 1 };
      const newState = deleteInPath(state, ['a']);
      expect(newState).toEqual({});
      expect(state).toEqual({ a: 1 });
    });

    it(`deletes by deep path`, () => {
      const state = { a: { b: { c: 1 } } };
      const newState = deleteInPath(state, ['a', 'b', 'c']);
      expect(newState).toEqual({ a: { b: {} } });
      expect(state).toEqual({ a: { b: { c: 1 } } });
    });

    it(`deletes by deep path in the middle`, () => {
      const state = { a: { b: { c: 1 } } };
      const newState = deleteInPath(state, ['a', 'b']);
      expect(newState).toEqual({ a: {} });
      expect(state).toEqual({ a: { b: { c: 1 } } });
    });

    it(`deletes in object from an array`, () => {
      const state = { a: [{}, { b: 1 }] };
      const newState = deleteInPath(state, ['a', '1', 'b']);
      expect(newState).toEqual({ a: [{}, {}] });
      expect(state).toEqual({ a: [{}, { b: 1 }] });
    });

    it(`can't delete from arrays`, () => {
      expect(() => deleteInPath({ a: [0, 1, 2] }, ['a', '1'])).toThrow('element of array');
    });

    it(`can't delete from non object types`, () => {
      expect(() => deleteInPath({ a: 1 }, ['a', 'b'])).toThrow('non-record parent');
      expect(() => deleteInPath({ a: null }, ['a', 'b'])).toThrow('non-record parent');
      expect(() => deleteInPath({ a: '' }, ['a', 'b'])).toThrow('non-record parent');
    });

    it(`deletes a child from a string field in array causes an error`, () => {
      expect(() => deleteInPath({ a: [{}, 'non-object-field'] }, ['a', '1', 'b'])).toThrow('non-record parent');
    });

    it(`deletes a child from null field in array cases an error`, () => {
      expect(() => deleteInPath({ a: [{}, null] }, ['a', '1', 'b'])).toThrow('non-record parent');
    });

    it(`deletes a child from an array field in array does not cause an error (array is an object)`, () => {
      const state = { a: [{}, []] };
      const newState = deleteInPath(state, ['a', '1', 'b']);
      expect(newState).toBe(state);
      expect(state).toEqual({ a: [{}, []] });
    });

    it(`handle paths with undefined field in array`, () => {
      const state = { a: [{}, undefined] };
      const newState = deleteInPath(state, ['a', '1', 'b']);
      expect(newState).toBe(state); // Not changed.
      expect(state).toEqual({ a: [{}, undefined] });
    });

    it(`handle paths with an out of bound array index`, () => {
      const state = { a: [{}, {}] };
      const newState = deleteInPath(state, ['a', '2', 'b']);
      expect(newState).toBe(state); // Not changed.
      expect(state).toEqual({ a: [{}, {}] });
    });

    it(`handle paths with a negative out of bound array index`, () => {
      const state = { a: [{}, {}] };
      const newState = deleteInPath(state, ['a', '-2', 'b']);
      expect(newState).toBe(state); // Not changed.
      expect(state).toEqual({ a: [{}, {}] });
    });

    it(`deletes nulls`, () => {
      const state = { a: { b: null } };
      const newState = deleteInPath(state, ['a', 'b']);
      expect(newState).toEqual({ a: {} });
      expect(state).toEqual({ a: { b: null } });
    });

    it(`deletes empty strings`, () => {
      const state = { a: { b: null } };
      const newState = deleteInPath(state, ['a', 'b']);
      expect(newState).toEqual({ a: {} });
      expect(state).toEqual({ a: { b: null } });
    });

    it(`deletes undefined values`, () => {
      const state = { a: { b: undefined } };
      const newState = deleteInPath(state, ['a', 'b']);
      expect(newState).toEqual({ a: {} });
      expect(state).toEqual({ a: { b: undefined } });
    });
  });

  describe('apply', () => {
    // See setInPath for tests.
    describe('set', () => {
      it('sets a value', () => {
        const state = { a: 1, b: 2 };
        const newState = apply(state, { type: 'set', path: ['b'], value: 3 });
        expect(newState).toEqual({ a: 1, b: 3 });
        expect(state).toEqual({ a: 1, b: 2 });
      });
    });

    describe('delete', () => {
      // See deleteInPath for tests.
      it('deletes a value', () => {
        const state = { a: 1, b: 2 };
        const newState = apply(state, { type: 'delete', path: ['b'] });
        expect(newState).toEqual({ a: 1 });
        expect(state).toEqual({ a: 1, b: 2 });
      });
    });

    describe('batch', () => {
      it('applies no actions', () => {
        const state = { a: 1, b: 2 };
        const newState = apply(state, { type: 'batch', actions: [] });
        expect(newState).toBe(state);
        expect(state).toEqual({ a: 1, b: 2 });
      });

      it('applies a single action', () => {
        const state = { a: 1, b: 2 };
        const newState = apply(state, {
          type: 'batch',
          actions: [{ type: 'set', path: ['c'], value: 3 }],
        });
        expect(newState).toEqual({ a: 1, b: 2, c: 3 });
        expect(state).toEqual({ a: 1, b: 2 });
      });

      it('applies multiple actions in order', () => {
        const state = { a: 1, b: 2 };
        const newState = apply(state, {
          type: 'batch',
          actions: [
            { type: 'set', path: ['b'], value: 3 },
            { type: 'set', path: ['c'], value: 4 },
            { type: 'set', path: ['d'], value: 5 },
            { type: 'delete', path: ['c'] },
          ],
        });
        expect(newState).toEqual({ a: 1, b: 3, d: 5 });
        expect(state).toEqual({ a: 1, b: 2 });
      });
    });
  });

  describe('extractPaths', () => {
    it('works with non-batch actions', () => {
      expect(extractPaths({ type: 'set', path: ['a'], value: 1 }, 'as-is')).toEqual([['a']]);
      expect(extractPaths({ type: 'delete', path: ['a'] }, 'as-is')).toEqual([['a']]);
    });

    it('works with batch actions, non sorted mode', () => {
      expect(
        extractPaths(
          {
            type: 'batch',
            actions: [
              { type: 'set', path: ['a'], value: 1 },
              { type: 'delete', path: ['b'] },
              { type: 'batch', actions: [{ type: 'delete', path: ['a'] }] },
            ],
          },
          'as-is',
        ),
      ).toEqual([['a'], ['b'], ['a']]);
    });

    it('works with batch actions, sorted mode', () => {
      expect(
        extractPaths(
          {
            type: 'batch',
            actions: [
              { type: 'set', path: ['c'], value: 1 },
              { type: 'delete', path: ['b'] },
              { type: 'batch', actions: [{ type: 'delete', path: ['c'] }] },
            ],
          },
          'unique-and-sorted',
        ),
      ).toEqual([['b'], ['c']]);
    });
  });

  describe('isPathPrefix', () => {
    it('returns expected results', () => {
      expect(isPathPrefix([], [])).toBe(true);
      expect(isPathPrefix(['a'], [])).toBe(true);
      expect(isPathPrefix(['a'], ['a'])).toBe(true);
      expect(isPathPrefix(['a', 'b'], ['a'])).toBe(true);
      expect(isPathPrefix(['a'], ['a', 'b'])).toBe(false);
      expect(isPathPrefix(['a'], ['b'])).toBe(false);
    });
  });

  describe('sortPaths', () => {
    it('sorts by strings first', () => {
      const unsortedPaths = [
        ['a', 'b', 'c'],
        ['a', 'a', 'd', 'e'],
      ];
      expect(sortPaths(unsortedPaths)).toStrictEqual([
        ['a', 'a', 'd', 'e'],
        ['a', 'b', 'c'],
      ]);
      expect(unsortedPaths).toStrictEqual([
        ['a', 'b', 'c'],
        ['a', 'a', 'd', 'e'],
      ]); // Not changed.
    });

    it('sorts by length next', () => {
      const unsortedPaths = [
        ['a', 'b', 'c'],
        ['a', 'b'],
      ];
      expect(sortPaths(unsortedPaths)).toStrictEqual([
        ['a', 'b'],
        ['a', 'b', 'c'],
      ]);
      expect(unsortedPaths).toStrictEqual([
        ['a', 'b', 'c'],
        ['a', 'b'],
      ]); // Not changed.
    });

    it('does not reorder equal values', () => {
      const v1 = ['a', 'b'];
      const v2 = ['a', 'b'];
      const unsortedPaths = [v1, v2];
      const sortedPaths = sortPaths(unsortedPaths);
      expect(sortedPaths.length).toBe(2);
      expect(sortedPaths[0]).toBe(v1);
      expect(sortedPaths[1]).toBe(v2);
    });
  });

  describe('selectUniquePathPrefixes', () => {
    it('returns only prefixes', () => {
      const v1 = ['a', 'b'];
      const v2 = ['a', 'b', 'c'];
      const v3 = ['d'];
      const inputPaths = [v1, v2, v3];
      const uniquePathPrefixes = selectUniquePathPrefixes([v1, v2, v3]);
      expect(uniquePathPrefixes.length).toBe(2);
      expect(uniquePathPrefixes[0]).toBe(v1);
      expect(uniquePathPrefixes[1]).toBe(v3);
      expect(inputPaths).toStrictEqual([v1, v2, v3]); // Not changed.
    });
  });

  describe('selectUniquePaths', () => {
    it('keeps only unique paths', () => {
      const v1 = ['a', 'b'];
      const v2 = ['a', 'b'];
      const v3 = ['a'];
      const nonUniquePaths = [v1, v2, v3];
      const uniquePaths = selectUniquePaths(nonUniquePaths);
      expect(uniquePaths.length).toBe(2);
      expect(uniquePaths[0]).toBe(v3);
      expect(uniquePaths[1]).toBe(v1);
      expect(nonUniquePaths).toStrictEqual([v1, v2, v3]); // Not changed.
    });
  });
});
