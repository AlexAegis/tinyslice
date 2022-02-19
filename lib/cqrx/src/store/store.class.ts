import {
	BehaviorSubject,
	distinctUntilChanged,
	finalize,
	map,
	mapTo,
	Observable,
	share,
	Subscription,
	switchMap,
	tap,
	withLatestFrom,
	zip,
} from 'rxjs';
import { ActionPacket } from '../action';
import { DevtoolsPlugin } from '../devtools-plugin/devtools-plugin';
import type { ReduxDevtoolsExtensionConfig } from '../devtools-plugin/redux-devtools.type';
import type { Comparator } from './comparator.type';
import type {
	ActionReduceSnapshot,
	MetaPacketReducer,
	PacketReducer,
	ReducerConfiguration,
} from './reducer.type';
import type { Scope } from './scope.class';
import type { Selector } from './selector.type';
import type { Wrapper } from './wrapper.type';

export interface StoreOptions<State, Payload = unknown> {
	devtoolsPluginOptions?: ReduxDevtoolsExtensionConfig;
	metaReducers: MetaPacketReducer<State, Payload>[];
}

// TODO: explore rehydration
abstract class BaseStore<ParentState, Slice, Payload> extends Observable<Slice> {
	protected abstract state: BehaviorSubject<Slice>;
	protected abstract parent: BaseStore<unknown, ParentState, Payload> | undefined;
	public abstract wrapper: Wrapper<Slice, ParentState> | undefined;
	protected abstract scope: Scope;
	protected abstract stateObservable$: Observable<Slice>;

	protected abstract sliceRegistrations$: BehaviorSubject<
		SliceRegistrationOptions<Slice, unknown, Payload>[]
	>;

	#sink = new Subscription();

	/**
	 * TODO: unregister on unsubscribe maybe just provide an unregister callback
	 */
	public registerSlice(
		sliceRegistration: SliceRegistrationOptions<Slice, unknown, Payload>
	): void {
		this.sliceRegistrations$.next([...this.sliceRegistrations$.value, sliceRegistration]);
	}

	slice<SubSlice extends Slice[keyof Slice]>(
		selector: Selector<Slice, SubSlice>,
		wrapper: Wrapper<SubSlice, Slice>,
		reducers?: ReducerConfiguration<SubSlice, Payload>[],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice, SubSlice, Payload>;
	slice<
		SubSliceKey extends keyof Slice,
		SubSlice extends Slice[SubSliceKey] = Slice[SubSliceKey]
	>(
		key: SubSliceKey,
		reducers?: ReducerConfiguration<SubSlice, Payload>[],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice, SubSlice, Payload>;
	slice<
		SubSliceKey extends keyof Slice,
		SubSlice extends Slice[SubSliceKey] = Slice[SubSliceKey]
	>(
		keyOrSelector: SubSliceKey | Selector<Slice, SubSlice>,
		wrapperOrReducers?: Wrapper<SubSlice, Slice> | ReducerConfiguration<SubSlice, Payload>[],
		reducersOrComparator?:
			| ((a: SubSlice, b: SubSlice) => boolean)
			| ReducerConfiguration<SubSlice, Payload>[],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice, SubSlice, Payload> {
		let selector: Selector<Slice, SubSlice>;
		let wrapper: Wrapper<SubSlice, Slice>;
		let initialState: SubSlice;
		let reducerConfigurations: ReducerConfiguration<SubSlice, Payload>[];

		if (typeof keyOrSelector === 'string') {
			selector = (state) => state[keyOrSelector] as SubSlice;
			wrapper = (state) => ({ [keyOrSelector]: state } as unknown as Partial<Slice>);
			initialState = this.state.value[keyOrSelector] as SubSlice;
			reducerConfigurations =
				(wrapperOrReducers as ReducerConfiguration<SubSlice, Payload>[]) ?? [];
		} else {
			selector = keyOrSelector as Selector<Slice, SubSlice>;
			wrapper = wrapperOrReducers as Wrapper<SubSlice, Slice>;
			initialState = (keyOrSelector as Selector<Slice, SubSlice>)(this.state.value);
			reducerConfigurations =
				(reducersOrComparator as ReducerConfiguration<SubSlice, Payload>[]) ?? [];
		}

		return new StoreSlice(this, selector, wrapper, {
			scope: this.scope,
			initialState,
			reducerConfigurations,
			comparator,
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
	): StoreSlice<Slice & Record<AdditionalKey, SubSlice>, SubSlice, Payload>;
	public addSlice<
		SubSlice,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		AdditionalKey extends Exclude<any, keyof Slice> = Exclude<any, keyof Slice>
	>(
		selector: Selector<Slice & Record<AdditionalKey, SubSlice>, SubSlice>,
		wrapper: Wrapper<SubSlice, Slice & Record<AdditionalKey, SubSlice>>,
		initialState: SubSlice,
		reducerConfigurations?: ReducerConfiguration<SubSlice, Payload>[],
		comparator?: Comparator<SubSlice>
	): StoreSlice<Slice & Record<AdditionalKey, SubSlice>, SubSlice, Payload>;
	public addSlice<
		SubSlice,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		AdditionalKey extends Exclude<any, keyof Slice> = Exclude<any, keyof Slice>
	>(
		keyOrSelector: AdditionalKey | Selector<Slice & Record<AdditionalKey, SubSlice>, SubSlice>,
		initialStateOrWrapper:
			| SubSlice
			| Wrapper<SubSlice, Slice & Record<AdditionalKey, SubSlice>>,
		reducerConfigurationOrInitialState?: ReducerConfiguration<SubSlice, Payload>[] | SubSlice,
		comparatorOrReducerConfigurations?:
			| Comparator<SubSlice>
			| ReducerConfiguration<SubSlice, Payload>[],
		comparatorOrNothing?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice & Record<AdditionalKey, SubSlice>, SubSlice, Payload> {
		let selector: Selector<Slice & Record<AdditionalKey, SubSlice>, SubSlice>;
		let wrapper: Wrapper<SubSlice, Slice & Record<AdditionalKey, SubSlice>>;
		let initialState: SubSlice;
		let reducerConfigurations: ReducerConfiguration<SubSlice, Payload>[];
		let comparator: Comparator<SubSlice>;
		if (typeof keyOrSelector === 'string') {
			selector = (state) => state[keyOrSelector] as SubSlice;
			wrapper = (state) =>
				({ [keyOrSelector]: state } as unknown as Slice & Record<AdditionalKey, SubSlice>);
			initialState = initialStateOrWrapper as SubSlice;
			reducerConfigurations =
				(reducerConfigurationOrInitialState as ReducerConfiguration<SubSlice, Payload>[]) ??
				[];
			comparator = comparatorOrReducerConfigurations as Comparator<SubSlice>;
		} else {
			selector = keyOrSelector as Selector<Slice & Record<AdditionalKey, SubSlice>, SubSlice>;
			wrapper = initialStateOrWrapper as Wrapper<
				SubSlice,
				Slice & Record<AdditionalKey, SubSlice>
			>;
			initialState = reducerConfigurationOrInitialState as SubSlice;
			reducerConfigurations =
				(comparatorOrReducerConfigurations as ReducerConfiguration<SubSlice, Payload>[]) ??
				[];
			comparator = comparatorOrNothing as Comparator<SubSlice>;
		}

		return new StoreSlice(
			this as unknown as BaseStore<unknown, Slice & Record<AdditionalKey, SubSlice>, Payload>,
			selector,
			wrapper,
			{
				scope: this.scope,
				initialState,
				reducerConfigurations,
				comparator,
				initialize: true,
			}
		);
	}

	protected static createReducerRunner<State, Payload = unknown>(
		reducerConfigurations: ReducerConfiguration<State, Payload>[] = []
	): PacketReducer<State, Payload> {
		return (state: State, action: ActionPacket<Payload>) =>
			reducerConfigurations
				.filter((reducerConfiguration) => reducerConfiguration.action.type === action.type)
				.reduce(
					(accumulator, { packetReducer }) => packetReducer(accumulator, action),
					state
				);
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

export type SliceChange<State, Payload> = {
	slice: ActionReduceSnapshot<unknown, Payload> | InitialSnapshot<unknown>;
	selector: Selector<State, unknown>;
	wrapper: Wrapper<unknown, State>;
};

const reduceWithSliceChanges = <State, Payload>(
	state: State,
	action: ActionPacket<Payload>,
	sliceChanges: Partial<State> | undefined,
	reducer: PacketReducer<State, Payload>
) => {
	let prevState = state;
	if (typeof state === 'object') {
		prevState = { ...state };
		if (sliceChanges) {
			Object.assign(prevState, sliceChanges);
		}
	}
	const nextState = reducer(prevState, action as ActionPacket<Payload>);
	return {
		action: action as ActionPacket<Payload>,
		prevState: state,
		nextState,
	} as ActionReduceSnapshot<State, Payload>;
};

const createSliceListener = <ParentSlice, Slice, Payload>(
	sliceRegistrations$: Observable<SliceRegistrationOptions<ParentSlice, Slice, Payload>[]>,
	actionDispatcher$: Observable<ActionPacket<unknown>>
): Observable<Partial<ParentSlice> | undefined> =>
	sliceRegistrations$.pipe(
		switchMap((sliceRegistrations) => {
			if (sliceRegistrations.length) {
				return zip(
					sliceRegistrations.map((sliceRegistration) =>
						sliceRegistration.slicePipeline.pipe(
							map((slice) => ({
								slice,
								selector: sliceRegistration.selector,
								wrapper: sliceRegistration.wrapper,
							}))
						)
					)
				).pipe(
					map((sliceChanges) =>
						sliceChanges.reduce(
							(acc, next) => Object.assign(acc, next.wrapper(next.slice.nextState)),
							{} as unknown as Partial<ParentSlice>
						)
					)
				);
			} else {
				return actionDispatcher$.pipe(mapTo(undefined));
			}
		})
	);

// TODO: make it rehydratable, maybe add a unique name to each store (forward that to the devtoolsPluginOptions and remove name from there)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Store<State, Payload = any> extends BaseStore<unknown, State, Payload> {
	protected parent = undefined;
	public wrapper = undefined;
	protected state = new BehaviorSubject<State>(this.initialState);
	protected stateObservable$ = this.state.pipe(distinctUntilChanged());
	protected sliceRegistrations$ = new BehaviorSubject<
		SliceRegistrationOptions<State, unknown, Payload>[]
	>([]);

	public subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);

	#devtools?: DevtoolsPlugin<State>;
	#reducerRunner = Store.createReducerRunner(this.reducerConfigurations);
	#metaReducerRunner = Store.createMetaReducerRunner<State, Payload>(
		this.storeOptions?.metaReducers ?? []
	);

	#storePipeline: Observable<ActionReduceSnapshot<State, Payload>> = zip(
		this.scope.dispatcher$,
		createSliceListener<State, unknown, Payload>(
			this.sliceRegistrations$,
			this.scope.dispatcher$
		)
	).pipe(
		withLatestFrom(this.stateObservable$),
		map(([[action, sliceChanges], prevState]) =>
			reduceWithSliceChanges(
				prevState,
				action as ActionPacket<Payload>,
				sliceChanges,
				this.#reducerRunner
			)
		),
		tap((snapshot) => {
			this.#metaReducerRunner(snapshot);
			if (snapshot.prevState !== snapshot.nextState) {
				this.state.next(snapshot.nextState);
			}
		}),
		finalize(() => this.state.complete()),
		share()
	);

	constructor(
		protected readonly scope: Scope,
		public readonly initialState: State,
		private readonly reducerConfigurations: ReducerConfiguration<State, Payload>[] = [],
		private readonly storeOptions?: StoreOptions<State>
	) {
		super();
		scope.registerStore(this as Store<unknown>);

		this.teardown = this.#storePipeline.subscribe();

		try {
			if (this.storeOptions?.devtoolsPluginOptions) {
				this.#devtools = new DevtoolsPlugin<State>({
					initialState,
					state$: this.#storePipeline,
					stateInjector: (state: State) => this.state.next(state),
					devtoolsPluginOptions: this.storeOptions.devtoolsPluginOptions,
				});
			}
		} catch (error: unknown) {
			// couldn't instantiate devtools, no extension installed
		}
	}

	public unsubscribe(): void {
		super.unsubscribe();
		this.#devtools?.unsubscribe();
	}
}

export interface StoreSliceOptions<Slice, Payload> {
	scope: Scope;
	initialState: Slice;
	reducerConfigurations: ReducerConfiguration<Slice, Payload>[];
	comparator?: Comparator<Slice>;
	initialize?: boolean;
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
	protected stateObservable$ = this.state.pipe(distinctUntilChanged(this.options.comparator));
	subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);
	protected scope = this.options.scope;
	protected sliceRegistrations: SliceRegistrationOptions<Slice, unknown, Payload>[] = [];
	protected sliceRegistrations$ = new BehaviorSubject<
		SliceRegistrationOptions<Slice, unknown, Payload>[]
	>([]);

	#reducerRunner = BaseStore.createReducerRunner(this.options.reducerConfigurations);

	#parentListener: Observable<Slice> = this.parent.pipe(
		map(this.selector),
		distinctUntilChanged(this.options.comparator),
		tap(this.state),
		finalize(() => this.state.unsubscribe())
	);

	#slicePipeline: Observable<ActionReduceSnapshot<Slice, Payload> | InitialSnapshot<Slice>> = zip(
		this.scope.dispatcher$,
		createSliceListener(this.sliceRegistrations$, this.scope.dispatcher$)
	).pipe(
		withLatestFrom(this.stateObservable$),
		map(([[action, sliceChanges], prevState]) =>
			reduceWithSliceChanges(
				prevState,
				action as ActionPacket<Payload>,
				sliceChanges,
				this.#reducerRunner
			)
		),
		tap((snapshot) => {
			if (snapshot.prevState !== snapshot.nextState) {
				this.state.next(snapshot.nextState);
			}
		})
	);

	constructor(
		protected readonly parent: BaseStore<unknown, ParentSlice, Payload>,
		protected readonly selector: Selector<ParentSlice, Slice>,
		public readonly wrapper: Wrapper<Slice, ParentSlice>,
		private readonly options: StoreSliceOptions<Slice, Payload>
	) {
		super();

		this.teardown = this.#parentListener.subscribe();

		this.parent.registerSlice({
			slicePipeline: this.#slicePipeline,
			selector,
			wrapper: wrapper as Wrapper<unknown, ParentSlice>,
		});

		if (options.initialize) {
			this.state.next(options.initialState);
		}
	}
}

export interface SliceRegistrationOptions<ParentSlice, Slice, Payload> {
	slicePipeline: Observable<ActionReduceSnapshot<Slice, Payload> | InitialSnapshot<Slice>>;
	wrapper: Wrapper<unknown, ParentSlice>;
	selector: Selector<ParentSlice, unknown>;
}
