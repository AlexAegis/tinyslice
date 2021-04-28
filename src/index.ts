import { tap } from 'rxjs/operators';
import { Action } from './action.class';

const printAction = new Action<string>('printAction');
const countAction = new Action<number>('countAction');

Action.pool$
	.pipe(
		Action.of(printAction, countAction),
		tap((a) => console.log('a1', a.payload))
	)
	.subscribe();

Action.poolOf(printAction)
	.pipe(tap((a) => console.log('a2', a.payload)))
	.subscribe();

printAction.next('Hello');
countAction.next(12);
