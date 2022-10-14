import {
	BehaviorSubject,
	catchError,
	combineLatest,
	distinctUntilChanged,
	filter,
	finalize,
	firstValueFrom,
	map,
	NEVER,
	Observable,
	of,
	pairwise,
	share,
	skip,
	startWith,
	Subscription,
	switchMap,
	take,
	takeWhile,
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
	slice: Slice<unknown, State & Record<DiceKey, ChildState>, ParentInternals>;
	keys: () => DiceKey[];
	keys$: Observable<DiceKey[]>;
	count$: Observable<number>;
	items$: Observable<ChildState[]>;
	some$: (predicate: (item: ChildState) => boolean) => Observable<boolean>;
	every$: (predicate: (item: ChildState) => boolean) => Observable<boolean>;
	add: (data: ChildState) => void;
	create: () => void;
	set: (key: DiceKey, data: ChildState) => void;
	remove: (key: DiceKey) => void;
	getNextKey: () => DiceKey;
	has: (key: DiceKey) => boolean;
	get: (
		key: DiceKey
	) => Slice<State & Record<DiceKey, ChildState>, NonNullable<ChildState>, ChildInternals>;
	selectOnceDefined: (
		key: DiceKey
	) => Promise<
		Slice<State & Record<DiceKey, ChildState>, NonNullable<ChildState>, ChildInternals>
	>;
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
	rawParentState: Observable<ParentState>;
	/**
	 * Used to check the lifetime of the slice, once the key itself is removed
	 * from the parent object, the subslice is completed.
	 * Most subslices are attached via a key, only custom select baseds are not.
	 */
	key?: string;
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
	key: string | undefined;
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
		const selector: Selector<ParentState, State> = (state) => {
			if (state && typeof state === 'object') {
				return state[key as keyof ParentState] as State;
			} else {
				return undefined as State;
			}
		};
		const merger: Merger<ParentState, State | undefined> = (state, slice) => {
			if (isNullish(state)) {
				return state;
			}
			// completely remove the key for cleaner decoupling
			if (slice === undefined) {
				if (state && typeof state === 'object') {
					const next = {
						...state,
					};
					delete state[key as keyof ParentState];
					return next;
				} else {
					return state;
				}
			} else if (typeof state === 'object') {
				return {
					...state,
					[key]: slice,
				};
			} else {
				return state;
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
	#defaultMetaReducers: MetaPacketReducer<State>[];
	#state$: BehaviorSubject<State>;
	#pathSegment: string;
	#absolutePath: string;
	setAction: Action<State>;
	updateAction: Action<Partial<State>>;
	deleteKeyAction: Action<ObjectKey>;
	defineKeyAction: Action<{ key: ObjectKey; data: unknown }>;
	#observableState$: Observable<State>;
	#defaultReducerConfigurations: ReducerConfiguration<State>[];
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

	#schedule: Observable<{
		action: ActionPacket<unknown>;
		sliceChanges:
			| {
					snapshot: ReduceActionSliceSnapshot<unknown>;
					sliceRegistration: SliceRegistration<State, unknown, Internals>;
			  }[]
			| undefined;
	}>;
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

		this.setAction = this.createAction<State>(`${TINYSLICE_DEFAULT_PREFIX} set`);
		this.updateAction = this.createAction<Partial<State>>(`${TINYSLICE_DEFAULT_PREFIX} update`);

		this.deleteKeyAction = this.createAction<ObjectKey>(
			`${TINYSLICE_DEFAULT_PREFIX} delete key`
		);

		this.defineKeyAction = this.createAction<{ key: ObjectKey; data: unknown }>(
			`${TINYSLICE_DEFAULT_PREFIX} define key`
		);

		this.#state$ = new BehaviorSubject<State>(this.#initialState);
		this.#observableState$ = this.#state$.pipe(distinctUntilChanged());

		this.#defaultReducerConfigurations = [
			this.setAction.reduce((state, payload) => payload ?? state),
			this.updateAction.reduce((state, payload) => updateObject(state, payload)),
			this.deleteKeyAction.reduce((state, payload) => {
				if (typeof state === 'object') {
					const nextState = { ...state };
					delete (nextState as State)?.[payload as keyof State];
					return nextState;
				} else {
					return state;
				}
			}),
			this.defineKeyAction.reduce((state, payload) => {
				if (typeof state === 'object') {
					return {
						...state,
						[payload.key]: payload.data,
					};
				} else {
					return state;
				}
			}),
		];

		this.#defaultMetaReducers = options?.useDefaultLogger
			? [createLoggingMetaReducer<State>()]
			: [];

		this.#reducerConfigurations$ = new BehaviorSubject<ReducerConfiguration<State>[]>([
			...this.#defaultReducerConfigurations,
			...this.#initialReducers,
		]);

		this.#metaReducerConfigurations$ = new BehaviorSubject<MetaPacketReducer<State>[]>([
			...this.#defaultMetaReducers,
			...this.#initialMetaReducers,
		]);

		this.#metaReducer$ = this.#metaReducerConfigurations$.pipe(
			map((metaReducerConfigurations) => (snapshot: ReduceActionSliceSnapshot<State>) => {
				for (const metaReducerConfiguration of metaReducerConfigurations) {
					metaReducerConfiguration(snapshot);
				}
			})
		);

		this.#autoRegisterReducerActions$ = this.#reducerConfigurations$.pipe(
			tap((reducerConfigurations) => {
				for (const reducerConfiguration of reducerConfigurations) {
					this.#scope.registerAction(reducerConfiguration.action);
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

		const zipSubSlices = (
			sliceRegistrations: Record<string, SliceRegistration<State, unknown, Internals>>,
			fallback: Observable<unknown>
		) => {
			const subSlicePipelines = Object.values(sliceRegistrations).map((sliceRegistration) =>
				sliceRegistration.slice.#pipeline.pipe(
					map((snapshot) => ({ snapshot, sliceRegistration }))
				)
			);
			if (subSlicePipelines.length) {
				return zip(subSlicePipelines);
			} else {
				return fallback.pipe(map(() => []));
			}
		};

		const subSliceEmissions = this.#slices$.pipe(
			switchMap((sl) => zipSubSlices(sl, this.#scope.schedulingDispatcher$))
		);

		this.#schedule = zip(this.#scope.schedulingDispatcher$, subSliceEmissions).pipe(
			map(([action, sliceChanges]) => ({ action, sliceChanges }))
		);

		this.#activePipeline = this.#schedule.pipe(
			withLatestFrom(this.#state$, this.#sliceReducer$),
			map(
				([
					{ action, sliceChanges },
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

					const withSliceChanges: State =
						sliceChanges
							?.filter(
								(sliceChange) =>
									sliceChange.snapshot.prevState !==
									sliceChange.snapshot.nextState
							)
							.reduce(
								(prevState, sliceChange) =>
									sliceChange.sliceRegistration.slicer.merger(
										prevState,
										sliceChange.snapshot.nextState
									),
								prevState
							) ?? prevState;

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
			distinctUntilChanged(),
			switchMap((paused) => (paused ? this.#inactivePipeline : this.#activePipeline)),
			share() // Listened to by child slices
		);

		this.#plugins$ = new BehaviorSubject<TinySlicePlugin<State>[]>(this.#initialPlugins);

		// Listens to the parent for changes to select itself from
		// check if the parent could do it instead
		this.#parentListener = this.#parentCoupling?.rawParentState.pipe(
			skip(1),
			finalize(() => this.complete()),
			takeWhile((parentState) =>
				this.#parentCoupling?.key && parentState && typeof parentState === 'object'
					? Object.hasOwn(parentState, this.#parentCoupling.key)
					: true
			),
			map((parentState) => this.#parentCoupling?.slicer.selector(parentState)),
			distinctUntilChanged(),
			tap((stateFromParent) => this.#state$.next(stateFromParent as State))
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

	public getMetaReducers(): MetaPacketReducer<State>[] {
		return this.#metaReducerConfigurations$.value;
	}

	public setMetaReducers(metaReducerConfigurations: MetaPacketReducer<State>[]): void {
		this.#metaReducerConfigurations$.next([
			...this.#defaultMetaReducers,
			...metaReducerConfigurations,
		]);
	}

	public addMetaReducer(...metaReducerConfigurations: MetaPacketReducer<State>[]): void {
		this.#metaReducerConfigurations$.next([
			...this.#metaReducerConfigurations$.value,
			...metaReducerConfigurations,
		]);
	}

	public getReducers(): ReducerConfiguration<State>[] {
		return this.#reducerConfigurations$.value;
	}

	/**
	 * This does not disable default redurces.
	 */
	public setReducers(reducers: ReducerConfiguration<State>[]): void {
		this.#reducerConfigurations$.next([...this.#defaultReducerConfigurations, ...reducers]);
	}

	public addReducers(reducers: ReducerConfiguration<State>[]): void {
		this.#reducerConfigurations$.next([...this.#reducerConfigurations$.value, ...reducers]);
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
					rawParentState: this.#observableState$,
					slicer: childSliceConstructOptions.slicer,
					lazy: childSliceConstructOptions.lazy ?? false,
					key: childSliceConstructOptions.key,
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
			key: undefined,
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
			key: key as string,
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
			key: key as string,
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
		const sliceOptions = extractSliceOptions(diceConstructOptions);
		const get = (key: DiceKey) => this.addSlice(key, initialState, sliceOptions);
		const has = (key: DiceKey) =>
			this.#state$.value && typeof this.#state$.value === 'object'
				? Object.keys(this.#state$.value).includes(key as string)
				: false;
		const set = (key: DiceKey, data: ChildState) => this.defineKeyAction.next({ key, data });
		const remove = (key: DiceKey) => this.deleteKeyAction.next(key);
		const keys = () => diceConstructOptions.getAllKeys(this.value);
		const getNextKey = () => diceConstructOptions.getNextKey(keys());
		const add = (data: ChildState) => this.defineKeyAction.next({ key: getNextKey(), data });
		const create = () => this.defineKeyAction.next({ key: getNextKey(), data: undefined });

		const keys$ = this.pipe(
			map((state) => diceConstructOptions.getAllKeys(state)),
			distinctUntilChanged(fastArrayComparator)
		);
		const items$ = keys$.pipe(
			map((keys) => keys.map((key) => get(key))),
			switchMap((slices) => (slices.length ? combineLatest(slices) : of([])))
		);
		const count$ = keys$.pipe(map((keys) => keys.length));
		const some$ = (predicate: (item: ChildState) => boolean) =>
			items$.pipe(map((items) => items.some(predicate)));
		const every$ = (predicate: (item: ChildState) => boolean) =>
			items$.pipe(map((items) => items.every(predicate)));

		const selectOnceDefined = (key: DiceKey) =>
			firstValueFrom(
				keys$.pipe(
					filter((keys) => keys.includes(key)),
					map(
						() =>
							this.slice(
								key as unknown as keyof State,
								sliceOptions as unknown as SliceOptions<
									State,
									NonNullable<State[keyof State]>,
									ChildInternals
								>
							) as unknown as Slice<
								State & Record<DiceKey, ChildState>,
								NonNullable<ChildState>,
								ChildInternals
							>
					)
				)
			);

		return {
			slice: this as Slice<unknown, State & Record<DiceKey, ChildState>, Internals>,
			selectOnceDefined,
			has,
			get,
			keys,
			keys$,
			count$,
			items$,
			some$,
			every$,
			add,
			set,
			remove,
			create,
			getNextKey,
		};
	}

	#registerSlice<ChildState, ChildInternals>(
		sliceRegistration: SliceRegistration<State, ChildState, ChildInternals>
	): void {
		this.#slices$.next({
			...this.#slices$.value,
			[sliceRegistration.slice.#pathSegment]: sliceRegistration as SliceRegistration<
				State,
				unknown,
				never
			>,
		});

		// If the lazily added subslice is not already merged, merge it back
		if (
			sliceRegistration.lazyInitialState &&
			sliceRegistration.lazyInitialState !== sliceRegistration.slicer.selector(this.value)
		) {
			this.setAction.next(
				sliceRegistration.slicer.merger(this.value, sliceRegistration.lazyInitialState)
			);
		}
	}

	/**
	 *
	 * @param pathSegment single segment, not the entire absolutePath
	 */
	unregisterSlice(pathSegment: string): void {
		const nextSlicesSet = {
			...this.#slices$.value,
		};
		delete nextSlicesSet[pathSegment];
		this.#slices$.next(nextSlicesSet);
	}

	/**
	 * Tears down itself and anything below
	 */
	public complete(): void {
		this.#paused$.complete();
		this.#state$.complete();
		this.#slices$.complete();
		this.#plugins$.complete();
		this.#metaReducerConfigurations$.complete();
		this.#reducerConfigurations$.complete();

		this.#parentCoupling?.parentSlice?.unregisterSlice(this.pathSegment);

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
