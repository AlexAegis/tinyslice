import { MonoTypeOperatorFunction, Observable, Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { Scope } from '../store';
import type { PayloadReducer, ReducerConfiguration } from '../store/reducer.type';
import { ActionConfig, DEFAULT_ACTION_CONFIG } from './action-config.interface';
import { ActionPacket } from './action-packet.interface';

export type ActionTuple<T> = {
	[K in keyof T]: Action<T[K]>;
};

/**
 * TODO: Actions should be able to switch or hold multiple scopes
 * TODO: .and method to chain actions for multireducers and multieffects
 */
export class Action<Payload> extends Subject<Payload> {
	#dispatchSubscription?: Subscription;

	private config: ActionConfig;

	public get listen$(): Observable<ActionPacket<Payload>> {
		return this.scope.listen$(this);
	}

	public constructor(
		private readonly scope: Scope,
		public type: string,
		config: Partial<ActionConfig> = DEFAULT_ACTION_CONFIG
	) {
		super();
		this.config = {
			...DEFAULT_ACTION_CONFIG,
			...config,
		};
		if (this.config.autoRegister) {
			this.register();
		}
	}

	public register(): void {
		this.#dispatchSubscription = this.scope.registerAction(this);
	}

	public unregister(): void {
		this.#dispatchSubscription?.unsubscribe();
	}

	public makePacket(payload: Payload): ActionPacket<Payload> {
		return { type: this.type, payload };
	}

	/**
	 * The finalize operator will take care of removing it from the actionMap
	 */
	public unsubscribe(): void {
		this.unregister();
		super.unsubscribe();
	}

	/**
	 *
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
