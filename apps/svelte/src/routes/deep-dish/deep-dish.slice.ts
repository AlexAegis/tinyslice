import { rootSlice } from '../../root.slice';

export interface BoxState {
	count: number;
}

export interface DeepDishState {
	dices: Record<string, PieState>;
	boxes: BoxState[];
}

const deepdishSlice$ = rootSlice.addSlice('deepdish', { dices: {}, boxes: [] } as DeepDishState);
const dices$ = deepdishSlice$.slice('dices');

export interface PieState {
	sauce: number;
	cheese: number;
}

const dicer = dices$.dice({
	getAllKeys: (state) => Object.keys(state),

	defineInternals: (slice) => {
		const cheese$ = slice.slice('cheese');
		const sauce$ = slice.slice('sauce');
		return { cheese$, sauce$ };
	},
	initialState: { cheese: 1, sauce: 2 } as PieState,
});

const first = dicer.select('1');

first.slice.internals;

console.log();

const boxes$ = deepdishSlice$.slice('boxes');

const boxDicer = boxes$.dice({
	getAllKeys: (state) => [...state.keys()],
	defineInternals: (boxSlice) => {
		const count$ = boxSlice.slice('count');
		return { count$ };
	},
	initialState: { count: 0 } as BoxState,
});

boxDicer.sliceKeys$;
boxDicer.select(0);
