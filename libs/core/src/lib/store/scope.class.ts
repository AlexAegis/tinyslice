import {
	asapScheduler,
	catchError,
	finalize,
	map,
	Observable,
	scheduled,
	Subject,
	Subscription,
	tap,
} from 'rxjs';
import type { ActionConfig } from '../action/action-config.interface';
import { ActionPacket, isActionPacket } from '../action/action-packet.interface';
import { Action, ActionTuple } from '../action/action.class';
import { colorizeLogString } from '../helper';
import { TINYSLICE_ACTION_PREFIX } from '../internal';
import { RootSlice, RootSliceOptions, Slice } from './slice.class';

/**
 * Defines a state scope on which actions act upon. The state machine is
 * scheduled by the scopes action dispatcher as reducers and plugins only
 * tick when an action is fired.
 */
export class Scope {
	private readonly schedulingDispatcher = new Subject<ActionPacket<unknown>>();
	private readonly actionMap = new Map<string, Action<unknown>>();
	public readonly schedulingDispatcher$ = this.schedulingDispatcher.asObservable();
	private effectSubscriptions = new Subscription();
	private stores: RootSlice<unknown, unknown>[] = [];

	public readonly slices = new Map<string, unknown>();

	public createAction<Payload = void>(
		type: string,
		config?: Partial<ActionConfig>
	): Action<Payload> {
		if (this.actionMap.has(type)) {
			return this.actionMap.get(type) as Action<Payload>;
		} else {
			return new Action<Payload>(type, config).register(this);
		}
	}

	public createRootSlice<State, Internals = unknown>(
		initialState: State,
		rootSliceOptions?: RootSliceOptions<State, Internals>
	): RootSlice<State, Internals> {
		return Slice.createRootSlice(this, initialState, rootSliceOptions);
	}

	/**
	 * Using this ensures packets returned by effects are reduced on next tick.
	 * Otherwise the normal reducer could overwrite whatever the effect
	 * is producing.
	 * Let's say you'd write a typical useless machine, if the effect notices
	 * you set a boolean state to true, it sets it back to false immediately.
	 * Without this scheduling, the effects result could happen before the
	 * triggering actions reduce and the state would be left as true.
	 */
	public createEffect<Output>(action: Observable<Output | ActionPacket>): Subscription {
		const source = scheduled(action, asapScheduler).pipe(
			tap((packet) => {
				if (isActionPacket(packet, this.actionMap)) {
					const actionDispatcher = this.actionMap.get(packet.type);
					actionDispatcher?.next(packet.payload);
				}
			}),
			catchError((error, pipeline$) => {
				console.error(
					...colorizeLogString(`${TINYSLICE_ACTION_PREFIX} error in effect!\n`),
					error
				);
				return pipeline$;
			})
		);

		const effectSubscription = source.subscribe();
		this.effectSubscriptions.add(effectSubscription);
		return effectSubscription;
	}

	/**
	 * Only used for cleanup
	 */
	public registerRootSlice(store: RootSlice<unknown, unknown>): void {
		this.stores.push(store);
	}

	public registerAction<Payload>(action: Action<Payload>): Subscription | undefined {
		if (this.actionMap.has(action.type)) {
			return;
		}

		this.actionMap.set(action.type, action as Action<unknown>);

		return action.listen$
			.pipe(
				map((payload) => action.makePacket(payload)),
				finalize(() => this.actionMap.delete(action.type))
			)
			.subscribe(this.schedulingDispatcher);
	}

	public listen$<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): Observable<ActionPacket<T[number]>> {
		return this.schedulingDispatcher.pipe(Action.makeFilter(...actions));
	}

	public listenAll$(): Observable<ActionPacket<unknown>> {
		return this.schedulingDispatcher.asObservable();
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
		this.schedulingDispatcher.complete();
		this.stores.forEach((store) => store.unsubscribe());
		this.stores = [];
	}
}
