export * from './action';
export * from './effect';

import { mapTo, tap } from 'rxjs/operators';
import { Action } from './action/action.class';
import { Effect } from './effect/effect.class';

const printAction = new Action<string>('printAction');
const countAction = new Action<number>('countAction');

Action.dispatcher$
	.pipe(
		Action.makeFilter(printAction, countAction),
		tap((a) => console.log('a1', a.payload))
	)
	.subscribe();

printAction.listen$.pipe(tap((a) => console.log(a)));

Action.listen$(printAction)
	.pipe(tap((a) => console.log('a2', a.payload)))
	.subscribe();

// Do I really need effects? I can just use the action itself since it is also
// the dispatcher
Effect.from(
	Action.listen$(countAction).pipe(mapTo({ type: printAction.type, payload: 'eat this' }))
);

countAction;

printAction.next('Hello');
countAction.next(12);

Action.unsubscribeAll();
