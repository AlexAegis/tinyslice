import { Observable } from 'rxjs';
import { Scope } from './scope.class.js';

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
				.map((key) => Number.parseInt(key, 10))
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

export interface FigureThisOneOut {
	cheese$: Observable<number>;
	sauce$: Observable<number>;
}

const pieDicer = piesSlice$.dice({ cheese: 1, sauce: 2 } as PieState, {
	getAllKeys: (state) => Object.keys(state),
	getNextKey: (keys) =>
		(
			keys.map((key) => Number.parseInt(key, 10)).reduce((a, b) => (a > b ? a : b), 0) + 1
		).toString(),
	defineInternals: (slice) => {
		console.log('pie internals defined');
		const cheese$ = slice.slice('cheese');
		const sauce$ = slice.slice('sauce');
		return { cheese$, sauce$, a: 2 };
	},
});

// pieDicer.sliceKeys$.subscribe((pieKey) => console.log('pieKey', pieKey));

const firstPie = pieDicer.get('1');
firstPie.subscribe((p) => console.log('reading first pie! might not exist!', p));

const firstPieCheese = firstPie.slice('cheese');
firstPieCheese.subscribe((c) => console.log('asgfaerge', c));
pieDicer.set('2', { cheese: 3, sauce: 5 });

pieDicer.set('1', { cheese: 32, sauce: 53 });
pieDicer.set('1', { cheese: 323, sauce: 453 });

firstPie.internals.cheese$.subscribe((cheese) => console.log('cheese', cheese));
/*
firstPie.internals.cheese$.set(2);
console.log('firstPie.slice.internals.cheese$', firstPie.internals.cheese$.absolutePath);

const boxes$ = deepdishSlice$.slice('boxes');

export const boxDicer = boxes$.dice({ count: 0 } as BoxState, {
	getAllKeys: (state) => [...state.keys()],
	getNextKey: (keys) => keys.reduce((a, b) => (a > b ? a : b), 0) + 1,
	defineInternals: (_boxSlice) => 1,
});
*/
