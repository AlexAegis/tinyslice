import { Scope } from '../lib/store';

interface RootSlice {
	foo: number;
}
const scope = new Scope();

const rootSlice$ = scope.createRootSlice<RootSlice>({ foo: 1 });
const foo$ = rootSlice$.slice('foo');

foo$.subscribe((next) => console.log(`foo$: ${JSON.stringify(next)}`));
rootSlice$.subscribe((next) => console.log(`rootSlice$: ${JSON.stringify(next)}`));

rootSlice$.set({ foo: 4 });
foo$.set(2);
