import {
	asyncScheduler,
	EMPTY,
	filter,
	MonoTypeOperatorFunction,
	Observable,
	Subject,
	Subscription,
	throttleTime,
} from 'rxjs';
import { ifLatestFrom, isNonNullable } from '../helper';
import type { Scope } from '../store';
import type { ActionReducer, ReducerConfiguration } from '../store/reducer.type';
import { ActionConfig, DEFAULT_ACTION_CONFIG } from './action-config.interface';
import { ActionPacket } from './action-packet.interface';

export type ActionTuple<T> = {
	[K in keyof T]: Action<T[K]>;
};

export type ActionDispatch = () => void;

/**
 * TODO: Actions should be able to switch or hold multiple scopes
 * TODO: .and method to chain actions for multireducers and multieffects
 */
export class Action<Payload = void> extends Subject<Payload> {
	#dispatchSubscription?: Subscription;

	private config: ActionConfig;

	private scope: Scope | undefined;

	public registrations = new Subscription();

	/**
	 * This will emit every action of this type, both direct dispatches and
	 * effect dispatches
	 */
	public get listenPackets$(): Observable<ActionPacket<Payload>> {
		return this.scope?.listen$(this) ?? EMPTY;
	}

	/**
	 * This won't receive actions from effects
	 */
	public get listen$(): Observable<Payload> {
		return this.#actionPipeline;
	}

	#actionPipeline: Observable<Payload>;

	//	override subscribe;

	/**
	 * TODO: Make this private, refactor angular solution
	 * @param type
	 * @param config
	 */
	public constructor(public type: string, config: Partial<ActionConfig> = DEFAULT_ACTION_CONFIG) {
		super();
		this.config = {
			...DEFAULT_ACTION_CONFIG,
			...config,
		};

		this.#actionPipeline = this;

		if (isNonNullable(this.config.pauseWhile)) {
			this.#actionPipeline = this.#actionPipeline.pipe(
				ifLatestFrom(this.config.pauseWhile, (paused) => !paused)
			);
		}

		if (isNonNullable(this.config.throttleTime)) {
			this.#actionPipeline = this.#actionPipeline.pipe(
				throttleTime(this.config.throttleTime, asyncScheduler, {
					leading: true,
					trailing: true,
				})
			);
		}

		// this.subscribe = this.#actionPipeline.subscribe.bind(this.#actionPipeline);
	}

	public register(scope: Scope): this {
		this.scope = scope;
		this.#dispatchSubscription = this.scope.registerAction(this, true);
		return this;
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
	public override complete(): void {
		this.unregister();
		this.registrations.unsubscribe();
		this.unsubscribe();
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
		actionReducer: ActionReducer<State, Payload>
	): ReducerConfiguration<State, Payload> {
		return {
			packetReducer: (state: State, actionPacket: ActionPacket<Payload> | undefined): State =>
				actionPacket ? actionReducer(state, actionPacket.payload) : state,
			action: this,
		};
	}
}
