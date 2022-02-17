import { tap } from 'rxjs/operators';
import { Action } from './action/action.class';
import { Store } from './store';

const outerAction = new Action<number>('outerAction');
const innerAction = new Action<number>('innerAction');

Action.listenAll$()
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

const store = new Store<ExampleState>(
	{
		out: 1,
		foo: { bar: { zed: 2 } },
	},
	[outerAction.reduce((state) => ({ ...state, out: state.out + 1 }))]
);

const fooSlice = store.slice<'foo'>('foo');

const barSlice = fooSlice.slice<{ zed: number }>(
	(state) => state.bar,
	(bar) => ({ bar }),
	[innerAction.reduce((state, payload) => ({ ...state, zed: state.zed + payload }))]
);

store.subscribe((state) => console.log('Full State', JSON.stringify(state)));
fooSlice.subscribe((foo) => console.log('FooSlice', JSON.stringify(foo)));
barSlice.subscribe((bar) => console.log('BarSlice', JSON.stringify(bar)));
outerAction.next(1);
innerAction.next(1);
