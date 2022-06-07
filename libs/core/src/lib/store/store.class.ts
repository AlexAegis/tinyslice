import {
	BehaviorSubject,
	catchError,
	distinctUntilChanged,
	EMPTY,
	finalize,
	map,
	mapTo,
	Observable,
	share,
	skip,
	Subscription,
	switchMap,
	tap,
	withLatestFrom,
	zip,
} from 'rxjs';
import { ActionPacket } from '../action';
import { createLoggingMetaReducer, notNullish } from '../helper';
import type { Comparator } from './comparator.type';
import type { Merger } from './merger.type';
import type {
	ActionReduceSnapshot,
	MetaPacketReducer,
	PacketReducer,
	ReducerConfiguration,
} from './reducer.type';
import type { Scope } from './scope.class';
import type { Selector } from './selector.type';

export interface StorePluginHooks<State, Payload> {
	state$: Observable<ActionReduceSnapshot<State, Payload>>;
	initialState: State;
	stateInjector: (state: State) => void;
}

export interface StorePlugin<State, Payload> {
	register: (hooks: StorePluginHooks<State, Payload>) => void;
	onError?: (error: unknown) => void;
	start: () => void;
	stop: () => void;
}

export interface StrictRuntimeChecks {
	strictStateImmutability: boolean;
	strictActionImmutability: boolean;
	strictStateSerializability: boolean;
	strictActionSerializability: boolean;
}

export interface StoreOptions<State, Payload = unknown> {
	plugins?: StorePlugin<State, Payload>[];
	metaReducers?: MetaPacketReducer<State, Payload>[];
	useDefaultLogger?: boolean;
	/**
	 * Runtime checks can slow the store down, turn them off in production,
	 * they are all on by default.
	 */
	runtimeChecks?: StrictRuntimeChecks;
}

// TODO: explore rehydration
abstract class BaseStore<ParentState, Slice, Payload> extends Observable<Slice> {
	protected abstract state: BehaviorSubject<Slice>;
	protected abstract parent: BaseStore<unknown, ParentState, Payload> | undefined;
	protected abstract merger: Merger<ParentState, Slice> | undefined;
	protected abstract stateObservable$: Observable<Slice>;
	protected action$: Observable<ActionPacket<Payload>>;

	protected abstract sliceRegistrations$: BehaviorSubject<
		SliceRegistrationOptions<Slice, unknown, Payload>[]
	>;

	#sink = new Subscription();

	constructor(protected scope: Scope<unknown, Payload>) {
		super();
		this.action$ = scope.dispatcher$;
	}

	/**
	 * TODO: unregister on unsubscribe maybe just provide an unregister callback
	 * Maybe devtools could be notified about registration of lazy slices
	 */
	public registerSlice(
		sliceRegistration: SliceRegistrationOptions<Slice, unknown, Payload>
	): void {
		this.sliceRegistrations$.next([...this.sliceRegistrations$.value, sliceRegistration]);

		if (sliceRegistration.lazy) {
			this.scope.internalActionRegisterLazySlice.next(
				sliceRegistration.lazyNotificationPayload
			);
		}
	}

	slice<SubSliceKey extends keyof Slice>(
		key: SubSliceKey,
		reducerConfigurations: ReducerConfiguration<Slice[SubSliceKey], Payload>[] = [],
		comparator?: (a: Slice[SubSliceKey], b: Slice[SubSliceKey]) => boolean
	): StoreSlice<Slice, Slice[SubSliceKey], Payload> {
		const selector: Selector<Slice, Slice[SubSliceKey]> = (state) => state[key];
		const merger: Merger<Slice, Slice[SubSliceKey]> = (state, slice) => ({
			...state,
			[key]: slice,
		});

		const initialState = selector(this.state.value);

		return new StoreSlice<Slice, Slice[SubSliceKey], Payload>(
			this as BaseStore<unknown, Slice, Payload>,
			selector,
			merger,
			{
				scope: this.scope,
				initialState,
				reducerConfigurations,
				comparator,
				lazy: false,
			}
		);
	}

	sliceSelect<SubSlice extends Slice[keyof Slice]>(
		selector: Selector<Slice, SubSlice>,
		merger: Merger<Slice, SubSlice>,
		reducerConfigurations: ReducerConfiguration<SubSlice, Payload>[] = [],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice, SubSlice, Payload> {
		const initialState = selector(this.state.value);

		return new StoreSlice(this as BaseStore<unknown, Slice, Payload>, selector, merger, {
			scope: this.scope,
			initialState,
			reducerConfigurations,
			comparator,
			lazy: false,
		});
	}

	public addSlice<
		SubSlice,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		AdditionalKey extends Exclude<any, keyof Slice> = Exclude<any, keyof Slice>
	>(
		key: AdditionalKey,
		initialState: SubSlice,
		reducerConfigurations?: ReducerConfiguration<SubSlice, Payload>[],
		comparator?: Comparator<SubSlice>
	): StoreSlice<Slice & Record<AdditionalKey, SubSlice>, SubSlice, Payload> {
		const selector = (state: Slice & Record<AdditionalKey, SubSlice>) => state[key];
		const merger = (state: Slice & Record<AdditionalKey, SubSlice>, slice: SubSlice) => ({
			...state,
			[key]: slice,
		});

		return new StoreSlice(
			this as unknown as BaseStore<unknown, Slice & Record<AdditionalKey, SubSlice>, Payload>,
			selector,
			merger,
			{
				scope: this.scope,
				initialState,
				reducerConfigurations: reducerConfigurations ?? [],
				comparator,
				lazy: true,
			}
		);
	}

	protected static createCombinedReducer<State, Payload = unknown>(
		reducerConfigurations: ReducerConfiguration<State, Payload>[] = []
	): PacketReducer<State, Payload> {
		return (state: State, action: ActionPacket<Payload> | undefined) =>
			action
				? reducerConfigurations
						.filter(
							(reducerConfiguration) =>
								reducerConfiguration.action.type === action.type
						)
						.reduce(
							(accumulator, { packetReducer }) => packetReducer(accumulator, action),
							state
						)
				: state;
	}

	protected static createMetaReducerRunner<State, Payload = unknown>(
		reducerConfigurations: MetaPacketReducer<State, Payload>[] = []
	): (snapshot: ActionReduceSnapshot<State, Payload>) => void {
		return (snapshot: ActionReduceSnapshot<State, Payload>) =>
			reducerConfigurations.forEach((metaReducer) => metaReducer(snapshot));
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public root<T, P = any>(): Store<T, P> {
		let current = this as BaseStore<unknown, unknown, unknown>;
		while (current.parent) {
			current = current.parent;
		}
		return current as Store<T, P>;
	}

	protected set teardown(subscription: Subscription) {
		this.#sink.add(subscription);
	}

	public unsubscribe(): void {
		this.#sink.unsubscribe();
	}
}

const zipSlices = <ParentSlice, Slice, Payload>(
	sliceRegistrations$: Observable<SliceRegistrationOptions<ParentSlice, Slice, Payload>[]>,
	actionDispatcher$: Observable<ActionPacket<Payload> | undefined>
): Observable<SliceChange<ParentSlice, Slice, Payload>[]> =>
	sliceRegistrations$.pipe(
		switchMap((sliceRegistrations) => {
			if (sliceRegistrations.length) {
				return zip(
					sliceRegistrations.map((sliceRegistration) =>
						sliceRegistration.slicePipeline.pipe(
							map((snapshot) => ({
								snapshot,
								selector: sliceRegistration.selector,
								merger: sliceRegistration.merger,
							}))
						)
					)
				);
			} else {
				return actionDispatcher$.pipe(mapTo([]));
			}
		})
	);

const createReducerPipeline = <Slice, SubSlice, Payload>(
	dispatcher$: Observable<ActionPacket<Payload> | undefined>,
	state$: Observable<Slice>,
	registeredSlices$: Observable<SliceRegistrationOptions<Slice, SubSlice, Payload>[]>,
	combinedReducer: PacketReducer<Slice, Payload>
): Observable<ActionReduceSnapshot<Slice, Payload>> =>
	zip(dispatcher$, zipSlices<Slice, SubSlice, Payload>(registeredSlices$, dispatcher$)).pipe(
		withLatestFrom(state$),
		map(([[action, sliceChanges], prevState]) => {
			const stateWithChanges = sliceChanges.reduce(
				(accumulator, next) => next.merger(accumulator, next.snapshot.nextState),
				prevState
			);
			return {
				action: action as ActionPacket<Payload>,
				prevState,
				nextState: combinedReducer(
					stateWithChanges,
					action as ActionPacket<Payload> | undefined
				),
			};
		})
	);

// TODO: make it rehydratable, maybe add a unique name to each store (forward that to the devtoolsPluginOptions and remove name from there)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Store<State, Payload = any> extends BaseStore<unknown, State, Payload> {
	protected parent = undefined;
	protected merger = undefined;
	protected state = new BehaviorSubject<State>(this.initialState);
	protected stateObservable$ = this.state.asObservable();
	protected sliceRegistrations$ = new BehaviorSubject<
		SliceRegistrationOptions<State, unknown, Payload>[]
	>([]);
	private plugins: StorePlugin<State, Payload>[] | undefined;

	public subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);

	#combinedReducer = Store.createCombinedReducer(this.reducerConfigurations);
	#metaReducerRunner: (snapshot: ActionReduceSnapshot<State, Payload>) => void;

	#storePipeline = createReducerPipeline(
		this.action$,
		this.stateObservable$,
		this.sliceRegistrations$,
		this.#combinedReducer
	).pipe(
		tap((snapshot) => {
			this.#metaReducerRunner(snapshot);
			if (snapshot.prevState !== snapshot.nextState) {
				this.state.next(snapshot.nextState);
			}
		}),
		catchError((error) => {
			this.plugins?.forEach((plugin) => plugin.onError?.(error));
			return EMPTY;
		}),
		finalize(() => this.state.complete()),
		share()
	);

	constructor(
		protected readonly scope: Scope<unknown, Payload>,
		public readonly initialState: State,
		private readonly reducerConfigurations: ReducerConfiguration<State, Payload>[] = [],
		private readonly storeOptions?: StoreOptions<State>
	) {
		super(scope);
		this.plugins = this.storeOptions?.plugins?.map((plugin) => this.registerPlugin(plugin));

		scope.registerStore(this as Store<unknown, Payload>);

		this.teardown = this.#storePipeline.subscribe();

		this.#metaReducerRunner = Store.createMetaReducerRunner<State, Payload>([
			...(this.storeOptions?.useDefaultLogger
				? [createLoggingMetaReducer<State, Payload>()]
				: []),
			...(this.storeOptions?.metaReducers ?? []),
		]);
	}

	private registerPlugin(plugin: StorePlugin<State, Payload>): StorePlugin<State, Payload> {
		plugin.register({
			initialState: this.initialState,
			state$: this.#storePipeline,
			stateInjector: (state: State) => this.state.next(state),
		});
		plugin.start();
		return plugin;
	}

	public unsubscribe(): void {
		super.unsubscribe();
		this.storeOptions?.plugins?.forEach((plugin) => plugin.stop());
	}
}

export interface StoreSliceOptions<Slice, Payload> {
	scope: Scope<unknown, Payload>;
	initialState: Slice;
	reducerConfigurations: ReducerConfiguration<Slice, Payload>[];
	comparator?: Comparator<Slice>;
	/**
	 * It's considered lazy when the slice was added later and is not part
	 * of the root initialState
	 */
	lazy: boolean;
}

export interface InitialSnapshot<State> {
	nextState: State;
}
export class StoreSlice<ParentSlice, Slice, Payload> extends BaseStore<
	ParentSlice,
	Slice,
	Payload
> {
	protected state = new BehaviorSubject<Slice>(this.options.initialState);
	protected stateObservable$ = this.state.pipe();
	subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);
	protected scope = this.options.scope;
	protected sliceRegistrations$ = new BehaviorSubject<
		SliceRegistrationOptions<Slice, unknown, Payload>[]
	>([]);

	#combinedReducer = BaseStore.createCombinedReducer(this.options.reducerConfigurations);

	#parentListener: Observable<Slice> = this.parent.pipe(
		skip(1), // Skip the initially emitted one
		map((parentState) => {
			const slice = this.selector(parentState);
			if (this.options.lazy && !notNullish(slice)) {
				return this.options.initialState;
			} else {
				return slice;
			}
		}),
		distinctUntilChanged(this.options.comparator),
		tap(this.state),
		finalize(() => this.state.unsubscribe())
	);

	#slicePipeline = createReducerPipeline(
		this.scope.dispatcher$,
		this.stateObservable$,
		this.sliceRegistrations$,
		this.#combinedReducer
	).pipe(
		tap((snapshot) => {
			if (snapshot.prevState !== snapshot.nextState) {
				this.state.next(snapshot.nextState);
			}
		})
	);

	constructor(
		protected readonly parent: BaseStore<unknown, ParentSlice, Payload>,
		protected readonly selector: Selector<ParentSlice, Slice>,
		protected readonly merger: Merger<ParentSlice, Slice>,
		private readonly options: StoreSliceOptions<Slice, Payload>
	) {
		super(options.scope);

		this.parent.registerSlice({
			slicePipeline: this.#slicePipeline,
			selector,
			merger: merger as Merger<ParentSlice, unknown>,
			lazy: this.options.lazy,
			lazyNotificationPayload: JSON.stringify(this.options.initialState),
		});

		this.teardown = this.#parentListener.subscribe();
	}
}

export interface SliceRegistrationOptions<ParentSlice, Slice, Payload> {
	slicePipeline: Observable<ActionReduceSnapshot<Slice, Payload> | InitialSnapshot<Slice>>;
	merger: Merger<ParentSlice, unknown>;
	selector: Selector<ParentSlice, unknown>;
	lazy: boolean;
	lazyNotificationPayload: string;
}

export interface InitialSnapshot<State> {
	nextState: State;
}

export interface SliceChange<ParentSlice, Slice, Payload> {
	snapshot: ActionReduceSnapshot<Slice, Payload> | InitialSnapshot<Slice>;
	merger: Merger<ParentSlice, unknown>;
	selector: Selector<ParentSlice, unknown>;
}
