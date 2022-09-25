import {
	BehaviorSubject,
	catchError,
	distinctUntilChanged,
	EMPTY,
	filter,
	finalize,
	map,
	Observable,
	share,
	skip,
	Subscription,
	switchMap,
	tap,
	withLatestFrom,
	zip,
} from 'rxjs';
import { Action, ActionPacket } from '../action';
import {
	createLoggingMetaReducer,
	isNonNullable,
	isNullish,
	TINYSLICE_ACTION_DEFAULT_PREFIX,
	updateObject,
} from '../helper';
import type { Comparator } from './comparator.type';
import type { Merger } from './merger.type';
import {
	ActionReduceSnapshot,
	isActionReduceSnapshot,
	MetaPacketReducer,
	PacketReducer,
	ReducerConfiguration,
} from './reducer.type';
import type { Scope } from './scope.class';
import type { Selector } from './selector.type';

export type ExcludeProps<S, T> = S & { [K in keyof T]?: never };
export type ExcludeKey<S, T extends string | number> = S & { [K in T]: never };

export type ValueOf<T> = T[keyof T];
export type KeyOf<T> = keyof T;

export interface StorePluginHooks<State> {
	state$: Observable<ActionReduceSnapshot<State | undefined>>;
	initialState: State;
	stateInjector: (state: State) => void;
}

export interface StorePlugin<State> {
	register: (hooks: StorePluginHooks<State>) => void;
	onError?: (error: unknown) => void;
	start: () => void;
	stop: () => void;
	registerAdditionalTrigger?: (trigger: () => void) => void;
}

export interface StrictRuntimeChecks {
	strictStateImmutability: boolean;
	strictActionImmutability: boolean;
	strictStateSerializability: boolean;
	strictActionSerializability: boolean;
}

export interface StoreOptions<State> {
	plugins?: StorePlugin<State>[];
	metaReducers?: MetaPacketReducer<State>[];
	useDefaultLogger?: boolean;
	/**
	 * Runtime checks can slow the store down, turn them off in production,
	 * they are all on by default.
	 */
	runtimeChecks?: StrictRuntimeChecks;
}

// TODO: explore rehydration
abstract class BaseStore<ParentState, Slice> extends Observable<NonNullable<Slice>> {
	protected abstract state: BehaviorSubject<Slice>;
	protected abstract parent: BaseStore<unknown, ParentState> | undefined;
	protected abstract merger: Merger<ParentState, Slice> | undefined;
	protected abstract stateObservable$: Observable<Slice>;
	protected actions$: Observable<ActionPacket>;
	protected abstract path: string;

	public abstract readonly setAction: Action<Slice>;
	public abstract readonly updateAction: Action<Slice>;

	protected abstract sliceRegistrations$: BehaviorSubject<
		SliceRegistrationOptions<Slice, unknown>[]
	>;

	#sink = new Subscription();

	constructor(protected scope: Scope<unknown>) {
		super();
		this.actions$ = scope.dispatcher$;
	}

	/**
	 * TODO: unregister on unsubscribe maybe just provide an unregister callback
	 * Maybe devtools could be notified about registration of lazy slices
	 */
	public registerSlice(sliceRegistration: SliceRegistrationOptions<Slice, unknown>): void {
		this.sliceRegistrations$.next([...this.sliceRegistrations$.value, sliceRegistration]);

		if (sliceRegistration.lazy) {
			this.scope.internalActionRegisterLazySlice.next(
				sliceRegistration.lazyNotificationPayload
			);
		}
	}

	slice<SubSliceKey extends keyof Slice>(
		key: SubSliceKey,
		reducerConfigurations: ReducerConfiguration<NonNullable<Slice[SubSliceKey]>>[] = [],
		comparator?: Comparator<Slice[SubSliceKey] | undefined>
	): StoreSlice<Slice, NonNullable<Slice[SubSliceKey]>> {
		const selector: Selector<Slice, Slice[SubSliceKey]> = (state) => state[key];
		const merger: Merger<Slice, Slice[SubSliceKey]> = (state, slice) => {
			console.log('merger', key.toString(), state, slice);
			if (isNullish(state) /* || isNullish(slice)*/) {
				return state;
			}
			return {
				...state,
				[key]: slice,
			};
		};

		return new StoreSlice<Slice, NonNullable<Slice[SubSliceKey]>>(
			this as BaseStore<unknown, Slice>,
			selector as Selector<Slice, NonNullable<Slice[SubSliceKey]>>,
			merger,
			`${this.path}${this.path ? '.' : ''}${key.toString()}`,
			{
				scope: this.scope,
				initialState: (this.state.value
					? selector(this.state.value)
					: undefined) as NonNullable<Slice[SubSliceKey]>,
				reducerConfigurations,
				comparator,
				lazy: false,
			}
		);
	}

	sliceSelect<SubSlice extends Slice[keyof Slice]>(
		selector: Selector<Slice, SubSlice>,
		merger: Merger<Slice, SubSlice>,
		reducerConfigurations: ReducerConfiguration<SubSlice>[] = [],
		comparator?: Comparator<SubSlice>
	): StoreSlice<Slice, SubSlice> {
		return new StoreSlice(
			this as BaseStore<unknown, Slice>,
			selector,
			merger,
			`${this.path}${this.path ? '.' : ''}${selector.toString()}`,
			{
				scope: this.scope,
				initialState: (this.state.value
					? selector(this.state.value)
					: undefined) as NonNullable<SubSlice>,
				reducerConfigurations,
				comparator,
				lazy: false,
			}
		);
	}

	/**
	 * ? https://github.com/microsoft/TypeScript/issues/42315
	 * ? key could be restricted to disallow keys of Slice once negated types
	 * ? are implemented in TypeScript
	 */
	public addSlice<SubSlice, AdditionalKey extends string = string>(
		key: AdditionalKey,
		initialState: SubSlice,
		reducerConfigurations?: ReducerConfiguration<SubSlice>[],
		comparator?: Comparator<SubSlice | undefined>
	): StoreSlice<Slice & Record<AdditionalKey, SubSlice>, SubSlice> {
		const selector = (state: Slice & Record<AdditionalKey, SubSlice>) => state[key];
		const merger = (
			state: Slice & Record<AdditionalKey, SubSlice>,
			slice: SubSlice | undefined
		) => ({
			...state,
			[key]: slice,
		});

		const path = `${this.path}${this.path ? '.' : ''}${key.toString()}`;

		if (this.scope.slices.has(path)) {
			// ? If this proves to be error prone just throw an error
			// ? Double define should be disallowed anyway
			return this.scope.slices.get(path) as StoreSlice<
				Slice & Record<AdditionalKey, SubSlice>,
				SubSlice
			>;
		} else {
			const slice = new StoreSlice(
				this as unknown as BaseStore<unknown, Slice & Record<AdditionalKey, SubSlice>>,
				selector,
				merger,
				path,
				{
					scope: this.scope,
					initialState:
						// Giving it a try, if the state was hydrated this slice could be present
						selector(this.state.value as Slice & Record<AdditionalKey, SubSlice>) ??
						initialState,
					reducerConfigurations: reducerConfigurations ?? [],
					comparator,
					lazy: true,
				}
			);

			this.scope.slices.set(path, slice as unknown);
			return slice;
		}
	}

	protected static createCombinedReducer<State>(
		debugPath: string,
		reducerConfigurations: ReducerConfiguration<State>[] = []
	): PacketReducer<State> {
		console.log('createCombinedReducer "', debugPath, '", ', reducerConfigurations);
		return (state: State, action: ActionPacket | undefined) => {
			let nextState = state;
			if (action) {
				nextState = reducerConfigurations
					.filter(
						(reducerConfiguration) => reducerConfiguration.action.type === action.type
					)
					.reduce((acc, { packetReducer }) => packetReducer(acc, action), state);
			}

			console.log(
				'inside combined reducer of "',
				debugPath,
				'" \n action: ',
				action,
				' \n state: ',
				state,
				' \n nextState: ',
				nextState
			);

			return nextState;
		};
	}

	protected static createMetaReducerRunner<State>(
		reducerConfigurations: MetaPacketReducer<State>[] = []
	): (snapshot: ActionReduceSnapshot<State>) => void {
		return (snapshot: ActionReduceSnapshot<State>) =>
			reducerConfigurations.forEach((metaReducer) => metaReducer(snapshot));
	}

	protected static registerDefaultReducers<State>(
		reducerConfigurations: ReducerConfiguration<State>[],
		setAction: Action<State>,
		updateAction: Action<State>
	) {
		reducerConfigurations.unshift({
			action: setAction,
			packetReducer: (state, packet) => {
				console.log('set', state, packet);
				return packet?.payload ?? state;
			},
		});

		reducerConfigurations.unshift({
			action: updateAction,
			packetReducer: (state, packet) => {
				console.log('update!', state, packet);
				return updateObject(state, packet?.payload);
			},
		});
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public root<T>(): Store<T> {
		let current = this as BaseStore<unknown, unknown>;
		while (current.parent) {
			current = current.parent;
		}
		return current as unknown as Store<T>;
	}

	public set(slice: Slice): void {
		console.log('set!');
		this.setAction.next(slice);
	}

	public update(slice: Slice): void {
		this.updateAction.next(slice);
	}

	set value(value: Slice) {
		this.set(value);
	}

	get value(): Slice {
		return this.state.value;
	}

	protected set teardown(subscription: Subscription) {
		this.#sink.add(subscription);
	}

	public unsubscribe(): void {
		this.state.complete();
		this.sliceRegistrations$.complete();
		this.#sink.unsubscribe();
	}
}

const zipSlices = <ParentSlice, Slice>(
	sliceRegistrations$: Observable<SliceRegistrationOptions<Slice, unknown>[]>,
	actionDispatcher$: Observable<ActionPacket | undefined>,
	parentSlice: BaseStore<unknown, ParentSlice> | undefined,
	parentStateIsDefinedOrRoot: boolean,
	debugPath: string
): Observable<SliceChange<Slice, unknown>[]> =>
	sliceRegistrations$.pipe(
		switchMap((sliceRegistrations) => {
			console.log(
				'zipSlices, path: "',
				debugPath,
				'"',
				'parentStateIsDefinedOrRoot: ',
				parentStateIsDefinedOrRoot,
				'\n sliceRegistrations: ',
				sliceRegistrations
			);

			if (sliceRegistrations.length) {
				return zip(
					sliceRegistrations
						// .filter((reg) => isNonNullable(reg.parent.value))
						.map(({ slicePipeline, selector, merger }) =>
							slicePipeline.pipe(
								map((snapshot) => ({
									snapshot,
									selector,
									merger,
								}))
							)
						)
				);
			} else {
				return actionDispatcher$.pipe(map(() => []));
			}
		})
	);

/**
 */
const createReducerPipeline = <ParentSlice, Slice>(
	dispatcher$: Observable<ActionPacket>,
	state$: Observable<Slice>,
	registeredSlices$: Observable<SliceRegistrationOptions<Slice, unknown>[]>,
	combinedReducer: PacketReducer<Slice>,
	parent: BaseStore<unknown, ParentSlice> | undefined,
	debugPath: string
): Observable<ActionReduceSnapshot<Slice>> =>
	zip(
		dispatcher$,
		zipSlices<ParentSlice, Slice>(
			registeredSlices$,
			dispatcher$,
			parent,
			parent ? isNonNullable(parent.value) : true,
			debugPath
		)
	).pipe(
		withLatestFrom(state$),
		map(([[action, sliceChanges], prevState]) => {
			const parentStateIsUndefined = parent ? isNullish(parent.value) : false;

			if (parentStateIsUndefined) {
				return {
					action,
					prevState,
					nextState: prevState,
				};
			}

			const nextStateWithSliceChangesOnly = sliceChanges
				.filter((sliceChange) => {
					if (isActionReduceSnapshot(sliceChange.snapshot)) {
						return sliceChange.snapshot.prevState !== sliceChange.snapshot.nextState;
					} else {
						return true;
					}
				})
				.reduce(
					(parentSliceState, sliceChange) =>
						sliceChange.merger(parentSliceState, sliceChange.snapshot.nextState) ??
						parentSliceState,
					prevState
				);

			const nextState = combinedReducer(nextStateWithSliceChangesOnly, action);

			console.log(
				'reducerpipeline, path: "',
				debugPath,
				'" redu pipeline.\nActionType: ',
				action.type,
				'\n sliceChanges: ',
				sliceChanges,
				'\n prevState: ',
				prevState,
				'\n nextStateWithSliceChangesOnly: ',
				nextStateWithSliceChangesOnly,
				'\n nextState: ',
				nextState,

				'\n parentStateIsUndefined: ',
				parentStateIsUndefined
			);

			return {
				action,
				prevState,
				nextState,
			};
		}),
		distinctUntilChanged()
	);

// TODO: make it rehydratable, maybe add a unique name to each store (forward that to the devtoolsPluginOptions and remove name from there)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Store<State> extends BaseStore<unknown, State> {
	protected parent = undefined;
	protected merger = undefined;
	protected path = '';
	protected state = new BehaviorSubject<State>(this.initialState);
	protected stateObservable$ = this.state.pipe(distinctUntilChanged());
	protected sliceRegistrations$ = new BehaviorSubject<SliceRegistrationOptions<State, unknown>[]>(
		[]
	);
	private plugins: StorePlugin<State>[] | undefined;

	public override subscribe = this.stateObservable$
		.pipe(filter(isNonNullable))
		.subscribe.bind(this.stateObservable$);

	#combinedReducer = Store.createCombinedReducer(this.path, this.reducerConfigurations);
	#metaReducerRunner: (snapshot: ActionReduceSnapshot<State>) => void;

	#storePipeline = createReducerPipeline<unknown, State>(
		this.actions$,
		this.stateObservable$,
		this.sliceRegistrations$,
		this.#combinedReducer,
		this.parent,
		this.path
	).pipe(
		tap((snapshot) => {
			if (isActionReduceSnapshot(snapshot)) {
				this.#metaReducerRunner(snapshot);
			}

			if (snapshot.prevState !== snapshot.nextState) {
				this.state.next(snapshot.nextState);
			}
		}),
		catchError((error) => {
			this.plugins?.forEach((plugin) => plugin.onError?.(error));
			return EMPTY;
		}),
		finalize(() => this.unsubscribe()),
		share()
	);

	public readonly setAction = new Action<State>(`${TINYSLICE_ACTION_DEFAULT_PREFIX} set`);
	public readonly updateAction = new Action<State>(`${TINYSLICE_ACTION_DEFAULT_PREFIX} update`);

	constructor(
		protected override readonly scope: Scope<unknown>,
		public readonly initialState: State,
		private readonly reducerConfigurations: ReducerConfiguration<State>[] = [],
		private readonly storeOptions?: StoreOptions<State>
	) {
		super(scope);
		this.path;
		this.plugins = this.storeOptions?.plugins?.map((plugin) => this.registerPlugin(plugin));

		BaseStore.registerDefaultReducers(
			this.reducerConfigurations,
			this.setAction,
			this.updateAction
		);

		scope.registerStore(this as Store<unknown>);
		this.reducerConfigurations.forEach((reducerConfiguration) =>
			scope.registerAction(reducerConfiguration.action)
		);

		this.teardown = this.#storePipeline.subscribe();

		this.#metaReducerRunner = Store.createMetaReducerRunner<State>([
			...(this.storeOptions?.useDefaultLogger ? [createLoggingMetaReducer<State>()] : []),
			...(this.storeOptions?.metaReducers ?? []),
		]);
	}

	private registerPlugin(plugin: StorePlugin<State>): StorePlugin<State> {
		plugin.register({
			initialState: this.initialState,
			state$: this.#storePipeline,
			stateInjector: (state: State) => this.state.next(state),
		});
		plugin.start();
		return plugin;
	}

	public override unsubscribe(): void {
		super.unsubscribe();
		this.storeOptions?.plugins?.forEach((plugin) => plugin.stop());
	}
}

export interface StoreSliceOptions<Slice> {
	scope: Scope<unknown>;
	initialState: Slice;
	reducerConfigurations: ReducerConfiguration<Slice>[];
	comparator?: Comparator<Slice>;
	/**
	 * It's considered lazy when the slice was added later and is not part
	 * of the root initialState
	 */
	lazy: boolean;
}

export interface InitialSnapshot<State> {
	nextState: State;
}

export class StoreSlice<ParentSlice, Slice> extends BaseStore<ParentSlice, Slice> {
	protected state = new BehaviorSubject<Slice>(this.options.initialState);
	protected stateObservable$ = this.state.pipe(
		distinctUntilChanged(this.options.comparator)
	) as Observable<Slice>;
	override subscribe = this.stateObservable$
		.pipe(filter(isNonNullable))
		.subscribe.bind(this.stateObservable$);
	protected override scope = this.options.scope;
	protected sliceRegistrations$ = new BehaviorSubject<SliceRegistrationOptions<Slice, unknown>[]>(
		[]
	);

	public readonly setAction = new Action<Slice>(
		`${TINYSLICE_ACTION_DEFAULT_PREFIX} set ${this.path}`
	);
	public readonly updateAction = new Action<Slice>(
		`${TINYSLICE_ACTION_DEFAULT_PREFIX} update ${this.path}`
	);

	#combinedReducer = BaseStore.createCombinedReducer(
		this.path,
		this.options.reducerConfigurations
	);

	#parentListener = this.parent.pipe(
		finalize(() => this.unsubscribe()),
		skip(1), // Skip the initially emitted one

		map((parentState) => {
			const slice = this.selector(parentState);
			if (this.options.lazy && !isNonNullable(slice)) {
				return this.options.initialState;
			} else {
				return slice;
			}
		}),
		filter(isNonNullable),
		distinctUntilChanged(this.options.comparator),
		tap((parentSlice) => this.state.next(parentSlice))
	);

	#slicePipeline = createReducerPipeline<ParentSlice, Slice>(
		this.actions$,
		this.stateObservable$,
		this.sliceRegistrations$,
		this.#combinedReducer,
		this.parent,
		this.path
	).pipe(
		tap((snapshot) => {
			console.log('#slicePipeline', this.path, snapshot);
			// TODO: use comparator
			if (snapshot.prevState !== snapshot.nextState) {
				this.state.next(snapshot.nextState);
			}
		})
	);

	constructor(
		protected readonly parent: BaseStore<unknown, ParentSlice>,
		protected readonly selector: Selector<ParentSlice, Slice>,
		protected readonly merger: Merger<ParentSlice, Slice>,
		protected readonly path: string,
		private readonly options: StoreSliceOptions<Slice>
	) {
		super(options.scope);

		BaseStore.registerDefaultReducers(
			options.reducerConfigurations,
			this.setAction,
			this.updateAction
		);

		options.reducerConfigurations.forEach((reducerConfiguration) =>
			options.scope.registerAction(reducerConfiguration.action)
		);

		this.parent.registerSlice({
			slicePipeline: this.#slicePipeline,
			parent: this.parent,
			selector,
			merger: merger as Merger<ParentSlice, unknown>,
			lazy: this.options.lazy,
			lazyNotificationPayload: JSON.stringify(this.options.initialState),
		});

		this.teardown = this.#parentListener.subscribe();
	}
}

export interface SliceRegistrationOptions<ParentSlice, Slice> {
	parent: BaseStore<unknown, ParentSlice>;
	slicePipeline: Observable<ActionReduceSnapshot<Slice> | InitialSnapshot<Slice>>;
	merger: Merger<ParentSlice, unknown>;
	selector: Selector<ParentSlice, unknown>;
	lazy: boolean;
	lazyNotificationPayload: string;
}

export interface SliceChange<ParentSlice, Slice> {
	snapshot: ActionReduceSnapshot<Slice> | InitialSnapshot<Slice>;
	merger: Merger<ParentSlice, unknown>;
	selector: Selector<ParentSlice, unknown>;
}
