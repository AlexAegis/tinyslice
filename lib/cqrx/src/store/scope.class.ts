import { catchError, EMPTY, finalize, map, Observable, Subject, Subscription, tap } from 'rxjs';
import { ActionAlreadyRegisteredError } from '../action/action-already-registered.error';
import type { ActionConfig } from '../action/action-config.interface';
import type { ActionPacket } from '../action/action-packet.interface';
import { Action, ActionTuple } from '../action/action.class';
import { Store, StoreOptions } from '../store/store.class';
import { ReducerConfiguration } from './reducer.type';

export class Scope {
	private readonly dispatcherScope = new Subject<ActionPacket<unknown>>();
	private readonly actionMap = new Map<string, Action<unknown>>();
	public readonly dispatcher$ = this.dispatcherScope.asObservable();
	private effectSubscriptions = new Subscription();
	private stores: Store<unknown>[] = [];

	public static createScope(): Scope {
		return new Scope();
	}

	public createAction<Payload>(type: string, config?: Partial<ActionConfig>): Action<Payload> {
		return new Action<Payload>(this, type, config);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public createStore<State, Payload = any>(
		initialState: State,
		reducerConfigurations: ReducerConfiguration<State, Payload>[] = [],
		storeOptions?: StoreOptions<State>
	): Store<State, Payload> {
		return new Store<State, Payload>(this, initialState, reducerConfigurations, storeOptions);
	}

	public createEffect<DispatchPayload>(
		action: Observable<DispatchPayload>,
		dispatch?: Action<DispatchPayload>
	): void {
		this.effectSubscriptions.add(
			action
				.pipe(
					tap(dispatch),
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
	public registerStore(store: Store<unknown>): void {
		this.stores.push(store);
	}

	public registerAction<Payload>(action: Action<Payload>): Subscription | undefined {
		if (this.actionMap.has(action.type)) {
			throw new ActionAlreadyRegisteredError(action);
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
