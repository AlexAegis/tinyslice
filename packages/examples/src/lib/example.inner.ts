import { Scope } from '@tinyslice/core';
import { map, tap } from 'rxjs';

const actionScope = new Scope();

const outerAction = actionScope.createAction<number>('outerAction');
const middleAction = actionScope.createAction<number>('middleAction');

const innerAction = actionScope.createAction<number>('innerAction');

actionScope
	.listenAll$()
	.pipe(tap((a) => console.log(`[${a.type}]`)))
	.subscribe();

export interface ExampleState {
	out: number;
	foo: {
		bar: {
			zed: number;
		};
	};
}

actionScope.createEffect(innerAction.pipe(map((a) => outerAction.makePacket(a + 1))));

const store = actionScope.createRootSlice<ExampleState>(
	{
		out: 1,
		foo: { bar: { zed: 2 } },
	},
	{ reducers: [outerAction.reduce((state) => ({ ...state, out: state.out + 1 }))] }
);

const fooSlice = store.slice('foo', {
	reducers: [middleAction.reduce((state, payload) => ({ ...state, bar: { zed: payload } }))],
});

const barSlice = fooSlice.slice('bar', {
	reducers: [innerAction.reduce((state, payload) => ({ ...state, zed: state.zed + payload }))],
});

store.subscribe((state) => console.log('Full State', JSON.stringify(state)));
fooSlice.subscribe((foo) => console.log('FooSlice', JSON.stringify(foo)));
barSlice.subscribe((bar) => console.log('BarSlice', JSON.stringify(bar)));
// outerAction.next(1);
innerAction.next(1);
middleAction.next(1);
innerAction.next(1);
innerAction.next(1);
// middleAction.next(0);
// innerAction.next(1);
