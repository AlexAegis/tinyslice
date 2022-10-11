# tinyslice 🍕

[![Latest NPM Version](https://img.shields.io/npm/v/@tinyslice/core/latest)](https://www.npmjs.com/package/@tinyslice/core)
[![CI](https://github.com/AlexAegis/tinyslice/workflows/CI/badge.svg)](https://github.com/AlexAegis/tinyslice/actions?query=workflow%3ACI)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/3862f8fa6e8e4f8a871ed57d446643b3)](https://www.codacy.com/gh/AlexAegis/tinyslice/dashboard?utm_source=github.com&utm_medium=referral&utm_content=AlexAegis/tinyslice&utm_campaign=Badge_Grade)
[![codecov](https://codecov.io/github/AlexAegis/tinyslice/branch/master/graph/badge.svg?token=RBpL3wVtca)](https://codecov.io/github/AlexAegis/tinyslice)

Reactive state management

Check out the example projects in this repository and my
[Minesweeper clone](https://github.com/AlexAegis/svelte-minesweeper) build
using this.

```ts
import { Scope } from '@tinyslice/core';
import { TinySliceDevtoolPlugin } from '@tinyslice/devtools-plugin';
import { TinySliceHydrationPlugin } from '@tinyslice/hydration-plugin';

const scope = new Scope();

interface RootSlice {
  count: number;
}
const rootSlice$ = scope.createRootSlice({ count: 1, pies: {} } as RootSlice, {
  plugins: [
    new TinySliceDevtoolPlugin({
      name: 'myExampleApp',
    }),
  ],
  useDefaultLogger: true,
});

const increment = scope.createAction('increment');
const countSlice$ = rootSlice$.slice('count', {
  reducers: [increment.reduce((state) => state + 1)],
});

countSlice$.subscribe((count) => console.log('count', count));
increment.next(); // Use custom action to trigger reducer
countSlice$.set(10); // Use premade actions and reducers

// "Entity" pattern.
export interface PieState {
  sauce: number;
  cheese: number;
}

// This creates 2 layes at once, the first one is a Record<number, PieState>
const pieDicer = rootSlice$.addDicedSlice('pies', {
  initialState: { cheese: 0, sauce: 0 } as PieState,
  defineInternals: (slice) => {
    const cheese$ = slice.slice('cheese');
    const sauce$ = slice.slice('sauce');
    return { cheese$, sauce$ };
  },
  // Plugins can be anywhere, save this slice to localstorage and read as initialised!
  plugins: [new TinySliceHydrationPlugin<PieState>('pies')],
});

// To get a specific entity slice
const firstPie = pieDicer.get(1);

firstPie.internals.cheese$.subscribe((cheese) => console.log('cheese', cheese));
firstPie.internals.cheese$.set(2);

// To handle all at once
pieDicer.latestSlices$.subscribe((pieSliceArray) =>
  console.log('pieSliceArray', JSON.stringify(pieSliceArray))
);

pieDicer.set(2, { cheese: 12, sauce: 13 });
```
