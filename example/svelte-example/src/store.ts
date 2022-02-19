import { createLoggingMetaReducer, Scope } from 'cqrx';

export interface CountState {
	count: number;
}

export const scope = new Scope();

scope.dispatcher$.subscribe((a) => console.log('di', a));
const increment = scope.createAction<number>('increment');
const decrement = scope.createAction<number>('decrement');

export const countAction = { increment, decrement };

export const countStore = scope.createStore<CountState>(
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
		metaReducers: [createLoggingMetaReducer<CountState>()]
	}
);

export const count$ = countStore.slice('count');
