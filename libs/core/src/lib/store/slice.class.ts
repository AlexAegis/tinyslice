import {
	BehaviorSubject,
	catchError,
	combineLatest,
	distinctUntilChanged,
	filter,
	finalize,
	map,
	NEVER,
	Observable,
	pairwise,
	share,
	skip,
	startWith,
	Subscription,
	switchMap,
	take,
	tap,
	withLatestFrom,
	zip,
} from 'rxjs';
import { Action, ActionConfig, ActionPacket } from '../action';
import {
	createLoggingMetaReducer,
	fastArrayComparator,
	GetNext,
	getNextKeyStrategy,
	getObjectKeysAsNumbers,
	isNonNullable,
	isNullish,
	NextKeyStrategy,
	updateObject,
} from '../helper';
import { TINYSLICE_DEFAULT_PREFIX, TINYSLICE_PREFIX } from '../internal';
import { Merger } from './merger.type';
import {
	MetaPacketReducer,
	PacketReducer,
	ReduceActionSliceSnapshot,
	ReducerConfiguration,
} from './reducer.type';
import { Scope } from './scope.class';
import { Selector } from './selector.type';
import { StrictRuntimeChecks } from './strict-runtime-checks.interface';
import { TinySlicePlugin } from './tinyslice-plugin.interface';

export type ObjectKey = string | number | symbol;
export type UnknownObject<T = unknown> = Record<ObjectKey, T>;
export type SliceDetacher = () => void;

export interface DicedSlice<
	State,
	ChildState,
	ParentInternals,
	ChildInternals,
	DiceKey extends string | number | symbol
> {
	internals: ParentInternals;
	sliceKeys: () => DiceKey[];
	sliceKeys$: Observable<DiceKey[]>;
	latestSlices$: Observable<ChildState[]>;
	add: (data: ChildState) => void;
	create: () => void;
	set: (key: DiceKey, data: ChildState) => void;
	remove: (key: DiceKey) => void;
	getNextKey: () => DiceKey;
	get: (
		key: DiceKey
	) => Slice<State & Record<DiceKey, ChildState>, NonNullable<ChildState>, ChildInternals>;
}

/**
 * This type can be used to get the Child slice signature of a diced slice
 * ```ts
 * const pieDice = pies$.dice({...});
 * DicedSliceChild<typeof pieDice>; // Slice<>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DicedSliceChild<D extends DicedSlice<any, any, any, any, any>> = ReturnType<D['get']>;

export interface SliceCoupling<ParentState, State> {
	parentSlice: Slice<unknown, ParentState, UnknownObject>;
	slicer: SelectSlicer<ParentState, State>;
	lazy: boolean;
}

export interface SliceRegistration<ParentState, State, Internals> {
	slice: Slice<ParentState, State, Internals>;
	slicer: SelectSlicer<ParentState, State>;
	lazyInitialState: State | undefined;
}

export interface SliceOptions<ParentState, State, Internals> {
	reducers?: ReducerConfiguration<State>[];
	plugins?: TinySlicePlugin<State>[];
	metaReducers?: MetaPacketReducer<State>[];
	/**
	 * ? Setting the passed slices Internal generic to unknown is crucial for
	 * ? type inference to work
	 */
	defineInternals?: (slice: Slice<ParentState, State, unknown>) => Internals;
	useDefaultLogger?: boolean;
}

export interface RootSliceOptions<State, Internals> extends SliceOptions<never, State, Internals> {
	/**
	 * Runtime checks can slow the store down, turn them off in production,
	 * they are all on by default.
	 */
	runtimeChecks?: StrictRuntimeChecks;
}

export type RootSlice<State, Internals = unknown> = Slice<never, State, Internals>;

export interface SliceConstructOptions<ParentState, State, Internals>
	extends SliceOptions<ParentState, State, Internals> {
	scope: Scope;
	initialState: State;
	parentCoupling?: SliceCoupling<ParentState, State>;
	pathSegment: string;
}

export interface DiceConstructOptions<State, ChildState, ChildInternals, DiceKey>
	extends SliceOptions<State, ChildState, ChildInternals> {
	getAllKeys: (state: State) => DiceKey[];
	getNextKey: GetNext<DiceKey>;
}

export interface PremadeDiceConstructOptions<
	ParentState,
	State,
	ChildState,
	Internals,
	ChildInternals
> extends SliceOptions<State, ChildState, ChildInternals> {
	getNextKeyStrategy?: NextKeyStrategy;
	dicedSliceOptions?: SliceOptions<ParentState, State, Internals>;
}

const extractSliceOptions = <ParentState, State, Internals>(
	constructOptions?: SliceOptions<ParentState, State, Internals>
): SliceOptions<ParentState, State, Internals> => {
	return {
		defineInternals: constructOptions?.defineInternals,
		metaReducers: constructOptions?.metaReducers,
		plugins: constructOptions?.plugins,
		reducers: constructOptions?.reducers,
		useDefaultLogger: constructOptions?.useDefaultLogger,
	};
};

export interface ChildSliceConstructOptions<ParentState, State, Internals>
	extends SliceOptions<ParentState, State, Internals> {
	initialState?: State;
	lazy: boolean;
	pathSegment: string;
	slicer: SelectSlicer<ParentState, State>;
}

export type SelectSlicer<ParentState, State> = {
	selector: Selector<ParentState, State>;
	merger: Merger<ParentState, State>;
};

/**
 * TODO: Create a variant where the key must not already be part of ParentState
 * TODO: and State must not already be a value of ParentState
 */
export type SliceDirection<ParentState, State> =
	| string
	| number
	| symbol
	| keyof ParentState
	| SelectSlicer<ParentState, State>;

export const normalizeSliceDirection = <ParentState, State>(
	sliceDirection: SliceDirection<ParentState, State>
): SelectSlicer<ParentState, State> => {
	if (typeof sliceDirection === 'object') {
		return sliceDirection;
	} else {
		const key = sliceDirection;
		const selector: Selector<ParentState, State> = (state) =>
			state[key as keyof ParentState] as State;
		const merger: Merger<ParentState, State | undefined> = (state, slice) => {
			if (isNullish(state)) {
				return state;
			}
			// completely remove the key for cleaner decoupling
			if (slice === undefined) {
				const next = {
					...state,
				};
				delete state[key as keyof ParentState];
				return next;
			} else {
				return {
					...state,
					[key]: slice,
				};
			}
		};

		return {
			merger,
			selector,
		};
	}
};

/**
 * It's pizza time!
 */
export class Slice<ParentState, State, Internals = unknown> extends Observable<State> {
	#sink = new Subscription();
	#metaReducerConfigurations$: BehaviorSubject<MetaPacketReducer<State>[]>;
	#metaReducer$: Observable<MetaPacketReducer<State>>;

	#scope: Scope;
	#initialState: State;
	#parentCoupling: SliceCoupling<ParentState, State> | undefined;
	#initialReducers: ReducerConfiguration<State>[];
	#initialPlugins: TinySlicePlugin<State>[];
	#initialMetaReducers: MetaPacketReducer<State>[];
	#state$: BehaviorSubject<State>;
	#pathSegment: string;
	#absolutePath: string;
	setAction: Action<State>;
	updateAction: Action<Partial<State>>;
	deleteKeyAction: Action<ObjectKey>;
	defineKeyAction: Action<{ key: ObjectKey; data: unknown }>;
	#observableState$: Observable<State>;
	#reducerConfigurations$: BehaviorSubject<ReducerConfiguration<State>[]>;
	#autoRegisterReducerActions$: Observable<ReducerConfiguration<State, unknown>[]>;
	#sliceReducer$: Observable<PacketReducer<State>>;
	#plugins$: BehaviorSubject<TinySlicePlugin<State>[]>;
	#autoRegisterPlugins$: Observable<unknown>;
	#paused$: BehaviorSubject<boolean>;

	#slices$ = new BehaviorSubject<Record<string, SliceRegistration<State, unknown, Internals>>>(
		{}
	);

	override subscribe;

	// Listens to the parent for changes to select itself from
	// check if the parent could do it instead
	#parentListener: Observable<State | undefined> | undefined;
	#schedule: Observable<
		[
			ActionPacket<unknown>,
			{
				snapshot: ReduceActionSliceSnapshot<unknown>;
				sliceRegistration: SliceRegistration<State, unknown, Internals>;
			}[]
		]
	>;
	#inactivePipeline: Observable<ReduceActionSliceSnapshot<State>>;
	#activePipeline: Observable<ReduceActionSliceSnapshot<State>>;

	#pipeline: Observable<ReduceActionSliceSnapshot<State>>;

	#defineInternals: ((state: Slice<ParentState, State, unknown>) => Internals) | undefined;
	#internals: Internals;
	#scopedActions: Action<unknown>[] = [];

	get internals(): Internals {
		return this.#internals;
	}

	get absolutePath(): string {
		return this.#absolutePath;
	}

	get pathSegment(): string {
		return this.#pathSegment;
	}

	/**
	 *
	 * @param initialState
	 * @param sliceSegment a string that represents this slice, has to be
	 * unique on it's parent.
	 */
	private constructor(options: SliceConstructOptions<ParentState, State, Internals>) {
		super();
		this.#scope = options.scope;
		this.#pathSegment = options.pathSegment;
		this.#initialState = options.initialState;
		this.#parentCoupling = options.parentCoupling;
		this.#initialReducers = options.reducers ?? [];
		this.#initialPlugins = options.plugins ?? [];
		this.#initialMetaReducers = options.metaReducers ?? [];
		this.#defineInternals = options.defineInternals;

		this.#paused$ = new BehaviorSubject(false);

		this.#absolutePath = Slice.calculateAbsolutePath(this.#parentCoupling, this.#pathSegment);

		this.setAction = this.createAction<State>(
			`${TINYSLICE_DEFAULT_PREFIX} set ${this.#absolutePath}`
		);
		this.updateAction = this.createAction<Partial<State>>(
			`${TINYSLICE_DEFAULT_PREFIX} update ${this.#absolutePath}`
		);

		this.deleteKeyAction = this.createAction<ObjectKey>(
			`${TINYSLICE_DEFAULT_PREFIX} delete key ${this.#absolutePath}`
		);

		this.defineKeyAction = this.createAction<{ key: ObjectKey; data: unknown }>(
			`${TINYSLICE_DEFAULT_PREFIX} define key ${this.#absolutePath}`
		);

		this.#state$ = new BehaviorSubject<State>(this.#initialState);
		this.#observableState$ = this.#state$.pipe(distinctUntilChanged());

		this.#reducerConfigurations$ = new BehaviorSubject<ReducerConfiguration<State>[]>([
			this.setAction.reduce((state, payload) => payload ?? state),
			this.updateAction.reduce((state, payload) => updateObject(state, payload)),
			this.deleteKeyAction.reduce((state, payload) => {
				const nextState = { ...state };
				delete nextState[payload as keyof State];
				return nextState;
			}),
			this.defineKeyAction.reduce((state, payload) => ({
				...state,
				[payload.key]: payload.data,
			})),
			...this.#initialReducers,
		]);

		this.#autoRegisterReducerActions$ = this.#reducerConfigurations$.pipe(
			tap((reducerConfigurations) => {
				for (const reducerConfiguration of reducerConfigurations) {
					this.#scope.registerAction(reducerConfiguration.action);
				}
			})
		);

		this.#metaReducerConfigurations$ = new BehaviorSubject<MetaPacketReducer<State>[]>([
			...(options?.useDefaultLogger ? [createLoggingMetaReducer<State>()] : []),
			...this.#initialMetaReducers,
		]);

		this.#metaReducer$ = this.#metaReducerConfigurations$.pipe(
			map((metaReducerConfigurations) => (snapshot: ReduceActionSliceSnapshot<State>) => {
				for (const metaReducerConfiguration of metaReducerConfigurations) {
					metaReducerConfiguration(snapshot);
				}
			})
		);

		this.#sliceReducer$ = this.#reducerConfigurations$.pipe(
			map((reducerConfigurations) => (state, action) => {
				let nextState = state;
				if (action) {
					nextState = reducerConfigurations
						.filter((rc) => rc.action.type === action.type)
						.reduce((acc, { packetReducer }) => packetReducer(acc, action), state);
				}
				return nextState;
			})
		);

		this.#schedule = zip(
			this.#scope.schedulingDispatcher$,
			this.#slices$.pipe(
				map((sliceRegistrations) => Object.values(sliceRegistrations)),
				switchMap((sliceRegistrations) => {
					if (sliceRegistrations.length) {
						return zip(
							sliceRegistrations.map((sliceRegistration) =>
								sliceRegistration.slice.#pipeline.pipe(
									map((snapshot) => ({ snapshot, sliceRegistration }))
								)
							)
						);
					} else {
						return this.#scope.schedulingDispatcher$.pipe(map(() => []));
					}
				})
			)
		);

		this.#activePipeline = this.#schedule.pipe(
			withLatestFrom(this.#state$, this.#sliceReducer$),
			map(
				([
					[action, sliceChanges],
					prevState,
					reducer,
				]): ReduceActionSliceSnapshot<State> => {
					if (this.#isRootOrParentStateUndefined()) {
						return {
							action,
							prevState,
							nextState: prevState,
						};
					}

					const withSliceChanges: State = sliceChanges
						.filter(
							(sliceChange) =>
								sliceChange.snapshot.prevState !== sliceChange.snapshot.nextState
						)
						.reduce(
							(prevState, sliceChange) =>
								sliceChange.sliceRegistration.slicer.merger(
									prevState,
									sliceChange.snapshot.nextState
								),
							prevState
						);

					const nextState = reducer(withSliceChanges, action);

					return {
						action,
						prevState,
						nextState,
					};
				}
			),
			tap((snapshot) => {
				if (snapshot.prevState !== snapshot.nextState) {
					this.#state$.next(snapshot.nextState);
				}
			}),
			withLatestFrom(this.#metaReducer$),
			tap(([snapshot, metaReducer]) => {
				metaReducer(snapshot);
				if (snapshot.prevState !== snapshot.nextState) {
					this.#state$.next(snapshot.nextState);
				}
			}),
			map(([snapshot, _metaReducer]) => snapshot),
			catchError((error, pipeline$) => {
				console.error(`${TINYSLICE_PREFIX} slice pipeline error \n`, error);
				return this.#plugins$.pipe(
					take(1),
					tap((plugins) => {
						for (const plugin of plugins) {
							plugin.onError?.(error);
						}
					}),
					switchMap(() => pipeline$)
				);
			})
		) as Observable<ReduceActionSliceSnapshot<State>>;

		this.#inactivePipeline = this.#scope.schedulingDispatcher$.pipe(
			withLatestFrom(this.#state$),
			map(([, state]) => {
				return {
					action: { type: 'paused', payload: undefined },
					prevState: state,
					nextState: undefined,
				} as ReduceActionSliceSnapshot<State>;
			})
		);

		this.#pipeline = this.#paused$.pipe(
			switchMap((paused) => (paused ? this.#inactivePipeline : this.#activePipeline)),
			finalize(() => this.complete()),
			share() // Listened to by child slices
		);

		this.#plugins$ = new BehaviorSubject<TinySlicePlugin<State>[]>(this.#initialPlugins);

		// Listens to the parent for changes to select itself from
		// check if the parent could do it instead
		this.#parentListener = this.#parentCoupling?.parentSlice.pipe(
			finalize(() => this.complete()),
			skip(1),
			map((parentState) => {
				const slice = this.#parentCoupling?.slicer.selector(parentState);

				if (this.#parentCoupling?.lazy && !isNonNullable(slice)) {
					return this.#initialState;
				} else {
					return slice;
				}
			}),

			distinctUntilChanged(),
			tap((parentSlice) => this.#state$.next(parentSlice as State))
		);

		this.#autoRegisterPlugins$ = this.#plugins$.pipe(
			startWith([]),
			pairwise(),
			tap(([p, n]) => {
				for (const plugin of p) {
					plugin.stop();
				}
				for (const plugin of n) {
					this.#registerPlugin(plugin);
				}
			})
		);

		this.subscribe = this.#observableState$
			.pipe(filter(isNonNullable))
			.subscribe.bind(this.#observableState$);

		this.#scope.slices.set(this.#absolutePath, this);

		this.#internals = this.#defineInternals?.(this) ?? ({} as Internals);
		this.#start();
	}

	#start() {
		if (this.#parentCoupling) {
			this.#parentCoupling.parentSlice.#registerSlice({
				slice: this,
				slicer: this.#parentCoupling.slicer,
				lazyInitialState: this.#initialState,
			});

			this.#sink.add(this.#parentListener?.subscribe());
		}

		this.#sink.add(this.#autoRegisterReducerActions$.subscribe());
		this.#sink.add(this.#autoRegisterPlugins$.subscribe());
		this.#sink.add(this.#pipeline.subscribe()); // Slices are hot!
	}

	public get paused$(): Observable<boolean> {
		return this.#paused$.asObservable();
	}

	/**
	 * Unpauses this slice and every child slice recursively
	 */
	public unpause(): void {
		if (this.#paused$.value) {
			this.#paused$.next(false);
		}
		for (const subSlice of Object.values(this.#slices$.value)) {
			subSlice.slice.unpause();
		}
	}

	/**
	 * Pauses this slice and every child slice recursively
	 */
	public pause(): void {
		if (!this.#paused$.value) {
			this.#paused$.next(true);
		}
		for (const subSlice of Object.values(this.#slices$.value)) {
			subSlice.slice.pause();
		}
	}

	/**
	 * Effects created here will respond to the pause and unpauseEffects functions.
	 * These effects will also unsubscribe if the slice unsubscribes
	 */
	public createEffect<Output>(packet$: Observable<Output | ActionPacket>): Subscription {
		const pausablePacket$ = this.paused$.pipe(
			switchMap((isPaused) => (isPaused ? NEVER : packet$))
		);
		const effectSubscription = this.#scope.createEffect(pausablePacket$);
		this.#sink.add(effectSubscription);
		return effectSubscription;
	}

	public setPlugins(plugins: TinySlicePlugin<State>[]): void {
		this.#plugins$.next(plugins);
	}

	public getPlugins(): TinySlicePlugin<State>[] {
		return this.#plugins$.value;
	}

	public addPlugin(...plugins: TinySlicePlugin<State>[]): void {
		this.#plugins$.next([...this.#plugins$.value, ...plugins]);
	}

	public setMetaReducers(metaReducerConfigurations: MetaPacketReducer<State>[]): void {
		this.#metaReducerConfigurations$.next(metaReducerConfigurations);
	}

	public getMetaReducers(): MetaPacketReducer<State>[] {
		return this.#metaReducerConfigurations$.value;
	}

	public addMetaReducer(...metaReducerConfigurations: MetaPacketReducer<State>[]): void {
		this.#metaReducerConfigurations$.next([
			...this.#metaReducerConfigurations$.value,
			...metaReducerConfigurations,
		]);
	}

	static assembleAbsolutePath(parentAbsolutePath: string, segment: string): string {
		return `${parentAbsolutePath}${parentAbsolutePath ? '.' : ''}${segment}`;
	}

	private static calculateAbsolutePath<ParentState, State>(
		parentCoupling: SliceCoupling<ParentState, State> | undefined,
		pathSegment: string
	): string {
		if (parentCoupling) {
			return Slice.assembleAbsolutePath(
				parentCoupling.parentSlice.#absolutePath,
				pathSegment
			);
		} else {
			return pathSegment;
		}
	}

	#registerPlugin(plugin: TinySlicePlugin<State>): TinySlicePlugin<State> {
		plugin.register({
			initialState: this.#state$.value,
			state$: this.#pipeline,
			stateInjector: (state: State) => this.#state$.next(state),
		});
		plugin.start();
		return plugin;
	}

	public set(slice: State): void {
		this.setAction.next(slice);
	}

	public update(slice: Partial<State>): void {
		this.updateAction.next(slice);
	}

	set value(value: State) {
		this.set(value);
	}

	get value(): State {
		return this.#state$.value;
	}

	#isRootOrParentStateUndefined(): boolean {
		return this.#parentCoupling
			? isNullish(this.#parentCoupling.parentSlice.#state$.value)
			: false;
	}

	public static createRootSlice<State, Internals>(
		scope: Scope,
		initialState: State,
		sliceOptions?: RootSliceOptions<State, Internals>
	): RootSlice<State, Internals> {
		return new Slice({
			...extractSliceOptions(sliceOptions),
			scope,
			initialState,
			pathSegment: 'root',
		});
	}

	public createAction<Packet>(name: string, actionOptions?: ActionConfig): Action<Packet> {
		const actionName = `${this.#absolutePath} ${name}`;
		const action = this.#scope.createAction<Packet>(actionName, {
			...actionOptions,
			pauseWhile: this.paused$,
		});
		this.#scopedActions.push(action as Action<unknown>);
		return action;
	}

	#slice<ChildState, ChildInternals>(
		childSliceConstructOptions: ChildSliceConstructOptions<State, ChildState, ChildInternals>
	): Slice<State, NonNullable<ChildState>, ChildInternals> {
		const path = Slice.assembleAbsolutePath(
			this.#absolutePath,
			childSliceConstructOptions.pathSegment.toString()
		);
		if (this.#scope.slices.has(path)) {
			// ? If this proves to be error prone just throw an error
			// ? Double define should be disallowed anyway
			return this.#scope.slices.get(path) as Slice<
				State,
				NonNullable<ChildState>,
				ChildInternals
			>;
		} else {
			const initialStateFromParent: ChildState | undefined = this.#state$.value
				? childSliceConstructOptions.slicer.selector(this.#state$.value)
				: undefined;

			const initialState: ChildState =
				initialStateFromParent ?? (childSliceConstructOptions.initialState as ChildState);

			return new Slice<State, ChildState, ChildInternals>({
				...extractSliceOptions(childSliceConstructOptions),
				scope: this.#scope,
				initialState,
				parentCoupling: {
					parentSlice: this as Slice<unknown, State, UnknownObject>,
					slicer: childSliceConstructOptions.slicer,
					lazy: childSliceConstructOptions.lazy ?? false,
				},
				pathSegment: childSliceConstructOptions.pathSegment,
			}) as Slice<State, NonNullable<ChildState>, ChildInternals>;
		}
	}

	/**
	 * @deprecated remove this, too much trouble because of selector.toString(), use dice instead
	 */
	public sliceSelect<ChildState extends State[keyof State], ChildInternals = unknown>(
		selector: Selector<State, ChildState>,
		merger: Merger<State, ChildState>,
		sliceOptions?: SliceOptions<State, ChildState, ChildInternals>
	): Slice<State, NonNullable<ChildState>, ChildInternals> {
		return this.#slice({
			...sliceOptions,
			initialState: undefined,
			lazy: true,
			slicer: {
				selector,
				merger,
			},
			pathSegment: selector.toString(),
		});
	}

	public slice<ChildStateKey extends keyof State, ChildInternals>(
		key: ChildStateKey,
		sliceOptions?: SliceOptions<State, NonNullable<State[ChildStateKey]>, ChildInternals>
	): Slice<State, NonNullable<State[ChildStateKey]>, ChildInternals> {
		const slicer = normalizeSliceDirection<State, NonNullable<State[ChildStateKey]>>(key);

		return this.#slice({
			...sliceOptions,
			pathSegment: key.toString(),
			slicer,
			lazy: false,
		});
	}

	/**
	 * Adds non-defined slices to extend this slice
	 * ? https://github.com/microsoft/TypeScript/issues/42315
	 * ? key could be restricted to disallow keys of Slice once negated types
	 * ? are implemented in TypeScript
	 */
	public addSlice<
		ChildState,
		ChildInternals,
		AdditionalKey extends string | number | symbol = string
	>(
		key: AdditionalKey,
		initialState: ChildState,
		sliceOptions?: SliceOptions<State, ChildState, ChildInternals>
	): Slice<State & Record<AdditionalKey, ChildState>, NonNullable<ChildState>, ChildInternals> {
		const slicer = normalizeSliceDirection<State, ChildState>(key);
		return this.#slice({
			...sliceOptions,
			initialState,
			pathSegment: key.toString(),
			slicer,
			lazy: true,
		}) as Slice<
			State & Record<AdditionalKey, ChildState>,
			NonNullable<ChildState>,
			ChildInternals
		>;
	}

	/**
	 * Adds a new lazy slice then dices it with a number type record,
	 * you can choose between nextKeyStrategies:
	 * - NEXT_SMALLEST
	 * - NEXT_LARGEST,
	 * - CUSTOM
	 *
	 * NEXT_LARGEST is the default as thats the simplest.
	 *
	 * ! make sure key doesn't exist via generics on State once that can be done in TS
	 */
	public addDicedSlice<
		Key extends ObjectKey,
		ChildState,
		DicedInternals,
		ChildInternals,
		DiceState extends Record<number, ChildState>
	>(
		key: Key extends keyof State ? never : Key,
		initialState: ChildState,
		diceConstructOptions: PremadeDiceConstructOptions<
			State,
			DiceState,
			ChildState,
			DicedInternals,
			ChildInternals
		>
	): DicedSlice<State, ChildState, DicedInternals, ChildInternals, number> {
		return this.addSlice(key, {} as DiceState, diceConstructOptions.dicedSliceOptions).dice(
			initialState,
			{
				...diceConstructOptions,
				getAllKeys: getObjectKeysAsNumbers,
				getNextKey: getNextKeyStrategy(diceConstructOptions.getNextKeyStrategy),
			}
		);
	}

	/**
	 * This slice type is created on the fly for N subsclices of the same type
	 * great for complex entities that spawn on the fly and have their own
	 * state definition.
	 *
	 * This defines two layers of state at once. The middle layer stores the bottom layers
	 * you can ask for bottom layers lazyly using a selector. You'll then receive the
	 * slice object and, all the other guts you predefined, like state observers, actions, etc
	 *
	 * Actions are automatically scoped to these selected subslices
	 *
	 * Nomenclature: Slicing means to take a single piece of state, dicing is multiple
	 */
	public dice<ChildState, ChildInternals, DiceKey extends string | number | symbol>(
		initialState: ChildState,
		diceConstructOptions: DiceConstructOptions<State, ChildState, ChildInternals, DiceKey>
	): DicedSlice<State, ChildState, Internals, ChildInternals, DiceKey> {
		const internals = this.internals;
		const get = (key: DiceKey) =>
			this.addSlice(key, initialState, extractSliceOptions(diceConstructOptions));
		const set = (key: DiceKey, data: ChildState) => this.defineKeyAction.next({ key, data });
		const remove = (key: DiceKey) => this.deleteKeyAction.next(key);
		const sliceKeys = () => diceConstructOptions.getAllKeys(this.value);
		const getNextKey = () => diceConstructOptions.getNextKey(sliceKeys());
		const add = (data: ChildState) => this.defineKeyAction.next({ key: getNextKey(), data });
		const create = () => this.defineKeyAction.next({ key: getNextKey(), data: undefined });

		const sliceKeys$ = this.pipe(
			map((state) => diceConstructOptions.getAllKeys(state)),
			distinctUntilChanged(fastArrayComparator)
		);
		const latestSlices$ = sliceKeys$.pipe(
			map((keys) => keys.map((key) => get(key))),
			switchMap((slices) => combineLatest(slices))
		);

		return {
			sliceKeys,
			sliceKeys$,
			latestSlices$,
			internals,
			add,
			set,
			remove,
			create,
			getNextKey,
			get,
		};
	}

	#registerSlice<ChildState, ChildInternals>(
		sliceRegistration: SliceRegistration<State, ChildState, ChildInternals>
	): SliceDetacher {
		this.#slices$.next({
			...this.#slices$.value,
			[sliceRegistration.slice.#pathSegment]: sliceRegistration as SliceRegistration<
				State,
				unknown,
				never
			>,
		});

		if (sliceRegistration.lazyInitialState) {
			this.setAction.next(
				sliceRegistration.slicer.merger(this.value, sliceRegistration.lazyInitialState)
			);
		}

		return () => this.#unregisterSlice(sliceRegistration.slice.#pathSegment);
	}

	#unregisterSlice(pathSegment: string): void {
		const nextSlicesSet = {
			...this.#slices$.value,
		};
		const sliceToBeDeleted = nextSlicesSet[pathSegment];
		sliceToBeDeleted.slice.complete();
		delete nextSlicesSet[pathSegment];
		// delete nextSlicesSet[`${this.#path}.${pathSegment}`];
		this.#slices$.next(nextSlicesSet);
	}

	/**
	 * Tears down itself and anything below
	 */
	public complete(): void {
		console.log('COMPLETE');
		this.#paused$.complete();
		this.#state$.complete();
		this.#slices$.complete();
		this.#plugins$.complete();
		this.#metaReducerConfigurations$.complete();
		this.#reducerConfigurations$.complete();
		this.#scopedActions.forEach((scopedAction) => {
			scopedAction.complete();
		});
		this.#scope.slices.delete(this.#absolutePath);
		this.#sink.unsubscribe();
	}

	public asObservable(): Observable<State> {
		return this.pipe();
	}
}
