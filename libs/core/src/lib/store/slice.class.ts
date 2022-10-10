import {
	BehaviorSubject,
	catchError,
	distinctUntilChanged,
	filter,
	finalize,
	map,
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
import { Action } from '../action';
import { createLoggingMetaReducer, isNonNullable, isNullish, updateObject } from '../helper';
import { TINYSLICE_ACTION_DEFAULT_PREFIX } from '../internal';
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

export type ReducerCanceller = () => void;
export type SliceDetacher = () => void;

export interface DepreSlicerOptions<Slice> {
	reducers?: ReducerConfiguration<Slice>[];
}

export interface SliceCoupling<ParentState, State> {
	parentSlice: Slice<unknown, ParentState>;
	selector: Selector<ParentState, State>;
	merger: Merger<ParentState, State>;
	lazy: boolean;
}

export interface SliceRegistration<ParentState, State> {
	slice: Slice<ParentState, State>;
	selector: Selector<ParentState, State>;
	merger: Merger<ParentState, State>;
	lazyInitialState: State | undefined;
}

export interface SliceOptions<State> {
	plugins?: TinySlicePlugin<State>[];
	metaReducers?: MetaPacketReducer<State>[];
	useDefaultLogger?: boolean;
}

export interface RootSliceOptions<State> extends SliceOptions<State> {
	/**
	 * Runtime checks can slow the store down, turn them off in production,
	 * they are all on by default.
	 */
	runtimeChecks?: StrictRuntimeChecks;
}

export type RootSlice<State> = Slice<never, State>;

/**
 * It's pizza time!
 */
export class Slice<ParentState, State> extends Observable<State> {
	#sink = new Subscription();
	#metaReducerConfigurations$: BehaviorSubject<MetaPacketReducer<State>[]>;
	#metaReducer$: Observable<MetaPacketReducer<State>>;

	#scope: Scope;
	#initialState: State;
	#parentCoupling: SliceCoupling<ParentState, State> | undefined;
	#initialReducers: ReducerConfiguration<State>[];
	#sliceOptions: SliceOptions<State> | undefined;
	#state$: BehaviorSubject<State>;
	#pathSegment: string;
	#absolutePath: string;
	setAction: Action<State>;
	updateAction: Action<Partial<State>>;
	#observableState$: Observable<State>;
	#reducerConfigurations$: BehaviorSubject<ReducerConfiguration<State>[]>;
	#autoRegisterReducerActions$: Observable<ReducerConfiguration<State, unknown>[]>;
	#sliceReducer$: Observable<PacketReducer<State>>;
	#plugins$: BehaviorSubject<TinySlicePlugin<State>[]>;
	#autoRegisterPlugins$: Observable<unknown>;

	#slices$ = new BehaviorSubject<Record<string, SliceRegistration<State, unknown>>>({});

	override subscribe;

	// Listens to the parent for changes to select itself from
	// check if the parent could do it instead
	#parentListener: Observable<State | undefined> | undefined;
	#pipeline: Observable<ReduceActionSliceSnapshot<State>>;

	/**
	 *
	 * @param initialState
	 * @param sliceSegment a string that represents this slice, has to be
	 * unique on it's parent.
	 */
	private constructor(
		scope: Scope,
		initialState: State,
		parentCoupling: SliceCoupling<ParentState, State> | undefined,
		pathSegment: string,
		initialReducers: ReducerConfiguration<State>[] = [],
		sliceOptions: SliceOptions<State> = {}
	) {
		super();
		this.#scope = scope;
		this.#pathSegment = pathSegment;
		this.#initialState = initialState;
		this.#parentCoupling = parentCoupling;
		this.#initialReducers = initialReducers;
		this.#sliceOptions = sliceOptions;

		this.#absolutePath = Slice.calculateAbsolutePath(parentCoupling, pathSegment);

		this.setAction = new Action<State>(
			`${TINYSLICE_ACTION_DEFAULT_PREFIX} set ${this.#absolutePath}`
		);
		this.updateAction = new Action<Partial<State>>(
			`${TINYSLICE_ACTION_DEFAULT_PREFIX} update ${this.#absolutePath}`
		);

		this.#state$ = new BehaviorSubject<State>(this.#initialState);
		this.#observableState$ = this.#state$.pipe(distinctUntilChanged());

		this.#reducerConfigurations$ = new BehaviorSubject<ReducerConfiguration<State>[]>([
			this.setAction.reduce((state, payload) => payload ?? state),
			this.updateAction.reduce((state, payload) => updateObject(state, payload)),
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
			...(this.#sliceOptions?.useDefaultLogger ? [createLoggingMetaReducer<State>()] : []),
			...(this.#sliceOptions?.metaReducers ?? []),
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

		this.#pipeline = zip(
			this.#scope.dispatcher$,
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
						return this.#scope.dispatcher$.pipe(map(() => []));
					}
				})
			)
		).pipe(
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
								sliceChange.sliceRegistration.merger(
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
				console.error(error);
				return this.#plugins$.pipe(
					take(1),
					tap((plugins) => {
						for (const plugin of plugins) {
							plugin.onError?.(error);
						}
					}),
					switchMap(() => pipeline$)
				);
			}),
			finalize(() => this.unsubscribe()),
			share() // Listened to by child slices
		) as Observable<ReduceActionSliceSnapshot<State>>;

		this.#plugins$ = new BehaviorSubject<TinySlicePlugin<State>[]>(
			this.#sliceOptions?.plugins ?? []
		);

		// Listens to the parent for changes to select itself from
		// check if the parent could do it instead
		this.#parentListener = this.#parentCoupling?.parentSlice.pipe(
			finalize(() => this.unsubscribe()),
			skip(1),
			map((parentState) => {
				const slice = this.#parentCoupling?.selector(parentState);

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

		this.#start();
	}

	#start() {
		if (this.#parentCoupling) {
			this.#parentCoupling.parentSlice.#registerSlice({
				slice: this,
				merger: this.#parentCoupling.merger,
				selector: this.#parentCoupling.selector,
				lazyInitialState: this.#initialState,
			});

			this.#sink.add(this.#parentListener?.subscribe());
		}

		this.#scope.slices.set(this.#absolutePath, this);

		this.#sink.add(this.#autoRegisterReducerActions$.subscribe());
		this.#sink.add(this.#autoRegisterPlugins$.subscribe());
		this.#sink.add(this.#pipeline.subscribe()); // Slices are hot!
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

	public static createRootSlice<State>(
		scope: Scope,
		initialState: State,
		initialReducers: ReducerConfiguration<State>[],
		sliceOptions?: RootSliceOptions<State>
	): RootSlice<State> {
		return new Slice(scope, initialState, undefined, 'root', initialReducers, sliceOptions);
	}

	#slice<ChildState>(
		pathSegment: string,
		selector: Selector<State, ChildState>,
		merger: Merger<State, ChildState>,
		reducers: ReducerConfiguration<ChildState>[],
		sliceOptions: SliceOptions<ChildState> = {},
		initialState: ChildState = (this.#state$.value
			? selector(this.#state$.value)
			: undefined) as ChildState,
		lazy = false
	): Slice<State, NonNullable<ChildState>> {
		return new Slice<State, ChildState>(
			this.#scope,
			initialState,
			{
				parentSlice: this as Slice<unknown, State>,
				selector,
				merger,
				lazy,
			},
			pathSegment,
			reducers,
			sliceOptions
		) as Slice<State, NonNullable<ChildState>>;
	}

	public sliceSelect<ChildState extends State[keyof State]>(
		selector: Selector<State, ChildState>,
		merger: Merger<State, ChildState>,
		reducers: ReducerConfiguration<ChildState>[] = [],
		sliceOptions?: SliceOptions<ChildState>
	): Slice<State, NonNullable<ChildState>> {
		return this.#slice(selector.toString(), selector, merger, reducers, sliceOptions);
	}

	public slice<ChildStateKey extends keyof State>(
		key: ChildStateKey,
		reducers: ReducerConfiguration<NonNullable<State[ChildStateKey]>>[] = [],
		sliceOptions?: SliceOptions<State[ChildStateKey]>
	): Slice<State, NonNullable<State[ChildStateKey]>> {
		const selector: Selector<State, State[ChildStateKey]> = (state) => state[key];
		const merger: Merger<State, State[ChildStateKey] | undefined> = (state, slice) => {
			if (isNullish(state)) {
				return state;
			}
			// completely remove the key for cleaner decoupling
			if (slice === undefined) {
				const next = {
					...state,
				};
				delete state[key];
				return next;
			} else {
				return {
					...state,
					[key]: slice,
				};
			}
		};

		return this.#slice(
			key.toString(),
			selector,
			merger,
			reducers as ReducerConfiguration<State[ChildStateKey]>[],
			sliceOptions
		);
	}

	/**
	 * ? https://github.com/microsoft/TypeScript/issues/42315
	 * ? key could be restricted to disallow keys of Slice once negated types
	 * ? are implemented in TypeScript
	 */
	addSlice<ChildState, AdditionalKey extends string = string>(
		key: AdditionalKey,
		initialState: ChildState,
		reducers: ReducerConfiguration<ChildState>[] = [],
		sliceOptions?: SliceOptions<ChildState>
	): Slice<State & Record<AdditionalKey, ChildState>, NonNullable<ChildState>> {
		const selector: Selector<State, ChildState> = (state) =>
			(state as State & Record<AdditionalKey, ChildState>)[key];
		const merger: Merger<State, ChildState | undefined> = (state, slice) => {
			if (isNullish(state)) {
				return state;
			}
			// completely remove the key for cleaner decoupling
			if (slice === undefined) {
				return state;
			} else {
				return {
					...state,
					[key]: slice,
				};
			}
		};

		const path = Slice.assembleAbsolutePath(this.#absolutePath, key.toString());

		// Giving it a try, if the state was hydrated this slice could be present
		initialState =
			selector(this.#state$.value as State & Record<AdditionalKey, ChildState>) ??
			initialState;

		if (this.#scope.slices.has(path)) {
			// ? If this proves to be error prone just throw an error
			// ? Double define should be disallowed anyway
			return this.#scope.slices.get(path) as Slice<
				State & Record<AdditionalKey, ChildState>,
				NonNullable<ChildState>
			>;
		} else {
			return this.#slice(
				key.toString(),
				selector,
				merger,
				reducers,
				sliceOptions,
				initialState,
				true
			) as Slice<State & Record<AdditionalKey, ChildState>, NonNullable<ChildState>>;
		}
	}

	#registerSlice<ChildState>(
		sliceRegistration: SliceRegistration<State, ChildState>
	): SliceDetacher {
		this.#slices$.next({
			...this.#slices$.value,
			[sliceRegistration.slice.#pathSegment]: sliceRegistration as SliceRegistration<
				State,
				unknown
			>,
		});

		if (sliceRegistration.lazyInitialState) {
			this.setAction.next(
				sliceRegistration.merger(this.value, sliceRegistration.lazyInitialState)
			);
		}

		return () => this.#unregisterSlice(sliceRegistration.slice.#pathSegment);
	}

	#unregisterSlice(pathSegment: string): void {
		const nextSlicesSet = {
			...this.#slices$.value,
		};
		const sliceToBeDeleted = nextSlicesSet[pathSegment];
		// TODO: Make sure it's not tearing down anything above it
		sliceToBeDeleted.slice.unsubscribe();
		delete nextSlicesSet[pathSegment];
		// delete nextSlicesSet[`${this.#path}.${pathSegment}`];
		this.#slices$.next(nextSlicesSet);
	}

	/**
	 * TODO: Make them cancellable by providing a way to remove them. Like using an autogenerated
	 * local id and a map/object
	 */
	public addReducers(...reducerConfiguration: ReducerConfiguration<State>[]): ReducerCanceller {
		const nextReducers = [...this.#reducerConfigurations$.value];
		nextReducers.push(...reducerConfiguration);
		this.#reducerConfigurations$.next(nextReducers);

		return () => {
			console.log('cancel reducer!');
		};
	}

	/**
	 * Tears down itself and anything below
	 */
	public unsubscribe(): void {
		this.#state$.complete();
		this.#slices$.complete();
		this.#plugins$.complete();
		this.#metaReducerConfigurations$.complete();
		this.#reducerConfigurations$.complete();
		this.#sink.unsubscribe();
	}

	public asObservable(): Observable<State> {
		return this.pipe();
	}
}
