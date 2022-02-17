import {
	BehaviorSubject,
	distinctUntilChanged,
	filter,
	finalize,
	map,
	Observable,
	Subject,
	Subscription,
	tap,
	withLatestFrom,
} from 'rxjs';
import { Action, ActionPacket } from '../action';
import { ReducerConfiguration } from './reducer.type';

export type Selector<State, Slice> = (state: State) => Slice;
export type Wrapper<Slice, State> = (slice: Slice) => Partial<State>;

abstract class BaseStore<ParentState, Slice, Payload> extends Observable<Slice> {
	protected abstract state: BehaviorSubject<Slice>;
	protected abstract parent: BaseStore<unknown, ParentState, Payload> | undefined;
	protected abstract wrap: Wrapper<Slice, ParentState> | undefined;
	protected abstract stateObservable$: Observable<Slice>;

	#sink = new Subscription();

	/**
	 * Propagates the changed slice back to its parent
	 */
	protected updateParent(slice: Slice, selector: (parentSlice: ParentState) => Slice): void {
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
		if (typeof keyOrSelector === 'string') {
			console.log(keyOrSelector, wrapperOrReducers);
			return new StoreSlice(
				this,
				this.state.value[keyOrSelector] as SubSlice,
				(state) => state[keyOrSelector] as SubSlice,
				(state) => ({ [keyOrSelector]: state } as unknown as Partial<Slice>),
				(wrapperOrReducers as ReducerConfiguration<SubSlice, Payload>[]) ?? [],
				comparator
			);
		} else {
			return new StoreSlice(
				this,
				(keyOrSelector as Selector<Slice, SubSlice>)(this.state.value),
				keyOrSelector as Selector<Slice, SubSlice>,
				wrapperOrReducers as Wrapper<SubSlice, Slice>,
				(reducersOrComparator as ReducerConfiguration<SubSlice, Payload>[]) ?? [],
				comparator
			);
		}
	}

	public addSlice<SubSlice, AdditionalKey extends string | number = never>( // TODO: must not already be present on slice
		initialState: SubSlice,
		selector: Selector<Slice & Record<AdditionalKey, SubSlice>, SubSlice>,
		wrapper: Wrapper<SubSlice, Slice & Record<AdditionalKey, SubSlice>>,
		reducers: ReducerConfiguration<SubSlice, Payload>[] = [],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice & Record<AdditionalKey, SubSlice>, SubSlice, Payload> {
		return new StoreSlice(
			this as unknown as BaseStore<unknown, Slice & Record<AdditionalKey, SubSlice>, Payload>,
			initialState,
			selector,
			wrapper,
			reducers,
			comparator
		);
	}

	protected static createReducerRunner<State, Payload = unknown>(
		reducerConfigurations: ReducerConfiguration<State, Payload>[]
	): (action: ActionPacket<Payload>, state: State) => State {
		return (action: ActionPacket<Payload>, state: State) =>
			reducerConfigurations
				.filter((reducerConfiguration) => reducerConfiguration.action.type === action.type)
				.reduce(
					(accumulator, { packetReducer }) => packetReducer(accumulator, action),
					state
				);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Store<State, Payload = any> extends BaseStore<unknown, State, Payload> {
	protected parent = undefined;
	protected wrap = undefined;
	protected state = new BehaviorSubject<State>(this.initialState);

	protected stateObservable$ = this.state.pipe(distinctUntilChanged());
	subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);

	// This emits
	public reducedNotification = new Subject<void>();

	#reducerRunner = Store.createReducerRunner(this.reducerConfigurations);

	// TODO: Never run while reducers are executing and bubbling
	#storePipeline = (Action.dispatcher$ as Observable<ActionPacket<Payload>>).pipe(
		withLatestFrom(this.state),
		map(([action, state]) => this.#reducerRunner(action, state)),
		filter((newState) => this.state.value !== newState),
		tap((a) => this.state.next(a)),
		tap(() => this.reducedNotification.next()),
		finalize(() => {
			this.reducedNotification.complete();
			this.state.complete();
		})
	);

	public constructor(
		public readonly initialState: State,
		private readonly reducerConfigurations: ReducerConfiguration<State, Payload>[] = []
	) {
		super();
		this.teardown = this.#storePipeline.subscribe();
	}
}

export class StoreSlice<ParentSlice, Slice, Payload> extends BaseStore<
	ParentSlice,
	Slice,
	Payload
> {
	protected state = new BehaviorSubject<Slice>(this.initialState);
	protected stateObservable$ = this.state.pipe(distinctUntilChanged(this.comparator));
	subscribe = this.stateObservable$.subscribe.bind(this.stateObservable$);

	#parentListener: Observable<Slice> = this.parent.pipe(
		map(this.selector),
		distinctUntilChanged(this.comparator),
		tap(this.state),
		finalize(() => {
			this.state.unsubscribe();
		})
	);

	#slicePipeline = (Action.dispatcher$ as Observable<ActionPacket<Payload>>).pipe(
		withLatestFrom(this.state),
		map(([action, state]) => {
			return this.#reducerRunner(action, state);
		}),
		filter((newState) => this.state.value !== newState),
		distinctUntilChanged(this.comparator),
		tap(this.state)
	);

	#statePipeline = this.state.pipe(tap((slice) => this.updateParent(slice, this.selector)));

	#reducerRunner = BaseStore.createReducerRunner(this.reducerConfigurations);

	constructor(
		protected readonly parent: BaseStore<unknown, ParentSlice, Payload>,
		private readonly initialState: Slice,
		private readonly selector: Selector<ParentSlice, Slice>,
		protected readonly wrap: Wrapper<Slice, ParentSlice>,
		private readonly reducerConfigurations: ReducerConfiguration<Slice, Payload>[],
		private readonly comparator?: (a: Slice, b: Slice) => boolean
	) {
		super();
		this.teardown = this.#parentListener.subscribe();
		this.teardown = this.#slicePipeline.subscribe();
		this.teardown = this.#statePipeline.subscribe();
	}
}
