import {
	BehaviorSubject,
	distinctUntilChanged,
	filter,
	finalize,
	map,
	Observable,
	share,
	Subscription,
	tap,
	withLatestFrom,
} from 'rxjs';
import { ActionPacket } from '../action';
import { DevtoolsPlugin } from '../devtools-plugin/devtools-plugin';
import type { ReduxDevtoolsExtensionConfig } from '../devtools-plugin/redux-devtools.type';
import type { Comparator } from './comparator.type';
import type { ActionReduceSnapshot, MetaPacketReducer, ReducerConfiguration } from './reducer.type';
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
	protected abstract wrap: Wrapper<Slice, ParentState> | undefined;
	protected abstract scope: Scope;
	protected abstract stateObservable$: Observable<Slice>;

	#sink = new Subscription();

	/**
	 * Propagates the changed slice back to its parent
	 */
	protected updateParent(slice: Slice, selector: (parentSlice: ParentState) => Slice): void {
		console.log('update Parent', slice);
		if (this.wrap && this.parent && selector(this.parent.state.value) !== slice) {
			const wrappedSlice = this.wrap(slice);
			const newSlice = { ...this.parent.state.value, ...wrappedSlice };
			this.parent.state.next(newSlice);
		}
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
		console.log('allalal');
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
	): (action: ActionPacket<Payload>, state: State) => State {
		return (action: ActionPacket<Payload>, state: State) =>
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

// TODO: make it rehydratable, maybe add a unique name to each store (forward that to the devtoolsPluginOptions and remove name from there)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Store<State, Payload = any> extends BaseStore<unknown, State, Payload> {
	protected parent = undefined;
	protected wrap = undefined;
	protected state = new BehaviorSubject<State>(this.initialState);
	protected stateObservable$ = this.state.pipe(distinctUntilChanged());
	public subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);

	#devtools?: DevtoolsPlugin<State>;
	#reducerRunner = Store.createReducerRunner(this.reducerConfigurations);
	#metaReducerRunner = Store.createMetaReducerRunner<State, Payload>(
		this.storeOptions?.metaReducers ?? []
	);

	#storePipeline = this.scope.dispatcher$.pipe(
		withLatestFrom(this.stateObservable$),
		map(([action, prevState]) => ({
			action: action as ActionPacket<Payload>,
			prevState,
			nextState: this.#reducerRunner(action as ActionPacket<Payload>, prevState),
		})),
		filter(({ prevState, nextState }) => prevState !== nextState),
		tap((snapshot) => {
			console.log('SNAPPP');
			this.state.next(snapshot.nextState);
			this.#metaReducerRunner(snapshot);
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

export class StoreSlice<ParentSlice, Slice, Payload> extends BaseStore<
	ParentSlice,
	Slice,
	Payload
> {
	protected state = new BehaviorSubject<Slice>(this.options.initialState);
	protected stateObservable$ = this.state.pipe(distinctUntilChanged(this.options.comparator));
	subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);
	protected scope = this.options.scope;

	#parentListener: Observable<Slice> = this.parent.pipe(
		map(this.selector),
		distinctUntilChanged(this.options.comparator),
		tap(this.state),
		finalize(() => this.state.unsubscribe())
	);

	#slicePipeline = this.scope.dispatcher$.pipe(
		withLatestFrom(this.stateObservable$),
		map(([action, state]) => {
			console.log('reducers on slice runnin', state);
			return this.#reducerRunner(action as ActionPacket<Payload>, state);
		}),
		filter((newState) => this.state.value !== newState),

		tap(this.state)
	);

	#statePipeline = this.stateObservable$.pipe(
		tap((slice) => this.updateParent(slice, this.selector)),
		finalize(() => this.unsubscribe())
	);

	#reducerRunner = BaseStore.createReducerRunner(this.options.reducerConfigurations);

	constructor(
		protected readonly parent: BaseStore<unknown, ParentSlice, Payload>,
		protected readonly selector: Selector<ParentSlice, Slice>,
		protected readonly wrap: Wrapper<Slice, ParentSlice>,
		private readonly options: StoreSliceOptions<Slice, Payload>
	) {
		super();
		this.teardown = this.#parentListener.subscribe();
		this.teardown = this.#slicePipeline.subscribe();
		this.teardown = this.#statePipeline.subscribe();

		if (options.initialize) {
			this.state.next(options.initialState);
		}
	}
}
