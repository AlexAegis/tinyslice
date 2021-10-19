import { MonoTypeOperatorFunction, Observable, Subject, Subscription } from 'rxjs';
import { filter, finalize, map } from 'rxjs/operators';
import { PayloadReducer, ReducerConfiguration } from '../store/reducer.type';
import { ActionConfig, DEFAULT_ACTION_CONFIG } from './action-config.interface';
import { ActionPacket } from './action-packet.interface';

export type ActionTuple<T> = {
	[K in keyof T]: Action<T[K]>;
};

export class ActionAlreadyRegisteredError<T> extends Error {
	constructor(action: Action<T>) {
		super(`Action ${action.type} already registered!`);
	}
}

export class Action<Payload> extends Subject<Payload> {
	private static readonly globalDispatcher$ = new Subject<ActionPacket<unknown>>();
	private static readonly globalActionMap = new Map<string, Action<unknown>>();
	public static readonly dispatcher$ = this.globalDispatcher$.asObservable();

	public static VOID = new Action('[Void]');

	#dispatchSubscription?: Subscription;

	private config: ActionConfig;

	public get listen$(): Observable<ActionPacket<Payload>> {
		return Action.listen$(this);
	}

	public static register<T>(action: Action<T>): void {
		if (Action.globalActionMap.has(action.type)) {
			return;
			// throw new ActionAlreadyRegisteredError(action);
		}
		Action.globalActionMap.set(action.type, action as Action<unknown>);

		action.#dispatchSubscription = action
			.pipe(
				map((payload) => action.makePacket(payload)),
				finalize(() => Action.globalActionMap.delete(action.type))
			)
			.subscribe(Action.globalDispatcher$);
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
		return Action.globalActionMap.has(type);
	}

	public static getRegistered<T>(type: string): Action<T> | undefined {
		return this.globalActionMap.get(type) as Action<T> | undefined;
	}

	public static next<Payload>(type: string, payload: Payload): void {
		Action.getRegistered<Payload>(type)?.next(payload);
	}

	public static unsubscribeAll(): void {
		Action.globalActionMap.forEach((a) => a.unsubscribe());
	}

	public constructor(public type: string, config: Partial<ActionConfig> = DEFAULT_ACTION_CONFIG) {
		super();
		this.config = {
			...DEFAULT_ACTION_CONFIG,
			...config,
		};
		if (this.config.autoRegister) {
			Action.register(this as unknown as Action<never>);
		}
	}

	public makePacket(payload: Payload): ActionPacket<Payload> {
		return { type: this.type, payload };
	}
	/**
	 * The finalize operator will take care of removing it from the actionMap
	 */
	public unsubscribe(): void {
		super.unsubscribe();
		this.#dispatchSubscription?.unsubscribe();
	}

	/**
	 *
	 * @deprecated
	 */
	public getFilter(): MonoTypeOperatorFunction<ActionPacket<Payload>> {
		return <T>(source: Observable<ActionPacket<T>>) =>
			source.pipe(filter((value) => value.type === this.type));
	}

	public static makeFilter<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): MonoTypeOperatorFunction<ActionPacket<T[number]>> {
		const allowedTypes = new Set<string>(actions.map((action) => action.type));
		return (source: Observable<ActionPacket<T[number]>>) =>
			source.pipe(filter((value) => allowedTypes.has(value.type)));
	}

	public static listen$<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): Observable<ActionPacket<T[number]>> {
		return this.globalDispatcher$.pipe(Action.makeFilter(...actions));
	}

	public reduce<State>(
		payloadReducer: PayloadReducer<State, Payload>
	): ReducerConfiguration<State, Payload> {
		return {
			packetReducer: (state: State, actionPacket: ActionPacket<Payload>) =>
				payloadReducer(state, actionPacket.payload),
			action: this,
		};
	}
}
