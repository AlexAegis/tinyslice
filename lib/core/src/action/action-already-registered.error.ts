import type { Action } from './action.class';

export class ActionAlreadyRegisteredError<T> extends Error {
	constructor(action: Action<T>) {
		super(`Action ${action.type} already registered!`);
	}
}
