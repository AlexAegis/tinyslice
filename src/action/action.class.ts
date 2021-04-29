import { MonoTypeOperatorFunction, Observable, Subject, Subscription } from 'rxjs';
import { filter, finalize, map } from 'rxjs/operators';
import { ActionConfig, DEFAULT_ACTION_CONFIG } from './action-config.interface';
import { ActionPacket } from './action-packet.interface';

export type ActionTuple<T> = {
	[K in keyof T]: Action<T[K]>;
};

export class ActionAlreadyRegisteredError extends Error {
	constructor(action: Action<never>) {
		super(`Action ${action.type} already registered!`);
	}
}

export class Action<T> extends Subject<T> {
	private static readonly _dispatcher = new Subject<ActionPacket<never>>();
	private static readonly _actionMap = new Map<string, Action<never>>();
	private _dispatchSubscription?: Subscription;
	public static get dispatcher(): Observable<ActionPacket<never>> {
		return this._dispatcher;
	}

	private config: ActionConfig;

	public static register<T extends never>(action: Action<T>): void {
		if (Action._actionMap.has(action.type)) {
			throw new ActionAlreadyRegisteredError(action);
		}
		Action._actionMap.set(action.type, action);

		action._dispatchSubscription = action
			.pipe(
				map((payload) => ({ type: action.type, payload })),
				finalize(() => Action._actionMap.delete(action.type))
			)
			.subscribe(Action._dispatcher);
	}

	public static isRegistered<T>(action?: Action<T> | string): boolean {
		if (!action) {
			return false;
		}
		let type: string;
		if (typeof action === 'string') {
			type = action;
		} else {
			type = action.type;
		}
		return Action._actionMap.has(type);
	}

	public static getRegistered<T>(type: string): Action<T> | undefined {
		return this._actionMap.get(type) as Action<T> | undefined;
	}

	public static emit<T>(type: string, payload: T): void {
		Action.getRegistered<T>(type)?.next(payload);
	}

	/**
	 * The finalize operator will take care of removing it from the actionMap
	 */
	public unsubscribe(): void {
		super.unsubscribe();
		this._dispatchSubscription?.unsubscribe();
	}

	public constructor(public type: string, config: Partial<ActionConfig> = {}) {
		super();
		this.config = {
			...DEFAULT_ACTION_CONFIG,
			...config,
		};
		if (this.config.autoRegister) {
			Action.register((this as unknown) as Action<never>);
		}
	}

	/**
	 *
	 * @deprecated
	 */
	public filter(): MonoTypeOperatorFunction<ActionPacket<T>> {
		return <T>(source: Observable<ActionPacket<T>>) =>
			source.pipe(filter((value) => value.type === this.type));
	}

	public static of<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): MonoTypeOperatorFunction<ActionPacket<T[number]>> {
		const allowedTypes = new Set<string>(actions.map((action) => action.type));
		return (source: Observable<ActionPacket<T[number]>>) =>
			source.pipe(filter((value) => allowedTypes.has(value.type)));
	}

	public static dispatcherOf<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): Observable<ActionPacket<T[number]>> {
		return this.dispatcher.pipe(Action.of(...actions));
	}
}
