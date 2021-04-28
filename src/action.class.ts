import { MonoTypeOperatorFunction, Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

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
	private static readonly registered: Action<any>[] = [];
	private static readonly pool = new Subject<WrappedActionPacket<any>>();
	public static get pool$(): Observable<WrappedActionPacket<any>> {
		return this.pool;
	}

	private config: ActionConfig;

	public static register<T>(action: Action<T>, _type: string, _config: ActionConfig): void {
		Action.registered.push(action as Action<unknown>);
	}

	public constructor(public type: string, config: ActionConfig = {}) {
		super();
		this.config = {
			...DEFAULT_ACTION_CONFIG,
			...config,
		};

		Action.register(this, type, this.config);
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
	return function <T>(target: Action<T>): void {
		Action.register<T>(target, name, {
			...DEFAULT_ACTION_CONFIG,
			...config,
		});
	};
}
