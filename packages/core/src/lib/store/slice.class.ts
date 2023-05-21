import { isNotNullish } from '@alexaegis/common';
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
	shareReplay,
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
import type { Action, ActionConfig, ActionPacket } from '../action/index.js';
import {
	fastArrayComparator,
	getNextKeyStrategy,
	getObjectKeysAsNumbers,
	hasKey,
	ifLatestFrom,
	isNullish,
	TINYSLICE_DEFAULT_PREFIX,
	TINYSLICE_PREFIX,
	updateObject,
	type GetNext,
	type NextKeyStrategy,
} from '../helper/index.js';
import type { TinySlicePlugin } from '../plugins/index.js';
import type { Merger } from './merger.type.js';
import type {
	MetaReducer,
	PacketReducer,
	ReduceActionSliceSnapshot,
	ReducerConfiguration,
} from './reducer.type.js';
import { Scope } from './scope.class.js';
import type { Selector } from './selector.type.js';
import type { StrictRuntimeChecks } from './strict-runtime-checks.interface.js';

export type ObjectKey = string | number | symbol;
export type UnknownObject<T = unknown> = Record<ObjectKey, T>;
export type SliceDetacher = () => void;

export interface DicedSlice<
	State,
	ChildState,
	ParentInternals,
	ChildInternals,
	DiceKey extends ObjectKey
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
	key: ObjectKey | undefined;
	slicer: SelectSlicer<ParentState, State>;
	droppable: boolean;
}

export interface SliceRegistration<ParentState, State, Internals> {
	slice: Slice<ParentState, State, Internals>;
	slicer: SelectSlicer<ParentState, State>;
	key: ObjectKey | undefined;
	initialState: State | undefined;
}

export interface SliceOptions<ParentState, State, Internals> {
	reducers?: ReducerConfiguration<State>[] | undefined;
	plugins?: TinySlicePlugin<State>[] | undefined;
	metaReducers?: MetaReducer[] | undefined;
	/**
	 * ? Setting the passed slices Internal generic to unknown is crucial for
	 * ? type inference to work
	 */
	defineInternals?: ((slice: Slice<ParentState, State>) => Internals) | undefined;
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
	};
};

export interface ChildSliceConstructOptions<ParentState, State, Internals>
	extends SliceOptions<ParentState, State, Internals> {
	initialState?: State | undefined;
	/**
	 * Marks if a slice should be dropped when its key is dropped from its
	 * parent. It's generally only safe to do with dynamic slices (dices)
	 * that are only accessed through lazy slice accessors
	 */
	droppable: boolean;
	pathSegment: string;
	slicer: SelectSlicer<ParentState, State>;
	key: ObjectKey | undefined;
}

export interface SelectSlicer<ParentState, State> {
	selector: Selector<ParentState, State>;
	merger: Merger<ParentState, State>;
}

export interface SliceChange<State> {
	snapshot: ReduceActionSliceSnapshot<unknown>;
	sliceRegistration: SliceRegistration<State, unknown, unknown>;
}

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
			return isNotNullish(state) && typeof state === 'object'
				? (state[key as keyof ParentState] as State)
				: (undefined as State);
		};
		const merger: Merger<ParentState, State | undefined> = (parentState, state) => {
			if (isNullish(parentState)) {
				return parentState;
			}

			// ? state can be nullish, and the key should be defined in that case too.
			return typeof parentState === 'object'
				? {
						...parentState,
						[key]: state,
				  }
				: parentState;
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
	private readonly sink = new Subscription();

	private options: SliceConstructOptions<ParentState, State, Internals>;
	private scope: Scope;
	private initialState: State;
	private parentCoupling: SliceCoupling<ParentState, State> | undefined;
	private initialReducers: ReducerConfiguration<State>[];
	private initialPlugins: TinySlicePlugin<State>[];
	private state$: BehaviorSubject<State>;
	private _pathSegment: string;
	private _absolutePath: string;
	public setAction: Action<State>;
	public updateAction: Action<Partial<State>>;
	public deleteKeyAction: Action<ObjectKey>;
	public defineKeyAction: Action<{ key: ObjectKey; data: unknown }>;
	private observableState$: Observable<State>;
	private defaultReducerConfigurations: ReducerConfiguration<State>[];
	private reducerConfigurations$: BehaviorSubject<ReducerConfiguration<State>[]>;
	private autoRegisterReducerActions$: Observable<ReducerConfiguration<State, unknown>[]>;
	private downStreamReducers$: Observable<string[]>;
	private sliceReducer$: Observable<PacketReducer<State>>;
	private sliceReducingActions$: Observable<string[]>;
	private plugins$: BehaviorSubject<TinySlicePlugin<State>[]>;
	private autoRegisterPlugins$: Observable<unknown>;
	private nullishParentPause$: BehaviorSubject<boolean>;
	private manualPause$: BehaviorSubject<boolean>;
	private pause$: Observable<boolean>;

	private keyedSlices$ = new BehaviorSubject<
		Record<string, SliceRegistration<State, unknown, Internals>>
	>({});

	private slices$: Observable<SliceRegistration<State, unknown, Internals>[]> =
		this.keyedSlices$.pipe(map((keyedSlices) => Object.values(keyedSlices)));

	override subscribe;

	// Listens to the parent for changes to select itself from
	// check if the parent could do it instead
	private parentListener: Observable<State | undefined> | undefined;

	private inactivePipeline: Observable<ReduceActionSliceSnapshot<State>>;
	private activePipeline: Observable<ReduceActionSliceSnapshot<State>>;

	private pipeline: Observable<ReduceActionSliceSnapshot<State>>;

	private defineInternals: ((state: Slice<ParentState, State>) => Internals) | undefined;
	private _internals: Internals;
	private scopedActions: Action<unknown>[] = [];

	get internals(): Internals {
		return this._internals;
	}

	get absolutePath(): string {
		return this._absolutePath;
	}

	get pathSegment(): string {
		return this._pathSegment;
	}

	/**
	 * For debugging purposes
	 */
	public printSliceStructure(indentationLevel = 0): void {
		if (indentationLevel === 0) {
			console.groupCollapsed('Slice Structure', this.absolutePath);
		}
		console.log('\t'.repeat(indentationLevel) + this.pathSegment);
		for (const [, value] of Object.entries(this.keyedSlices$.value)) {
			value.slice.printSliceStructure(indentationLevel + 1);
		}
		if (indentationLevel === 0) {
			console.groupEnd();
		}
	}

	/**
	 *
	 * @param initialState
	 * @param sliceSegment a string that represents this slice, has to be
	 * unique on it's parent.
	 */
	private constructor(options: SliceConstructOptions<ParentState, State, Internals>) {
		super();
		this.options = options;
		this.scope = options.scope;
		this._pathSegment = options.pathSegment;
		this.initialState = options.initialState;
		this.parentCoupling = options.parentCoupling;
		this.initialReducers = options.reducers ?? [];
		this.initialPlugins = options.plugins ?? [];
		this.defineInternals = options.defineInternals;

		this.nullishParentPause$ = new BehaviorSubject(false);
		this.manualPause$ = new BehaviorSubject(false);
		this.pause$ = combineLatest([this.nullishParentPause$, this.manualPause$]).pipe(
			map(([nullishParentPause, manualPause]) => nullishParentPause || manualPause)
		);

		this._absolutePath = Slice.calculateAbsolutePath(this.parentCoupling, this._pathSegment);

		this.setAction = this.createAction<State>(`${TINYSLICE_DEFAULT_PREFIX} set`);
		this.updateAction = this.createAction<Partial<State>>(`${TINYSLICE_DEFAULT_PREFIX} update`);

		this.deleteKeyAction = this.createAction<ObjectKey>(
			`${TINYSLICE_DEFAULT_PREFIX} delete key`
		);

		this.defineKeyAction = this.createAction<{ key: ObjectKey; data: unknown }>(
			`${TINYSLICE_DEFAULT_PREFIX} define key`
		);

		console.log('this.initialState', this.initialState);
		this.state$ = new BehaviorSubject<State>(this.initialState);
		this.observableState$ = this.state$.pipe(distinctUntilChanged());

		this.defaultReducerConfigurations = [
			this.setAction.reduce((_state, payload) => payload),
			this.updateAction.reduce((state, payload) => updateObject(state, payload)),
			this.deleteKeyAction.reduce((state, payload) => {
				if (typeof state === 'object') {
					const nextState = { ...state };
					// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
					delete (nextState as State)[payload as keyof State];
					return nextState;
				} else {
					return state;
				}
			}),
			this.defineKeyAction.reduce((state, payload) => {
				return typeof state === 'object'
					? {
							...state,
							[payload.key]: payload.data,
					  }
					: state;
			}),
		];

		this.reducerConfigurations$ = new BehaviorSubject<ReducerConfiguration<State>[]>([
			...this.defaultReducerConfigurations,
			...this.initialReducers,
		]);

		this.autoRegisterReducerActions$ = this.reducerConfigurations$.pipe(
			tap((reducerConfigurations) => {
				for (const reducerConfiguration of reducerConfigurations) {
					this.scope.registerAction(reducerConfiguration.action);
				}
			})
		);

		this.sliceReducer$ = this.reducerConfigurations$.pipe(
			map(
				(reducerConfigurations): PacketReducer<State> =>
					(state, action) =>
						action
							? reducerConfigurations
									.filter((rc) => rc.action.type === action.type)
									.reduce(
										(acc, { packetReducer }) => packetReducer(acc, action),
										state
									)
							: state
			),
			shareReplay(1)
		);

		this.sliceReducingActions$ = this.reducerConfigurations$.pipe(
			map((reducerConfigurations) => [
				...new Set(reducerConfigurations.map((r) => r.action.type)),
			]),
			shareReplay(1)
		);

		this.downStreamReducers$ = this.slices$.pipe(
			withLatestFrom(this.sliceReducingActions$),
			switchMap(([slices, sliceReducingActions]) => {
				return slices.length > 0
					? combineLatest(slices.map((next) => next.slice.downStreamReducers$)).pipe(
							map((subSliceReducer) => [
								...sliceReducingActions,
								...subSliceReducer.flat(),
							])
					  )
					: of(sliceReducingActions);
			}),
			shareReplay(1) // computed from a behaviorSubject and another computed field
		);

		const slicesWithDownStreamReducers$ = this.slices$.pipe(
			switchMap((sliceRegistrations) => {
				return sliceRegistrations.length > 0
					? combineLatest(
							sliceRegistrations.map((sliceRegistration) =>
								sliceRegistration.slice.downStreamReducers$.pipe(
									map((downStreamReducers) => ({
										downStreamReducers,
										sliceRegistration,
									}))
								)
							)
					  )
					: of([]);
			}),
			shareReplay(1) // computed from behaviorSubjects from a behaviorSubject
		);

		const schedulingDispatcher$ = this.scope.schedulingDispatcher$.pipe(
			ifLatestFrom(this.downStreamReducers$, (downStreamReducers, actionPacket) =>
				downStreamReducers.includes(actionPacket.type)
			),
			tap((actionPacket) => this.executeMetaPreReducers(actionPacket))
		);

		const dispatchAndSlices$ = schedulingDispatcher$.pipe(
			switchMap((actionPacket) =>
				slicesWithDownStreamReducers$.pipe(
					take(1),
					map((slicesWithDownStreamReducers) => ({
						actionPacket,
						slicesWithDownStreamReducers,
					}))
				)
			)
		);

		const filterSliceRegistrationBasedOnActionTypeSupport = (
			slicesWithDownStreamReducers: {
				downStreamReducers: string[];
				sliceRegistration: SliceRegistration<State, unknown, Internals>;
			}[],
			actionType: string
		) => {
			return slicesWithDownStreamReducers
				.map(({ sliceRegistration, downStreamReducers }) => {
					return downStreamReducers.includes(actionType)
						? sliceRegistration.slice.pipeline.pipe(
								map(
									(snapshot) =>
										({
											snapshot,
											sliceRegistration,
										} as SliceChange<State>)
								)
						  )
						: undefined;
				})
				.filter(isNotNullish);
		};

		const zippedDispatch = dispatchAndSlices$.pipe(
			switchMap(({ slicesWithDownStreamReducers, actionPacket }) => {
				const neededChildSlices = filterSliceRegistrationBasedOnActionTypeSupport(
					slicesWithDownStreamReducers,
					actionPacket.type
				);
				return neededChildSlices.length > 0
					? zip(neededChildSlices).pipe(
							map((sliceChanges) => ({ sliceChanges, actionPacket }))
					  )
					: of({ sliceChanges: [], actionPacket });
			})
		);

		this.activePipeline = zippedDispatch.pipe(
			withLatestFrom(this.state$, this.sliceReducer$),
			map(
				([
					{ actionPacket, sliceChanges },
					prevState,
					sliceReducer,
				]): ReduceActionSliceSnapshot<State> => {
					if (this.isRootOrParentStateUndefined()) {
						return {
							actionPacket,
							prevState,
							nextState: prevState,
						};
					}

					const nextState: State =
						sliceChanges
							.filter(
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

					return {
						actionPacket,
						prevState,
						nextState: sliceReducer(nextState, actionPacket),
					};
				}
			),
			tap((snapshot) => {
				if (snapshot.prevState !== snapshot.nextState) {
					this.state$.next(snapshot.nextState);
				}
			}),
			catchError((error, pipeline$) => {
				console.error(`${TINYSLICE_PREFIX} slice pipeline error \n`, error);
				return this.plugins$.pipe(
					take(1),
					tap((plugins) => {
						for (const plugin of plugins) {
							plugin.onError?.(error);
						}
					}),
					switchMap(() => pipeline$)
				);
			})
		);

		this.inactivePipeline = schedulingDispatcher$.pipe(
			withLatestFrom(this.state$),
			map(([, state]) => {
				return {
					actionPacket: { type: 'paused', payload: undefined },
					prevState: state,
					nextState: state,
				} as ReduceActionSliceSnapshot<State>;
			})
		);

		this.pipeline = this.pause$.pipe(
			switchMap((paused) => (paused ? this.inactivePipeline : this.activePipeline)),
			tap((snapshot) => this.executeMetaPostReducers(snapshot)),
			share() // has to be shared because of child listeners
		);

		this.plugins$ = new BehaviorSubject<TinySlicePlugin<State>[]>(this.initialPlugins);

		// Listens to the parent for changes to select itself from
		this.parentListener = this.parentCoupling?.rawParentState.pipe(
			skip(1),
			finalize(() => this.complete()),
			takeWhile((parentState) =>
				this.parentCoupling?.droppable ? hasKey(parentState, this.parentCoupling.key) : true
			),
			tap((parentState) => {
				if (isNullish(parentState) && !this.nullishParentPause$.value) {
					this.nullishParentPause$.next(true);
				} else if (this.nullishParentPause$.value) {
					this.nullishParentPause$.next(false);
				}
			}),
			filter(isNotNullish),
			map((parentState) => this.parentCoupling?.slicer.selector(parentState)),
			distinctUntilChanged(),
			tap((stateFromParent) => this.state$.next(stateFromParent as State))
		);

		this.autoRegisterPlugins$ = this.plugins$.pipe(
			startWith([] as TinySlicePlugin<State>[]),
			pairwise(),
			tap(([previous, next]) => {
				// Stop whats no longer present
				for (const plugin of previous.filter((plugin) => !next.includes(plugin))) {
					plugin.stop();
				}
				// Start what's new
				for (const plugin of next.filter((plugin) => !previous.includes(plugin))) {
					this.registerPlugin(plugin);
				}
			})
		);

		this.subscribe = this.observableState$
			.pipe(filter(isNotNullish))
			.subscribe.bind(this.observableState$);

		this.scope.slices.set(this._absolutePath, this);

		if (this.parentCoupling) {
			this.parentCoupling.parentSlice.registerSlice({
				slice: this,
				slicer: this.parentCoupling.slicer,
				initialState: this.initialState,
				key: this.parentCoupling.key,
			});

			this.sink.add(this.parentListener?.subscribe());
		}

		this.sink.add(this.autoRegisterReducerActions$.subscribe());
		this.sink.add(this.autoRegisterPlugins$.subscribe());
		this.sink.add(this.pipeline.subscribe()); // Slices are hot!

		// ? defineInternals call has to happen after this slice has been
		// ? coupled to its parent
		this._internals = this.defineInternals?.(this) ?? ({} as Internals);
	}

	private executeMetaPreReducers(action: ActionPacket) {
		for (const plugin of this.plugins$.value) {
			if (!this.options.parentCoupling) {
				plugin.preRootReduce?.(this._absolutePath, this.state$.value, action);
			}
			plugin.preReduce?.(this._absolutePath, this.state$.value, action);
		}
	}

	private executeMetaPostReducers<State>(snapshot: ReduceActionSliceSnapshot<State>) {
		for (const plugin of this.plugins$.value) {
			plugin.postReduce?.(this._absolutePath, snapshot);
			if (!this.options.parentCoupling) {
				plugin.postRootReduce?.(this._absolutePath, snapshot);
			}
		}
	}

	public loadAndSetPlugins(
		...pluginImports: (() => Promise<TinySlicePlugin<State>>)[]
	): Promise<TinySlicePlugin<State>[]> {
		return Promise.all(pluginImports.map((pluginImport) => pluginImport())).then((plugins) => {
			this.setPlugins(plugins);
			return plugins;
		});
	}

	public get paused$(): Observable<boolean> {
		return this.pause$;
	}

	/**
	 * Unpauses this slice and every child slice recursively
	 */
	public unpause(): void {
		if (this.manualPause$.value) {
			this.manualPause$.next(false);
		}
		for (const subSlice of Object.values(this.keyedSlices$.value)) {
			subSlice.slice.unpause();
		}
	}

	/**
	 * Pauses this slice and every child slice recursively
	 */
	public pause(): void {
		if (!this.manualPause$.value) {
			this.manualPause$.next(true);
		}
		for (const subSlice of Object.values(this.keyedSlices$.value)) {
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
		const effectSubscription = this.scope.createEffect(pausablePacket$);
		this.sink.add(effectSubscription);
		return effectSubscription;
	}

	public setPlugins(plugins: TinySlicePlugin<State>[]): void {
		this.plugins$.next([...(this.options.plugins ?? []), ...plugins]);
	}

	public getPlugins(): TinySlicePlugin<State>[] {
		return this.plugins$.value;
	}

	public addPlugin(...plugins: TinySlicePlugin<State>[]): void {
		this.plugins$.next([...this.plugins$.value, ...plugins]);
	}

	public getReducers(): ReducerConfiguration<State>[] {
		return this.reducerConfigurations$.value;
	}

	/**
	 * This does not disable default redurces.
	 */
	public setReducers(reducers: ReducerConfiguration<State>[]): void {
		this.reducerConfigurations$.next([...this.defaultReducerConfigurations, ...reducers]);
	}

	public addReducers(reducers: ReducerConfiguration<State>[]): void {
		this.reducerConfigurations$.next([...this.reducerConfigurations$.value, ...reducers]);
	}

	static assembleAbsolutePath(parentAbsolutePath: string, segment: string): string {
		return `${parentAbsolutePath}${parentAbsolutePath ? '.' : ''}${segment}`;
	}

	private static calculateAbsolutePath<ParentState, State>(
		parentCoupling: SliceCoupling<ParentState, State> | undefined,
		pathSegment: string
	): string {
		return parentCoupling
			? Slice.assembleAbsolutePath(parentCoupling.parentSlice._absolutePath, pathSegment)
			: pathSegment;
	}

	private registerPlugin(plugin: TinySlicePlugin<State>): TinySlicePlugin<State> {
		plugin.register({
			initialState: this.state$.value,
			state$: this.pipeline,
			stateInjector: (state: State) => this.state$.next(state),
		});
		plugin.start();
		return plugin;
	}

	public set(slice: State | undefined): void {
		this.setAction.next(slice as State);
	}

	public update(slice: Partial<State>): void {
		this.updateAction.next(slice);
	}

	set value(value: State) {
		this.set(value);
	}

	get value(): State {
		return this.state$.value;
	}

	private isRootOrParentStateUndefined(): boolean {
		return this.parentCoupling
			? isNullish(this.parentCoupling.parentSlice.state$.value)
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
		const actionName = `${this._absolutePath} ${name}`;
		const action = this.scope.createAction<Packet>(actionName, {
			...actionOptions,
			pauseWhile: this.paused$,
		});
		this.scopedActions.push(action as Action<unknown>);
		return action;
	}

	private sliceInternal<ChildState, ChildInternals>(
		childSliceConstructOptions: ChildSliceConstructOptions<State, ChildState, ChildInternals>
	): Slice<State, NonNullable<ChildState>, ChildInternals> {
		const path = Slice.assembleAbsolutePath(
			this._absolutePath,
			childSliceConstructOptions.pathSegment.toString()
		);
		if (this.scope.slices.has(path)) {
			// ? If this proves to be error prone just throw an error
			// ? Double define should be disallowed anyway
			return this.scope.slices.get(path) as Slice<
				State,
				NonNullable<ChildState>,
				ChildInternals
			>;
		} else {
			const initialStateFromParent: ChildState | undefined = this.state$.value
				? childSliceConstructOptions.slicer.selector(this.state$.value)
				: undefined;

			const initialState: ChildState =
				initialStateFromParent ?? (childSliceConstructOptions.initialState as ChildState);

			return new Slice<State, ChildState, ChildInternals>({
				...extractSliceOptions(childSliceConstructOptions),
				plugins: [
					...(this.plugins$.value as unknown as TinySlicePlugin<ChildState>[]).filter(
						(plugin) => plugin.sliceOptions?.()?.passToChildren ?? false
					),
					...(childSliceConstructOptions.plugins ?? []),
				],
				scope: this.scope,
				initialState,
				parentCoupling: {
					parentSlice: this as Slice<unknown, State, UnknownObject>,
					rawParentState: this.observableState$,
					slicer: childSliceConstructOptions.slicer,
					droppable: childSliceConstructOptions.droppable,
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
		return this.sliceInternal({
			...sliceOptions,
			initialState: undefined,
			droppable: false,
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
		return this.sliceInternal({
			...sliceOptions,
			pathSegment: key.toString(),
			slicer,
			key: key as string,
			droppable: false,
		});
	}

	/**
	 * Adds non-defined "lazy" slices to extend this slice
	 * ? https://github.com/microsoft/TypeScript/issues/42315
	 * ? key could be restricted to disallow keys of Slice once negated types
	 * ? are implemented in TypeScript
	 */
	public addSlice<ChildState, ChildInternals, AdditionalKey extends ObjectKey = string>(
		key: AdditionalKey,
		initialState: ChildState,
		sliceOptions?: SliceOptions<State, ChildState, ChildInternals>
	): Slice<State & Record<AdditionalKey, ChildState>, NonNullable<ChildState>, ChildInternals> {
		const slicer = normalizeSliceDirection<State, ChildState>(key);
		return this.sliceInternal({
			...sliceOptions,
			initialState,
			pathSegment: key.toString(),
			slicer,
			key: key as string,
			droppable: false,
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
	public dice<ChildState, ChildInternals, DiceKey extends ObjectKey>(
		initialState: ChildState,
		diceConstructOptions: DiceConstructOptions<State, ChildState, ChildInternals, DiceKey>
	): DicedSlice<State, ChildState, Internals, ChildInternals, DiceKey> {
		const sliceOptions = extractSliceOptions(diceConstructOptions);

		const get = (key: DiceKey) => {
			const slicer = normalizeSliceDirection<State, ChildState>(key);
			return this.sliceInternal({
				...sliceOptions,
				initialState,
				pathSegment: key.toString(),
				slicer,
				key,
				droppable: true,
			}) as Slice<
				State & Record<DiceKey, ChildState>,
				NonNullable<ChildState>,
				ChildInternals
			>;
		};

		const has = (key: DiceKey) =>
			this.state$.value && typeof this.state$.value === 'object'
				? Object.keys(this.state$.value).includes(key as string)
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
			switchMap((slices) => (slices.length > 0 ? combineLatest(slices) : of([])))
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

	private registerSlice<ChildState, ChildInternals>(
		sliceRegistration: SliceRegistration<State, ChildState, ChildInternals>
	): void {
		this.keyedSlices$.next({
			...this.keyedSlices$.value,
			[sliceRegistration.slice._pathSegment]: sliceRegistration as SliceRegistration<
				State,
				unknown,
				never
			>,
		});
		// If the lazily added subslice is not already merged, merge it back
		if (
			!hasKey(this.value, sliceRegistration.key) ||
			sliceRegistration.initialState !== sliceRegistration.slicer.selector(this.value)
		) {
			this.setAction.next(
				sliceRegistration.slicer.merger(
					this.value,
					sliceRegistration.initialState as ChildState
				)
			);
		}
	}

	/**
	 *
	 * @param pathSegment single segment, not the entire absolutePath
	 */
	unregisterSlice(pathSegment: string): void {
		const nextSlicesSet = {
			...this.keyedSlices$.value,
		};
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete nextSlicesSet[pathSegment];
		this.keyedSlices$.next(nextSlicesSet);
	}

	/**
	 * Tears down itself and anything below
	 */
	public complete(): void {
		this.manualPause$.complete();
		this.state$.complete();
		this.keyedSlices$.complete();
		this.plugins$.complete();
		this.reducerConfigurations$.complete();

		this.parentCoupling?.parentSlice.unregisterSlice(this.pathSegment);

		for (const scopedAction of this.scopedActions) {
			scopedAction.complete();
		}
		this.scope.slices.delete(this._absolutePath);
		this.sink.unsubscribe();
	}

	public asObservable(): Observable<State> {
		return this.pipe();
	}
}
