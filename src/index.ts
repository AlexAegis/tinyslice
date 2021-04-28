import { Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Action } from './action.class';
const o = new Subject();

o.subscribe((a) => console.log(a));

o.next(1);
o.next(2);

const printAction = new Action<string>('printAction');
const countAction = new Action<number>('printAction');

printAction.next('Hello');

Action.pool$.pipe(
	Action.of(printAction, countAction),
	tap((a) => console.log('a1', a.payload))
);

Action.poolOf(printAction).pipe(tap((a) => console.log('a2', a.payload)));
