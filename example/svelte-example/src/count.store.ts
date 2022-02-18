import { Action, Store } from 'cqrx';

export interface CountState {
	count: number;
}

const increment = new Action<number>('increment');
const decrement = new Action<number>('decrement');

export const countAction = { increment, decrement };

export const countStore = new Store<CountState>(
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
	]
);

export const count$ = countStore.slice('count');
