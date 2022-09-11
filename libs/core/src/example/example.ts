import { map, tap } from 'rxjs/operators';
import { Scope } from '../lib/store';

const scope = Scope.createScope();
const printAction = scope.createAction<string>('printAction');
const countAction = scope.createAction<number>('countAction');

const innerAction = scope.createAction<number>('innerAction');

scope
	.listenAll$()
	.pipe(tap((a) => console.log(`[${a.type}]`)))
	.subscribe();

scope
	.listen$(printAction)
	.pipe(tap((a) => console.log('a2', a.payload)))
	.subscribe();

scope.createEffect(countAction.pipe(map((c) => `FROM EFFECT Count called with ${c}`)));

// printAction.next('Hello');
// countAction.next(12);

export interface ExampleState {
	lastPrinted: string | undefined;
	lastCounted: number | undefined;
	foo: {
		bar: {
			zed: number;
		};
	};
	ger: {
		ber: {
			yon: number;
		};
	};
}

const store = scope.createStore<ExampleState>(
	{
		lastPrinted: undefined,
		lastCounted: undefined,
		foo: { bar: { zed: 2 } },
		ger: { ber: { yon: 3 } },
	},
	[
		printAction.reduce((state, payload) => ({ ...state, lastPrinted: payload })),
		countAction.reduce((state, payload) => ({ ...state, lastCounted: payload })),
	]
);

store.subscribe((state) => console.log('Full State', JSON.stringify(state)));

const lastPrintedSlice = store.sliceSelect<ExampleState['lastPrinted']>(
	(state) => state.lastPrinted,
	(state, lastPrinted) => ({ ...state, lastPrinted }),
	[innerAction.reduce((state, payload) => `${state}${payload}`)]
);

const fooSlice = store.slice<'foo'>('foo', [
	printAction.reduce((state, payload) => {
		console.log('diced foo print', payload);
		return { ...state, bar: { zed: state.bar.zed + 1 } };
	}),
	innerAction.reduce((state, payload) => {
		console.log('inner action just ran');
		return { ...state, bar: { zed: payload } };
	}),
]);

const barSlice = fooSlice.sliceSelect(
	(state) => state.bar,
	(state, bar) => ({ ...state, bar })
);

barSlice.subscribe((bar) => console.log('bar', bar));
lastPrintedSlice.subscribe((lastPrinted) => console.log('lastPrinted', lastPrinted));

barSlice.set({ zed: 2 });
innerAction.next(1);
printAction.next('Hello!');
printAction.next('World!');
countAction.next(9);
innerAction.next(1);

innerAction.next(1);

const newBarSlice = barSlice.addSlice<{ ns: number }>('newBarSlice', { ns: 1 }, [
	countAction.reduce((s) => ({ ...s, ns: s.ns + 1 })),
]);

newBarSlice.pipe(map((a) => a?.ns)).subscribe((ns) => console.log('ns', ns));
