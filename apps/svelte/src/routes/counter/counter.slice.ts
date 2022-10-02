import { rootSlice, scope } from '../../root.slice';

export const counterActions = {
	increment: scope.createAction<number>('[Count] increment'),
	decrement: scope.createAction<number>('[Count] decrement'),
};

export interface CounterState {
	count: number;
}

export const counterSlice = rootSlice.addSlice<CounterState>('counter', { count: 0 }, [
	counterActions.increment.reduce((state, payload) => ({
		...state,
		count: state.count + payload,
	})),
	counterActions.decrement.reduce((state, payload) => ({
		...state,
		count: state.count - payload,
	})),
]);

export const count$ = counterSlice.slice('count');