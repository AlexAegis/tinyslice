import { catchError, EMPTY, finalize, map, Observable, Subject, Subscription, tap } from 'rxjs';
import type { ActionConfig } from '../action/action-config.interface';
import { ActionPacket, isActionPacket } from '../action/action-packet.interface';
import { Action, ActionTuple } from '../action/action.class';
import { ReducerConfiguration } from './reducer.type';
import { Store, StoreOptions } from './store.class';

export class Scope<EveryStore = unknown> {
	private readonly dispatcherScope = new Subject<ActionPacket<unknown>>();
	private readonly actionMap = new Map<string, Action<unknown>>();
	public readonly dispatcher$ = this.dispatcherScope.asObservable();
	private effectSubscriptions = new Subscription();
	private stores: Store<EveryStore>[] = [];

	public readonly internalActionVoid = this.createAction<void>('[Internal] VOID');
	public readonly internalActionRegisterLazySlice = this.createAction<string>(
		'[Internal] REGISTER_LAZY_SLICE'
	);

	public static createScope<EveryStore>(): Scope<EveryStore> {
		return new Scope<EveryStore>();
	}

	public createAction<Payload>(type: string, config?: Partial<ActionConfig>): Action<Payload> {
		return new Action<Payload>(type, config).register(this as Scope<unknown>);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public createStore<State extends EveryStore>(
		initialState: State,
		reducerConfigurations: ReducerConfiguration<State>[] = [],
		storeOptions?: StoreOptions<State>
	): Store<State> {
		return new Store<State>(
			this as unknown as Scope<unknown>,
			initialState,
			reducerConfigurations,
			storeOptions
		);
	}

	public createEffect<Output>(action: Observable<Output | ActionPacket>): void {
		this.effectSubscriptions.add(
			action
				.pipe(
					tap((packet) => {
						if (isActionPacket(packet, this.actionMap)) {
							// Execute on next tick
							// TODO: Is this what always should happen?
							// The source-state of the effect can be rendered if
							// the effect is done on next tick
							// But effects need to be scheduled to be after
							// reducers and this is a cheap way of doing it
							// Otherwise the normal reducer could overwrite whatever
							// the effect is producing.
							setTimeout(() => {
								const actionDispatcher = this.actionMap.get(packet.type);
								actionDispatcher?.next(packet.payload);
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
	public registerStore(store: Store<EveryStore>): void {
		this.stores.push(store);
	}

	public registerAction<Payload>(action: Action<Payload>): Subscription | undefined {
		if (this.actionMap.has(action.type)) {
			return;
		}

		this.actionMap.set(action.type, action as Action<unknown>);

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
