import { Observable } from 'rxjs';
import { Scope } from '../lib/store';

interface RootSlice {
	foo: number;
}
const scope = new Scope();

const rootSlice$ = scope.createRootSlice({ foo: 1 } as RootSlice, {
	defineInternals: (rootSlice) => {
		return { fooCount$: rootSlice.slice('foo') };
	},
});

rootSlice$.internals;

export interface BoxState {
	count: number;
}

export type PieKey = string;

export interface DeepDishState {
	pies: Record<PieKey, PieState>;
	boxes: BoxState[];
}

const deepdishSlice$ = rootSlice$.addSlice('deepdish', { pies: {}, boxes: [] } as DeepDishState, {
	defineInternals: (_s) => 1,
});

const externalPiesActions = {
	createPie: scope.createAction('external create pie'),
	removePie: scope.createAction<PieKey>('external remove pie'),
};

const piesSlice$ = deepdishSlice$.slice('pies', {
	defineInternals: () => 1,
	reducers: [
		externalPiesActions.createPie.reduce((state, _s) => {
			const nextKey = Object.keys(state)
				.map((key) => parseInt(key, 10))
				.reduce((a, b) => (a > b ? a : b), 0);
			console.log('get next key', nextKey);
			return { ...state, [nextKey.toString()]: { cheese: -1, sauce: -1 } };
		}),
	],
});

export interface PieState {
	sauce: number;
	cheese: number;
}

export type FigureThisOneOut = { cheese$: Observable<number>; sauce$: Observable<number> };

const pieDicer = piesSlice$.dice({
	getAllKeys: (state) => Object.keys(state),
	getNextKey: (keys) =>
		(keys.map((key) => parseInt(key, 10)).reduce((a, b) => (a > b ? a : b), 0) + 1).toString(),
	defineInternals: (slice) => {
		const cheese$ = slice.slice('cheese');
		const sauce$ = slice.slice('sauce');
		return { cheese$, sauce$, a: 2 };
	},
	initialState: { cheese: 1, sauce: 2 } as PieState,
});

// pieDicer.sliceKeys$.subscribe((pieKey) => console.log('pieKey', pieKey));

const firstPie = pieDicer.get('1');

firstPie.slice.internals.cheese$.subscribe((cheese) => console.log('cheese', cheese));
firstPie.slice.internals.cheese$.set(2);
console.log('firstPie.slice.internals.cheese$', firstPie.slice.internals.cheese$.absolutePath);

const boxes$ = deepdishSlice$.slice('boxes');

const boxDicer = boxes$.dice({
	getAllKeys: (state) => [...state.keys()],
	getNextKey: (keys) => keys.reduce((a, b) => (a > b ? a : b), 0) + 1,
	defineInternals: (_boxSlice) => 1,
	initialState: { count: 0 } as BoxState,
});

boxDicer.sliceKeys$;
boxDicer.get(0);
