import { rootSlice } from '../../root.slice';

export interface BoxState {
	count: number;
}

export interface DeepDishState {
	pies: Record<string, PieState>;
	boxes: BoxState[];
}

export const deepdishSlice$ = rootSlice.addSlice('deepdish', {
	pies: {},
	boxes: [],
} as DeepDishState);
export const pies$ = deepdishSlice$.slice('pies');

export interface PieState {
	sauce: number;
	cheese: number;
}

export const pieDicer = pies$.dice({
	getAllKeys: (state) => Object.keys(state),
	getNextKey: (keys) =>
		(keys.map((key) => parseInt(key, 10)).reduce((a, b) => (a > b ? a : b), 0) + 1).toString(),
	defineInternals: (slice) => {
		const pieActions = {
			clearCheese: slice.createScopedAction<void>('clear cheese'),
			clearSauce: slice.createScopedAction<void>('clear sauce'),
		};

		const cheese$ = slice.slice('cheese', {
			reducers: [pieActions.clearCheese.reduce(() => 0)],
		});
		const sauce$ = slice.slice('sauce', {
			reducers: [pieActions.clearSauce.reduce(() => 0)],
		});

		return { cheese$, sauce$, pieActions };
	},
	initialState: { cheese: 1, sauce: 2 } as PieState,
});

const boxes$ = deepdishSlice$.slice('boxes');

const boxDicer = boxes$.dice({
	getAllKeys: (state) => [...state.keys()],
	getNextKey: (keys) => keys.reduce((a, b) => (a > b ? a : b), 0) + 1,
	defineInternals: (boxSlice) => {
		const count$ = boxSlice.slice('count');
		return { count$ };
	},
	initialState: { count: 0 } as BoxState,
});

boxDicer.sliceKeys$;
boxDicer.get(0);
