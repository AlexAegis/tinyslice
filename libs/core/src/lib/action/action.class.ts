import { EMPTY, merge, MonoTypeOperatorFunction, Observable, Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { Scope } from '../store';
import type { ActionReducer, ReducerConfiguration } from '../store/reducer.type';
import { ActionConfig, DEFAULT_ACTION_CONFIG } from './action-config.interface';
import { ActionPacket } from './action-packet.interface';

export type ActionTuple<T> = {
	[K in keyof T]: Action<T[K]>;
};

export class CombinedActions<Payload extends readonly unknown[]> {
	combinedActions: Observable<ActionPacket<Payload[number]>>;
	constructor(chain?: CombinedActions<Payload>, ...action: [...ActionTuple<Payload>]) {
		this.combinedActions = merge(...action.map((a) => a.listen$));
	}

	and<T extends readonly unknown[]>(
		...action: [...ActionTuple<Payload>]
	): CombinedActions<Payload | T> {
		return new CombinedActions(this, ...action);
	}
}

export type ActionDispatch = () => void;

/**
 * TODO: Actions should be able to switch or hold multiple scopes
 * TODO: .and method to chain actions for multireducers and multieffects
 */
export class Action<Payload = void> extends Subject<Payload> {
	#dispatchSubscription?: Subscription;

	private config: ActionConfig;

	private scope: Scope<unknown> | undefined;

	public get listen$(): Observable<ActionPacket<Payload>> {
		return this.scope?.listen$(this) ?? EMPTY;
	}

	and<T>(action: Action<T>) {
		return new CombinedActions(undefined, this, action);
	}

	public constructor(public type: string, config: Partial<ActionConfig> = DEFAULT_ACTION_CONFIG) {
		super();
		this.config = {
			...DEFAULT_ACTION_CONFIG,
			...config,
		};
	}

	public register(scope: Scope): this {
		this.scope = scope;
		this.#dispatchSubscription = this.scope.registerAction(this);
		return this;
	}

	public unregister(): void {
		this.#dispatchSubscription?.unsubscribe();
	}

	public makePacket(payload: Payload): ActionPacket<Payload> {
		return { type: this.type, payload };
	}

	public dispatch(payload: Payload): ActionDispatch {
		return () => this.next(payload);
	}

	/**
	 * The finalize operator will take care of removing it from the actionMap
	 */
	public override unsubscribe(): void {
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
		actionReducer: ActionReducer<State, Payload>
	): ReducerConfiguration<State, Payload> {
		return {
			packetReducer: (state: State, actionPacket: ActionPacket<Payload> | undefined): State =>
				actionPacket ? actionReducer(state, actionPacket.payload) : state,
			action: this,
		};
	}
}
