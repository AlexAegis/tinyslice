import { Scope } from 'cqrx';

export interface RootState {
	count: number;
}

export const scope = new Scope();

const increment = scope.createAction<number>('[Count] increment');
const decrement = scope.createAction<number>('[Count] decrement');

export const countAction = { increment, decrement };

export const rootStore = scope.createStore<RootState>(
	{
		count: 0
	},
	[
		increment.reduce((state, payload) => ({
			...state,
			count: state.count + payload
		})),
		decrement.reduce((state, payload) => ({
			...state,
			count: state.count - payload
		}))
	],
	{
		devtoolsPluginOptions: {
			name: 'myExampleApp'
		},
		useDefaultLogger: true
	}
);

export const count$ = rootStore.slice('count');
