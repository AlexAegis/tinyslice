# tinyslice 🍕

[![Latest NPM Version](https://img.shields.io/npm/v/@tinyslice/core/latest)](https://www.npmjs.com/package/@tinyslice/core)
[![CI](https://github.com/AlexAegis/tinyslice/workflows/CI/badge.svg)](https://github.com/AlexAegis/tinyslice/actions?query=workflow%3ACI)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/3862f8fa6e8e4f8a871ed57d446643b3)](https://www.codacy.com/gh/AlexAegis/tinyslice/dashboard?utm_source=github.com&utm_medium=referral&utm_content=AlexAegis/tinyslice&utm_campaign=Badge_Grade)
[![codecov](https://codecov.io/github/AlexAegis/tinyslice/branch/master/graph/badge.svg?token=RBpL3wVtca)](https://codecov.io/github/AlexAegis/tinyslice)

A redux style store implementation aimed to reduce boilerplate code.
This is achieved by consolidating some concepts: Actions are dispatchers by
themselves and slice definitions are selectors too.

Development is meant to be streamlined by only having to import one thing from
the library. Everything else is available from there.

Features:

- Typed, non-polluting\* actions, that act as dispatchers themselves.
  > \*non-polluting: while some metadata (the type of the action) is needed,
  > this library does not mutate the payload to include the type field.
- Slice based selectors. Define a piece of state and you can listen to it
  right on that object.
- Lazy slices
  > Slices can be extended at runtime (Timetravel still works!)
- Redux Devtools integration through [@tinyslice/devtools-plugin](./lib/devtools-plugin/)
  > Timetravel, import/export, commit

Disclaimer:

- Don't create overlapping slices, it will lead to inconsistent behavior.
- Don't define the same slice more than once. If reducers are also defined
  again, they will run as many times as many times they are defined. Reuse
  slices!

Example [`store.ts`](./example/svelte-example/src/store.ts) file:

```ts
import { Scope } from '@tinyslice/core';
import { TinySliceDevtoolPlugin } from '@tinyslice/devtools-plugin';

export interface RootState {
  count: number;
}

export const scope = new Scope();

export const countAction = {
  increment: scope.createAction<number>('[Count] increment'),
  decrement: scope.createAction<number>('[Count] decrement'),
};

scope.createEffect(
  countAction.decrement.pipe(map((a) => a + 1)),
  countAction.increment
);

export const rootStore = scope.createStore<RootState>(
  {
    count: 0,
  },
  [
    countAction.increment.reduce((state, payload) => ({
      ...state,
      count: state.count + payload,
    })),
    countAction.decrement.reduce((state, payload) => ({
      ...state,
      count: state.count - payload,
    })),
  ],
  {
    plugins: [
      new TinySliceDevtoolPlugin({
        name: 'myExampleApp',
      }),
    ],
    useDefaultLogger: true,
  }
);

export const count$ = rootStore.slice('count');

countAction.increment.next(1); // count: 1
countAction.decrement.next(2); // count: 0 then 2 from the effect
```
