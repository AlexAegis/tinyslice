import { map, tap } from 'rxjs/operators';
import { Scope } from './store/scope.class';

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
actionScope.createEffect(innerAction.pipe(map((a) => a + 1)), outerAction);

const store = actionScope.createStore<ExampleState>(
	{
		out: 1,
		foo: { bar: { zed: 2 } },
	},
	[outerAction.reduce((state) => ({ ...state, out: state.out + 1 }))]
);

const fooSlice = store.slice<'foo'>('foo', [
	middleAction.reduce((state, payload) => ({ ...state, bar: { zed: payload } })),
]);

const barSlice = fooSlice.slice<{ zed: number }>(
	(state) => state.bar,
	(bar) => ({ bar }),
	[innerAction.reduce((state, payload) => ({ ...state, zed: state.zed + payload }))]
);

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
