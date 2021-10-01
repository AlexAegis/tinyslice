import {
	BehaviorSubject,
	distinctUntilChanged,
	finalize,
	map,
	Observable,
	shareReplay,
	Subject,
	Subscription,
	tap,
	withLatestFrom,
} from 'rxjs';
import { Action, ActionPacket } from '../action';
import { ReducerConfiguration } from './reducer.type';

export type Selector<State, Slice> = (state: State) => Slice;
export type Wrapper<Slice, State> = (slice: Slice) => Partial<State>;

abstract class BaseStore<ParentState, Slice, Payload> {
	abstract state: BehaviorSubject<Slice>;

	abstract parent: BaseStore<unknown, ParentState, Payload> | undefined;

	abstract wrap: Wrapper<Slice, ParentState> | undefined;

	#sink = new Subscription();

	public reduce(slice: Slice): void {
		if (this.wrap) {
			if (this.parent) {
				this.parent.reduce({ ...this.parent.state.value, ...this.wrap(slice) });
			} else {
				const state = this.state as BehaviorSubject<Slice>;
				state.next({ ...state.value, ...this.wrap(slice) });
			}
		}
	}

	public slice<SubSlice>(
		initialState: SubSlice,
		selector: Selector<Slice, SubSlice>,
		wrapper: Wrapper<SubSlice, Slice>,
		reducers: ReducerConfiguration<SubSlice, Payload>[],
		comparator?: (a: SubSlice, b: SubSlice) => boolean
	): StoreSlice<Slice, SubSlice, Payload> {
		return new StoreSlice(this, initialState, selector, wrapper, reducers, comparator);
	}

	public get listen$(): Observable<Slice> {
		return this.state.pipe(shareReplay(1));
	}

	static createReducerRunner<State, Payload = unknown>(
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

	set teardown(subscription: Subscription) {
		this.#sink.add(subscription);
	}

	public unsubscribe(): void {
		this.#sink.unsubscribe();
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Store<State, Payload = any> extends BaseStore<unknown, State, Payload> {
	parent = undefined;
	wrap = undefined;
	state = new BehaviorSubject<State>(this.initialState);
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
	state = new BehaviorSubject<Slice>(this.initialState);

	#parentListener: Observable<Slice> = this.parent.state.pipe(
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
		readonly parent: BaseStore<unknown, ParentSlice, Payload>,
		private readonly initialState: Slice,
		private readonly selector: Selector<ParentSlice, Slice>,
		readonly wrap: Wrapper<Slice, ParentSlice>,
		private readonly reducerConfigurations: ReducerConfiguration<Slice, Payload>[],
		private readonly comparator?: (a: Slice, b: Slice) => boolean
	) {
		super();
		this.teardown = this.#parentListener.subscribe();
		this.teardown = this.#slicePipeline.subscribe();
	}
}
