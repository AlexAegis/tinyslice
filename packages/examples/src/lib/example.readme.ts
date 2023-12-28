import { Scope } from '@tinyslice/core';
import { TinySliceDevtoolPlugin } from '@tinyslice/devtools-plugin';
// import { TinySliceHydrationPlugin } from '@tinyslice/hydration-plugin';

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
});

const increment = scope.createAction('increment');
const countSlice$ = rootSlice$.slice('count', {
	reducers: [increment.reduce((state) => state + 1)],
});

countSlice$.subscribe((count) => {
	console.log('count', count);
});
increment.next(); // Use custom action to trigger reducer
countSlice$.set(10); // Use premade actions and reducers

// "Entity" pattern.
export interface PieState {
	sauce: number;
	cheese: number;
}

const pieDicer = rootSlice$.addDicedSlice('pies', { cheese: 0, sauce: 0 } as PieState, {
	defineInternals: (slice) => {
		const cheese$ = slice.slice('cheese');
		const sauce$ = slice.slice('sauce');
		return { cheese$, sauce$ };
	},
	// Plugins can be anywhere, save this slice to localstorage and read as initialised!
	// plugins: [new TinySliceHydrationPlugin<PieState>('pies')],
});

// To get a specific entity slice
const firstPie = pieDicer.get(1);

firstPie.internals.cheese$.subscribe((cheese) => {
	console.log('cheese', cheese);
});
firstPie.internals.cheese$.set(2);

pieDicer.set(2, { cheese: 12, sauce: 13 });
