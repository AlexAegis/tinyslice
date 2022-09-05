import { catchError, EMPTY, finalize, map, Observable, Subject, Subscription, tap } from 'rxjs';
import type { ActionConfig } from '../action/action-config.interface';
import type { ActionPacket } from '../action/action-packet.interface';
import { Action, ActionTuple } from '../action/action.class';
import { ReducerConfiguration } from './reducer.type';
import { Store, StoreOptions } from './store.class';

export class Scope<EveryStore = unknown, EveryPayload = unknown> {
	private readonly dispatcherScope = new Subject<ActionPacket<EveryPayload>>();
	private readonly actionMap = new Map<string, Action<EveryPayload>>();
	public readonly dispatcher$ = this.dispatcherScope.asObservable();
	private effectSubscriptions = new Subscription();
	private stores: Store<EveryStore, EveryPayload>[] = [];

	public readonly internalActionVoid = this.createAction<void>('[Internal] VOID');
	public readonly internalActionRegisterLazySlice = this.createAction<string>(
		'[Internal] REGISTER_LAZY_SLICE'
	);

	public static createScope<EveryPayload>(): Scope<EveryPayload> {
		return new Scope<EveryPayload>();
	}

	public createAction<Payload>(type: string, config?: Partial<ActionConfig>): Action<Payload> {
		return new Action<Payload>(type, config).register(this as Scope<unknown, unknown>);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public createStore<State extends EveryStore, Payload extends EveryPayload = any>(
		initialState: State,
		reducerConfigurations: ReducerConfiguration<State, Payload>[] = [],
		storeOptions?: StoreOptions<State>
	): Store<State, Payload> {
		return new Store<State, Payload>(
			this as unknown as Scope<unknown, Payload>,
			initialState,
			reducerConfigurations,
			storeOptions
		);
	}

	public createEffect<DispatchPayload>(
		action: Observable<DispatchPayload>,
		dispatch?: Action<DispatchPayload> | Action<DispatchPayload>[]
	): void {
		this.effectSubscriptions.add(
			action
				.pipe(
					tap((payload) => {
						// Execute on next tick
						// TODO: Is this what always should happen?
						// The source-state of the effect can be rendered if
						// the effect is done on next tick
						// But effects need to be scheduled to be after
						// reducers and this is a cheap way of doing it
						// Otherwise the normal reducer could overwrite whatever
						// the effect is producing.
						if (dispatch) {
							setTimeout(() => {
								if (Array.isArray(dispatch)) {
									for (const d of dispatch) {
										d.next(payload);
									}
								} else {
									dispatch.next(payload);
								}
							}, 0);
						}
					}),
					catchError((error) => {
						console.error(error);
						return EMPTY;
					})
				)
				.subscribe()
		);
	}

	/**
	 * Only used for cleanup
	 */
	public registerStore(store: Store<EveryStore, EveryPayload>): void {
		this.stores.push(store);
	}

	public registerAction<Payload extends EveryPayload>(
		action: Action<Payload>
	): Subscription | undefined {
		if (this.actionMap.has(action.type)) {
			return;
		}

		this.actionMap.set(action.type, action as unknown as Action<EveryPayload>);

		return action
			.pipe(
				map((payload) => action.makePacket(payload)),
				finalize(() => this.actionMap.delete(action.type))
			)
			.subscribe(this.dispatcherScope);
	}

	public listen$<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): Observable<ActionPacket<T[number]>> {
		return this.dispatcherScope.pipe(Action.makeFilter(...actions));
	}

	public listenAll$(): Observable<ActionPacket<unknown>> {
		return this.dispatcherScope.asObservable();
	}

	public isRegistered<Payload>(action?: Action<Payload> | string): boolean {
		if (!action) {
			return false;
		}
		let type: string;
		if (typeof action === 'string') {
			type = action;
		} else {
			type = action.type;
		}
		return this.actionMap.has(type);
	}

	public unsubscribe(): void {
		this.actionMap.forEach((action) => action.unsubscribe());
		this.effectSubscriptions.unsubscribe();
		this.effectSubscriptions = new Subscription();
		this.dispatcherScope.unsubscribe();
		this.stores.forEach((store) => store.unsubscribe());
		this.stores = [];
	}
}
