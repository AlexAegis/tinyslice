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
import type { ActionConfig } from '../action/action-config.interface.js';
import { isActionPacket, type ActionPacket } from '../action/action-packet.interface.js';
import { Action, type ActionTuple } from '../action/action.class.js';
import { TINYSLICE_PREFIX } from '../helper/index.js';
import { Slice, type RootSlice, type RootSliceOptions } from './slice.class.js';

/**
 * Defines a state scope on which actions act upon. The state machine is
 * scheduled by the scopes action dispatcher as reducers and plugins only
 * tick when an action is fired.
 */
export class Scope {
	private readonly schedulingDispatcher: Subject<ActionPacket>;
	private readonly actionMap = new Map<string, Action<unknown>>();
	public readonly schedulingDispatcher$: Observable<ActionPacket>;
	private readonly effectSubscriptions: Subscription;
	private readonly stores: RootSlice<unknown>[];

	public readonly slices: Map<string, unknown>;

	public constructor() {
		this.schedulingDispatcher = new Subject<ActionPacket>();
		this.schedulingDispatcher$ = this.schedulingDispatcher.asObservable();
		this.actionMap = new Map<string, Action<unknown>>();
		this.effectSubscriptions = new Subscription();
		this.stores = [];
		this.slices = new Map<string, unknown>();
	}

	public createAction<Payload = void>(
		type: string,
		config?: Partial<ActionConfig>
	): Action<Payload> {
		return this.actionMap.has(type)
			? (this.actionMap.get(type) as Action<Payload>)
			: new Action<Payload>(type, config).register(this);
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
					// Passing it directly to the dispatcher as-is instead of
					// going through the Action itself to avoid infinite loops.
					this.schedulingDispatcher.next(packet);
				}
			}),
			catchError((error, pipeline$) => {
				console.error(
					`%c${TINYSLICE_PREFIX} error in effect!\n`,
					'background: #222, color: #e00;',
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
	public registerRootSlice(store: RootSlice<unknown>): void {
		this.stores.push(store);
	}

	public registerAction<Payload>(
		action: Action<Payload>,
		registerFromAction = false
	): Subscription | undefined {
		if (this.actionMap.has(action.type)) {
			return;
		}

		this.actionMap.set(action.type, action as Action<unknown>);

		const subscription = action.listen$
			.pipe(
				map((payload) => action.makePacket(payload)),
				finalize(() => this.actionMap.delete(action.type)),
				tap((next) => this.schedulingDispatcher.next(next))
			)
			.subscribe();
		action.registrations.add(subscription);

		if (!registerFromAction) {
			action.register(this);
		}

		return subscription;
	}

	public listen$<T extends readonly unknown[]>(
		...actions: [...ActionTuple<T>]
	): Observable<ActionPacket<T[number]>> {
		return this.schedulingDispatcher.pipe(Action.makeFilter(...actions));
	}

	public listenAll$(): Observable<ActionPacket> {
		return this.schedulingDispatcher.asObservable();
	}

	public isRegistered<Payload>(action?: Action<Payload> | string): boolean {
		if (!action) {
			return false;
		}
		const type = typeof action === 'string' ? action : action.type;
		return this.actionMap.has(type);
	}

	get closed(): boolean {
		return this.schedulingDispatcher.closed;
	}

	public complete(): void {
		for (const [, action] of this.actionMap) {
			action.complete();
		}
		this.actionMap.clear();
		this.effectSubscriptions.unsubscribe();
		this.schedulingDispatcher.complete();
		for (const store of this.stores) {
			store.complete();
		}
	}
}
