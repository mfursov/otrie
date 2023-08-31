# Observable Path Trie Store

TrieStore is a RxJS-observable path tree store.

It keeps an instance of RxJS Subject associated with every monitored field in the state object
and notifies observers when the node value or any child node value changes.

```typescript
import {TrieStore} from 'otrie';

const initialState = {
    users: {
        user1: {wants: 'apple'},
        user2: {wants: 'orange'},
    }
};
const store = new TrieStore(initialState);
const userLevelObserver = store.observe(['users']);
const user1LevelObserver = store.observe(['users', 'user1']);
const user1WantsLevelObserver = store.observe(['users', 'user1', 'wants']);

// When the store is constructed first, it emits an initial state to all observers.
expect(await firstValueFrom(userLevelObserver)).toEqual({user1: {wants: 'apple'}, user2: {wants: 'orange'}});
expect(await firstValueFrom(user1LevelObserver)).toEqual({wants: 'apple'});
expect(await firstValueFrom(user1WantsLevelObserver)).toBe('apple');

// When a tree node value is changed all parent node observers are notified.
store.set(['users', 'user1', 'wants'], 'carrot');
expect(await firstValueFrom(userLevelObserver)).toEqual({user1: {wants: 'carrot'}, user2: {wants: 'orange'}});
expect(await firstValueFrom(user1LevelObserver)).toEqual({wants: 'carrot'});
expect(await firstValueFrom(user1WantsLevelObserver)).toBe('carrot');

```

See [sources](https://github.com/mfursov/otrie/tree/master/src/TrieStore.ts) and
related [unit tests](https://github.com/mfursov/otrie/tree/master/tests/TrieStore.jest.ts) for details.
