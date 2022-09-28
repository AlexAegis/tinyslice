import { Scope } from '@tinyslice/core';
import { TinySliceDevtoolPlugin } from '@tinyslice/devtools-plugin';

export interface RootState {
	count: number;
}

export const scope = new Scope();

export const countAction = {
	increment: scope.createAction<number>('[Count] increment'),
	decrement: scope.createAction<number>('[Count] decrement')
};

// scope.createEffect(countAction.decrement.pipe(map((a) => a + 1)), countAction.increment);

export const rootSlice = scope.createRootSlice<RootState>(
	{
		count: 0
	},
	[
		countAction.increment.reduce((state, payload) => ({
			...state,
			count: state.count + payload
		})),
		countAction.decrement.reduce((state, payload) => ({
			...state,
			count: state.count - payload
		}))
	],
	{
		plugins: [
			new TinySliceDevtoolPlugin({
				name: 'myExampleApp'
			})
		],
		useDefaultLogger: true
	}
);

export const count$ = rootSlice.slice('count');
