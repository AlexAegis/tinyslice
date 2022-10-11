import { getNextLargestNumber, getObjectKeysAsNumbers } from '../lib/helper';
import { Scope } from '../lib/store';

const scope = new Scope();

interface RootSlice {
	count: number;
	pies: Record<number, PieState>;
}
const rootSlice$ = scope.createRootSlice({ count: 1, pies: {} } as RootSlice, {});

const increment = scope.createAction('increment');
const countSlice$ = rootSlice$.slice('count', {
	reducers: [increment.reduce((state) => state + 1)],
});

countSlice$.subscribe((count) => console.log('count', count));
increment.next(); // Use custom action to trigger reducer
countSlice$.set(10); // Use premade actions and reducers

// "Entity" pattern.
const piesSlice$ = rootSlice$.slice('pies');
export interface PieState {
	sauce: number;
	cheese: number;
}

const pieDicer = piesSlice$.dice({
	getAllKeys: getObjectKeysAsNumbers,
	getNextKey: getNextLargestNumber,
	defineInternals: (slice) => {
		const cheese$ = slice.slice('cheese');
		const sauce$ = slice.slice('sauce');
		return { cheese$, sauce$ };
	},
	initialState: { cheese: 0, sauce: 0 } as PieState,
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
