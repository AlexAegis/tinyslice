import { MonoTypeOperatorFunction, Observable, Subject, Subscription } from 'rxjs';
import { filter, finalize, map } from 'rxjs/operators';

export interface ActionConfig {
	name?: string;
}

export const DEFAULT_ACTION_CONFIG: ActionConfig = {
	name: 'Unnamed Action',
};

export interface WrappedActionPacket<T> {
	type: string;
	payload: T;
}

export type ActionTuple<T> = {
	[K in keyof T]: Action<T[K]>;
};

export type WrappedActionPacketTuple<T> = {
	[K in keyof T]: WrappedActionPacket<T[K]>;
};

/**
 * Union type of a tuple
 * Union<[number, string]> === number | string
 */
export type Union<T extends unknown[]> = T[number];

export class Action<T> extends Subject<T> {
	private static readonly pool = new Subject<WrappedActionPacket<never>>();
	private static readonly poolMap = new Map<string, Action<never>>();
	private subscription?: Subscription;
	public static get pool$(): Observable<WrappedActionPacket<never>> {
		return this.pool;
	}

	private config: ActionConfig;

	public static register<T extends never>(
		action: Action<T>,
		type: string,
		_config: ActionConfig
	): void {
		Action.poolMap.set(type, action);

		action.subscription = action
			.pipe(
				map((payload) => ({ type, payload })),
				finalize(() => Action.poolMap.delete(action.type))
			)
			.subscribe(Action.pool);
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
		return Action.poolMap.has(type);
	}

	public static getRegistered<T>(type: string): Action<T> | undefined {
		return this.poolMap.get(type) as Action<T> | undefined;
	}

	public static emit<T>(type: string, payload: T): void {
		Action.getRegistered<T>(type)?.next(payload);
	}

	public unregister(): void {
		this.subscription?.unsubscribe();
	}

	public constructor(public type: string, config: ActionConfig = {}) {
		super();
		this.config = {
			...DEFAULT_ACTION_CONFIG,
			...config,
		};

		Action.register((this as unknown) as Action<never>, type, this.config);
	}

	/**
	 *
	 * @deprecated
	 */
	public filter(): MonoTypeOperatorFunction<WrappedActionPacket<T>> {
		return <T>(source: Observable<WrappedActionPacket<T>>) =>
			source.pipe(filter((value) => value.type === this.type));
	}

	public static of<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): MonoTypeOperatorFunction<WrappedActionPacket<T[number]>> {
		const allowedTypes = new Set<string>(actions.map((action) => action.type));
		return (source: Observable<WrappedActionPacket<T[number]>>) =>
			source.pipe(filter((value) => allowedTypes.has(value.type)));
	}

	public static poolOf<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): Observable<WrappedActionPacket<T[number]>> {
		return this.pool$.pipe(Action.of(...actions));
	}
}

export function RegisterAction(name: string, config: ActionConfig = {}) {
	return function (target: Action<never>): void {
		Action.register(target, name, {
			...DEFAULT_ACTION_CONFIG,
			...config,
		});
	};
}
