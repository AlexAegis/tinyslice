import {
	BehaviorSubject,
	catchError,
	distinctUntilChanged,
	EMPTY,
	finalize,
	map,
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

export type ExcludeProps<S, T> = S & { [K in keyof T]?: never };
export type ExcludeKey<S, T extends string | number> = S & { [K in T]: never };

export type ValueOf<T> = T[keyof T];
export type KeyOf<T> = keyof T;

export interface StorePluginHooks<State> {
	state$: Observable<ActionReduceSnapshot<State>>;
	initialState: State;
	stateInjector: (state: State) => void;
}

export interface StorePlugin<State> {
	register: (hooks: StorePluginHooks<State>) => void;
	onError?: (error: unknown) => void;
	start: () => void;
	stop: () => void;
	registerAdditionalTrigger?: (trigger: () => void) => void;
}

export interface StrictRuntimeChecks {
	strictStateImmutability: boolean;
	strictActionImmutability: boolean;
	strictStateSerializability: boolean;
	strictActionSerializability: boolean;
}

export interface StoreOptions<State> {
	plugins?: StorePlugin<State>[];
	metaReducers?: MetaPacketReducer<State>[];
	useDefaultLogger?: boolean;
	/**
	 * Runtime checks can slow the store down, turn them off in production,
	 * they are all on by default.
	 */
	runtimeChecks?: StrictRuntimeChecks;
}

// TODO: explore rehydration
abstract class BaseStore<ParentState, Slice> extends Observable<Slice> {
	protected abstract state: BehaviorSubject<Slice>;
	protected abstract parent: BaseStore<unknown, ParentState> | undefined;
	protected abstract merger: Merger<ParentState, Slice> | undefined;
	protected abstract stateObservable$: Observable<Slice>;
	protected action$: Observable<ActionPacket>;

	protected abstract sliceRegistrations$: BehaviorSubject<
		SliceRegistrationOptions<Slice, unknown>[]
	>;

	#sink = new Subscription();

	constructor(protected scope: Scope<unknown>) {
		super();
		this.action$ = scope.dispatcher$;
	}

	/**
	 * TODO: unregister on unsubscribe maybe just provide an unregister callback
	 * Maybe devtools could be notified about registration of lazy slices
	 */
	public registerSlice(sliceRegistration: SliceRegistrationOptions<Slice, unknown>): void {
		this.sliceRegistrations$.next([...this.sliceRegistrations$.value, sliceRegistration]);

		if (sliceRegistration.lazy) {
			this.scope.internalActionRegisterLazySlice.next(
				sliceRegistration.lazyNotificationPayload
			);
		}
	}

	slice<SubSliceKey extends keyof Slice>(
		key: SubSliceKey,
		reducerConfigurations: ReducerConfiguration<Slice[SubSliceKey]>[] = [],
		comparator?: (a: Slice[SubSliceKey], b: Slice[SubSliceKey]) => boolean
	): StoreSlice<Slice, Slice[SubSliceKey]> {
		const selector: Selector<Slice, Slice[SubSliceKey]> = (state) => state[key];
		const merger: Merger<Slice, Slice[SubSliceKey]> = (state, slice) => ({
			...state,
			[key]: slice,
		});

		const initialState = selector(this.state.value);

		return new StoreSlice<Slice, Slice[SubSliceKey]>(
			this as BaseStore<unknown, Slice>,
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
		reducerConfigurations: ReducerConfiguration<SubSlice>[] = [],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice, SubSlice> {
		const initialState = selector(this.state.value);

		return new StoreSlice(this as BaseStore<unknown, Slice>, selector, merger, {
			scope: this.scope,
			initialState,
			reducerConfigurations,
			comparator,
			lazy: false,
		});
	}

	/**
	 * ? https://github.com/microsoft/TypeScript/issues/42315
	 * ? key could be restricted to disallow keys of Slice once negated types
	 * ? are implemented in TypeScript
	 */
	public addSlice<SubSlice, AdditionalKey extends string = string>(
		key: AdditionalKey,
		initialState: SubSlice,
		reducerConfigurations?: ReducerConfiguration<SubSlice>[],
		comparator?: Comparator<SubSlice>
	): StoreSlice<Slice & Record<AdditionalKey, SubSlice>, SubSlice> {
		const selector = (state: Slice & Record<AdditionalKey, SubSlice>) => state[key];
		const merger = (state: Slice & Record<AdditionalKey, SubSlice>, slice: SubSlice) => ({
			...state,
			[key]: slice,
		});
		return new StoreSlice(
			this as unknown as BaseStore<unknown, Slice & Record<AdditionalKey, SubSlice>>,
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

	protected static createCombinedReducer<State>(
		reducerConfigurations: ReducerConfiguration<State>[] = []
	): PacketReducer<State> {
		return (state: State, action: ActionPacket | undefined) =>
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

	protected static createMetaReducerRunner<State>(
		reducerConfigurations: MetaPacketReducer<State>[] = []
	): (snapshot: ActionReduceSnapshot<State>) => void {
		return (snapshot: ActionReduceSnapshot<State>) =>
			reducerConfigurations.forEach((metaReducer) => metaReducer(snapshot));
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public root<T>(): Store<T> {
		let current = this as BaseStore<unknown, unknown>;
		while (current.parent) {
			current = current.parent;
		}
		return current as Store<T>;
	}

	protected set teardown(subscription: Subscription) {
		this.#sink.add(subscription);
	}

	public unsubscribe(): void {
		this.#sink.unsubscribe();
	}
}

const zipSlices = <ParentSlice, Slice>(
	sliceRegistrations$: Observable<SliceRegistrationOptions<ParentSlice, Slice>[]>,
	actionDispatcher$: Observable<ActionPacket | undefined>
): Observable<SliceChange<ParentSlice, Slice>[]> =>
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
				return actionDispatcher$.pipe(map(() => []));
			}
		})
	);

const createReducerPipeline = <Slice, SubSlice>(
	dispatcher$: Observable<ActionPacket | undefined>,
	state$: Observable<Slice>,
	registeredSlices$: Observable<SliceRegistrationOptions<Slice, SubSlice>[]>,
	combinedReducer: PacketReducer<Slice>
): Observable<ActionReduceSnapshot<Slice>> =>
	zip(dispatcher$, zipSlices<Slice, SubSlice>(registeredSlices$, dispatcher$)).pipe(
		withLatestFrom(state$),
		map(([[action, sliceChanges], prevState]) => {
			const stateWithChanges = sliceChanges.reduce(
				(accumulator, next) => next.merger(accumulator, next.snapshot.nextState),
				prevState
			);
			return {
				action: action as ActionPacket,
				prevState,
				nextState: combinedReducer(stateWithChanges, action as ActionPacket | undefined),
			};
		})
	);

// TODO: make it rehydratable, maybe add a unique name to each store (forward that to the devtoolsPluginOptions and remove name from there)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Store<State> extends BaseStore<unknown, State> {
	protected parent = undefined;
	protected merger = undefined;
	protected state = new BehaviorSubject<State>(this.initialState);
	protected stateObservable$ = this.state.asObservable();
	protected sliceRegistrations$ = new BehaviorSubject<SliceRegistrationOptions<State, unknown>[]>(
		[]
	);
	private plugins: StorePlugin<State>[] | undefined;

	public override subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);

	#combinedReducer = Store.createCombinedReducer(this.reducerConfigurations);
	#metaReducerRunner: (snapshot: ActionReduceSnapshot<State>) => void;

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
		protected override readonly scope: Scope<unknown>,
		public readonly initialState: State,
		private readonly reducerConfigurations: ReducerConfiguration<State>[] = [],
		private readonly storeOptions?: StoreOptions<State>
	) {
		super(scope);
		this.plugins = this.storeOptions?.plugins?.map((plugin) => this.registerPlugin(plugin));

		scope.registerStore(this as Store<unknown>);
		reducerConfigurations.forEach((reducerConfiguration) =>
			scope.registerAction(reducerConfiguration.action)
		);

		this.teardown = this.#storePipeline.subscribe();

		this.#metaReducerRunner = Store.createMetaReducerRunner<State>([
			...(this.storeOptions?.useDefaultLogger ? [createLoggingMetaReducer<State>()] : []),
			...(this.storeOptions?.metaReducers ?? []),
		]);
	}

	private registerPlugin(plugin: StorePlugin<State>): StorePlugin<State> {
		plugin.register({
			initialState: this.initialState,
			state$: this.#storePipeline,
			stateInjector: (state: State) => this.state.next(state),
		});
		plugin.start();
		return plugin;
	}

	public override unsubscribe(): void {
		super.unsubscribe();
		this.storeOptions?.plugins?.forEach((plugin) => plugin.stop());
	}
}

export interface StoreSliceOptions<Slice> {
	scope: Scope<unknown>;
	initialState: Slice;
	reducerConfigurations: ReducerConfiguration<Slice>[];
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

export class StoreSlice<ParentSlice, Slice> extends BaseStore<ParentSlice, Slice> {
	protected state = new BehaviorSubject<Slice>(this.options.initialState);
	protected stateObservable$ = this.state.pipe(distinctUntilChanged(this.options.comparator));
	override subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);
	protected override scope = this.options.scope;
	protected sliceRegistrations$ = new BehaviorSubject<SliceRegistrationOptions<Slice, unknown>[]>(
		[]
	);

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
		protected readonly parent: BaseStore<unknown, ParentSlice>,
		protected readonly selector: Selector<ParentSlice, Slice>,
		protected readonly merger: Merger<ParentSlice, Slice>,
		private readonly options: StoreSliceOptions<Slice>
	) {
		super(options.scope);

		options.reducerConfigurations.forEach((reducerConfiguration) =>
			options.scope.registerAction(reducerConfiguration.action)
		);

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

export interface SliceRegistrationOptions<ParentSlice, Slice> {
	slicePipeline: Observable<ActionReduceSnapshot<Slice> | InitialSnapshot<Slice>>;
	merger: Merger<ParentSlice, unknown>;
	selector: Selector<ParentSlice, unknown>;
	lazy: boolean;
	lazyNotificationPayload: string;
}

export interface InitialSnapshot<State> {
	nextState: State;
}

export interface SliceChange<ParentSlice, Slice> {
	snapshot: ActionReduceSnapshot<Slice> | InitialSnapshot<Slice>;
	merger: Merger<ParentSlice, unknown>;
	selector: Selector<ParentSlice, unknown>;
}
