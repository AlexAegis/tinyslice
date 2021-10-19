import {
	BehaviorSubject,
	distinctUntilChanged,
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

	#sink = new Subscription();

	protected reduce(slice: Slice): void {
		if (this.wrap) {
			if (this.parent) {
				this.parent.reduce({ ...this.parent.state.value, ...this.wrap(slice) });
			} else {
				const state = this.state as BehaviorSubject<Slice>;
				state.next({ ...state.value, ...this.wrap(slice) });
			}
		}
	}

	public slice<SubSlice extends Slice[keyof Slice]>(
		selector: Selector<Slice, SubSlice>,
		wrapper: Wrapper<SubSlice, Slice>,
		reducers: ReducerConfiguration<SubSlice, Payload>[] = [],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice, SubSlice, Payload> {
		return new StoreSlice(
			this,
			selector(this.state.value),
			selector,
			wrapper,
			reducers,
			comparator
		);
	}

	public dice<SubSliceKey extends keyof Slice, SubSlice extends Slice[SubSliceKey]>(
		key: SubSliceKey,
		reducers: ReducerConfiguration<SubSlice, Payload>[] = [],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice, SubSlice, Payload> {
		return this.slice(
			(state) => state[key] as SubSlice,
			(state) => ({ [key]: state } as unknown as Partial<Slice>),
			reducers,
			comparator
		);
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

	#stateObservable = this.state.asObservable();
	subscribe = this.#stateObservable.subscribe.bind(this.#stateObservable);

	// This emits
	public reducedNotification = new Subject<void>();

	#reducerRunner = Store.createReducerRunner(this.reducerConfigurations);

	// TODO: Never run while reducers are executing and bubbling
	#storePipeline = (Action.dispatcher$ as Observable<ActionPacket<Payload>>).pipe(
		withLatestFrom(this.state),
		map(([action, state]) => this.#reducerRunner(action, state)),
		tap(this.state),
		tap(() => this.reducedNotification.next()),
		finalize(() => {
			this.reducedNotification.complete();
			this.state.complete();
		})
	);

	#storeSubscription = this.#storePipeline.subscribe();

	public constructor(
		public readonly initialState: State,
		private readonly reducerConfigurations: ReducerConfiguration<State, Payload>[]
	) {
		super();
	}

	public stop(): void {
		this.#storeSubscription.unsubscribe();
	}
}

export class StoreSlice<ParentSlice, Slice, Payload> extends BaseStore<
	ParentSlice,
	Slice,
	Payload
> {
	protected state = new BehaviorSubject<Slice>(this.initialState);
	#stateObservable = this.state.asObservable();
	subscribe = this.#stateObservable.subscribe.bind(this.#stateObservable);

	#parentListener: Observable<Slice> = this.parent.pipe(
		map(this.selector),
		distinctUntilChanged(this.comparator),
		tap(this.state),
		finalize(() => {
			this.state.unsubscribe();
			this;
		})
	);

	#slicePipeline = (Action.dispatcher$ as Observable<ActionPacket<Payload>>).pipe(
		withLatestFrom(this.state),
		map(([action, state]) => this.#reducerRunner(action, state)),
		tap((slice) => this.reduce(slice))
	);

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
	}
}
