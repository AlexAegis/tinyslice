import { rootSlice } from '../../root.slice.js';

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

export interface PieState {
	sauce: number;
	cheese: number;
}

const pies$ = deepdishSlice$.slice('pies');

export const pieDicer = pies$.dice({ cheese: -1, sauce: -1 } as PieState, {
	getAllKeys: (state) => Object.keys(state),
	getNextKey: (keys) =>
		(
			keys.map((key) => Number.parseInt(key, 10)).reduce((a, b) => (a > b ? a : b), 0) + 1
		).toString(),
	defineInternals: (slice) => {
		const pieActions = {
			clearCheese: slice.createAction('clear cheese'),
			clearSauce: slice.createAction('clear sauce', { throttleTime: 300 }),
		};

		const cheese$ = slice.slice('cheese', {
			reducers: [pieActions.clearCheese.reduce(() => 0)],
		});
		const sauce$ = slice.slice('sauce', {
			reducers: [pieActions.clearSauce.reduce(() => 0)],
		});

		return { cheese$, sauce$, pieActions };
	},
});

const boxes$ = deepdishSlice$.slice('boxes');
export const boxDicer = boxes$.dice({ count: 0 } as BoxState, {
	getAllKeys: (state) => [...state.keys()],
	getNextKey: (keys) => keys.reduce((a, b) => (a > b ? a : b), 0) + 1,
	defineInternals: (boxSlice) => {
		const count$ = boxSlice.slice('count');
		return { count$ };
	},
});
