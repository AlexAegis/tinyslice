import { Scope } from '@tinyslice/core';

interface RootState {
	foo: number;
}
const scope = new Scope();

const rootSlice$ = scope.createRootSlice({ foo: 1 } as RootState);
const foo$ = rootSlice$.slice('foo');

foo$.subscribe((next) => {
	console.log(`foo$: ${JSON.stringify(next)}`);
});
rootSlice$.subscribe((next) => {
	console.log(`rootSlice$: ${JSON.stringify(next)}`);
});

rootSlice$.set({ foo: 4 });
foo$.set(2);
