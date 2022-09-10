import { Scope } from '../lib/store';

const scope = Scope.createScope();
const printAction = scope.createAction<string>('printAction');
const countAction = scope.createAction<number>('countAction');

export interface ExampleState {
	lastPrinted: string | undefined;
	count: number;
}

const store$ = scope.createStore<ExampleState>(
	{
		lastPrinted: undefined,
		count: 0,
	},
	[
		printAction.reduce((state, payload) => ({ ...state, lastPrinted: payload })),
		// countAction.reduce((state, payload) => ({ ...state, count: state.count + payload })),
	]
);

const count$ = store$.slice('count', [countAction.reduce((state, payload) => state + payload)]);

store$.subscribe((state) => console.log('Full State', JSON.stringify(state)));
count$.subscribe((count) => console.log('count', count));

countAction.next(9);
countAction.next(-2);
