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
export type Parent<T> = Record<string | number, T>;
export type SliceMap<State extends Record<keyof State, unknown>> = Record<
	keyof State,
	StoreSlice<Record<keyof State, unknown>>
>;
type OptionsFlags<Type> = {
	[Property in keyof Type]: unknown;
};

// TODO: Problem, each slice creates a new state that will run every reducer again on it's own
abstract class BaseStore<Slice extends Record<string | number, any>>
	extends Observable<Slice>
	implements OptionsFlags<Record<string | number, any>>
{
	protected abstract state: BehaviorSubject<Slice>;
	protected abstract parent: BaseStore<Parent<Slice>> | undefined;
	// TODO: Autowrapper should handle arrays too
	protected abstract wrap: Wrapper<Slice, Parent<Slice>> | undefined;

	#sink = new Subscription();

	constructor(protected readonly initialState: Slice) {
		super();
		(Object.keys(this.initialState) as (keyof Slice)[]).forEach((key) => {
			const selector: Selector<Slice, Record<string | number, unknown>> = (s: Slice) =>
				s[key] as Record<string | number, unknown>;
			const initial = selector(this.initialState);
			const wrapper = (a: Record<string | number, unknown>) =>
				({ [key]: a } as Partial<Slice>);

			Object.assign(this, {
				[key]: new StoreSlice(this as any, initial, selector as any, wrapper, []),
			});
		});
	}
	[x: number | string]: unknown;

	protected reduce(slice: Slice): void {
		if (this.wrap) {
			if (this.parent) {
				this.parent.reduce({ ...(this.parent.state.value as Slice), ...this.wrap(slice) });
			} else {
				const state = this.state as BehaviorSubject<Slice>;
				state.next({ ...state.value, ...this.wrap(slice) });
			}
		}
	}

	slice<SubSlice extends Record<keyof SubSlice, unknown>>(
		selector: Selector<Slice, SubSlice>
	): StoreSlice<SubSlice>;
	slice<SubSliceKey extends keyof Slice, SubSlice extends Slice[SubSliceKey]>(
		key: SubSliceKey
	): StoreSlice<SubSlice>;
	slice<SubSliceKey extends keyof Slice, SubSlice extends Record<keyof SubSlice, unknown>>(
		keyOrSelector: SubSliceKey | Selector<Slice, SubSlice>
	): StoreSlice<SubSlice> {
		if (typeof keyOrSelector === 'string') {
			return this[keyOrSelector as string] as unknown as StoreSlice<SubSlice>;
		} else {
			return (keyOrSelector as Selector<Slice, SubSlice>)(
				this as unknown as Slice
			) as unknown as StoreSlice<SubSlice>;
		}
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
export class Store<State extends Record<keyof State, unknown>>
	extends BaseStore<State>
	implements State
{
	protected parent = undefined;
	protected wrap = undefined;
	protected state = new BehaviorSubject<State>(this.initialState);

	#stateObservable = this.state.asObservable();
	subscribe = this.#stateObservable.subscribe.bind(this.#stateObservable);

	// This emits
	public reducedNotification = new Subject<void>();

	#reducerRunner = Store.createReducerRunner(this.reducerConfigurations);

	// TODO: Never run while reducers are executing and bubbling
	#storePipeline = (Action.dispatcher$ as Observable<ActionPacket<unknown>>).pipe(
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
		protected readonly initialState: State,
		private readonly reducerConfigurations: ReducerConfiguration<State, unknown>[]
	) {
		super(initialState);
	}

	public stop(): void {
		this.#storeSubscription.unsubscribe();
	}
}

export class StoreSlice<Slice extends Record<string | number, unknown>> extends BaseStore<Slice> {
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

	#slicePipeline = (Action.dispatcher$ as Observable<ActionPacket<unknown>>).pipe(
		withLatestFrom(this.state),
		map(([action, state]) => this.#reducerRunner(action, state)),
		tap((slice) => this.reduce(slice))
	);

	#reducerRunner = BaseStore.createReducerRunner(this.reducerConfigurations);

	constructor(
		protected readonly parent: BaseStore<Parent<Slice>>,
		protected readonly initialState: Slice,
		private readonly selector: Selector<Parent<Slice>, Slice>,
		protected readonly wrap: Wrapper<Slice, Parent<Slice>>,
		private readonly reducerConfigurations: ReducerConfiguration<Slice, unknown>[],
		private readonly comparator?: (a: Slice, b: Slice) => boolean
	) {
		super(initialState);
		this.teardown = this.#parentListener.subscribe();
		this.teardown = this.#slicePipeline.subscribe();
	}
}
