import { mapTo, tap } from 'rxjs/operators';
import { Action } from './action.class';
import { Effect } from './effect.class';

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

// Do I really need effects? I can just use the action itself since it is also
// the dispatcher
Effect.from(
	Action.poolOf(countAction).pipe(mapTo({ type: printAction.type, payload: 'eat this' }))
);

printAction.next('Hello');
countAction.next(12);
