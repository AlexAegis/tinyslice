import { rootSlice, scope } from '../../root.slice';

export const counterActions = {
	increment: scope.createAction<number>('[Count] increment'),
	decrement: scope.createAction<number>('[Count] decrement'),
};

export interface CounterState {
	count: number;
}

export const counterSlice = rootSlice.addSlice('counter', { count: 0 } as CounterState, {
	reducers: [
		counterActions.increment.reduce((state, payload) => ({
			...state,
			count: state.count + payload,
		})),
		counterActions.decrement.reduce((state, payload) => ({
			...state,
			count: state.count - payload,
		})),
	],
	defineInternals: (c) => {
		const internalCounter$ = c.addSlice('internalCounter', { internalCount: 2 });
		const internalDirectCounter$ = c.addSlice('internalDirectCounter', 0);

		const internalCount$ = internalCounter$.slice('internalCount');

		const internalNullableCounter$ = c.addSlice(
			'internalNullableCounter',
			undefined as { internalCount: number } | undefined
		);

		//	const set() => internalNullableCounter$.set(undefined as unknown as { internalCount: number })

		const internalNullableCounterCount$ = internalNullableCounter$.slice('internalCount');
		return {
			internalCounter$,
			internalCount$,
			internalDirectCounter$,
			internalNullableCounter$,
			internalNullableCounterCount$,
		};
	},
});

// export const nope$ = counterSlice.slice('nope');

export const count$ = counterSlice.slice('count');
