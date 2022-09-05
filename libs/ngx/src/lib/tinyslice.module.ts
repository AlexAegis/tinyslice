import { CommonModule } from '@angular/common';
import {
	ApplicationRef,
	Inject,
	InjectionToken,
	ModuleWithProviders,
	NgModule,
	Provider,
	Type,
} from '@angular/core';
import {
	ReducerConfiguration,
	Scope,
	Store,
	StoreOptions,
	StorePlugin,
	StorePluginHooks,
	StoreSlice,
} from '@tinyslice/core';
import { Subscription } from 'rxjs';
import {
	AbstractRootStore,
	StoreScope,
	TINYSLICE_EFFECT_SERVICES,
	TINYSLICE_ROOT_MODULE_INDICATOR_TOKEN,
} from './services';

export class TinySliceAngularPlugin<State = unknown> implements StorePlugin<State> {
	private hooks!: StorePluginHooks<State>;
	private initialState!: string;
	private sink = new Subscription();

	constructor(private readonly application: ApplicationRef) {}
	register = (hooks: StorePluginHooks<State>): void => {
		this.hooks = hooks;
		this.initialState = JSON.stringify(hooks.initialState);
	};

	onError = (error: unknown): void => {
		console.log('Error from store:', error);
	};

	start = (): void => {
		this.sink.add(
			this.hooks.state$.subscribe(() => {
				this.application.tick();
			})
		);
	};

	stop = (): void => {
		this.sink.unsubscribe();
	};
}
@NgModule({
	imports: [CommonModule],
})
export class TinySliceModule {
	constructor(
		@Inject(TINYSLICE_ROOT_MODULE_INDICATOR_TOKEN)
		private readonly rootModuleIndicators: boolean[],
		@Inject(TINYSLICE_EFFECT_SERVICES)
		private readonly _effectServices: Type<unknown>[]
	) {
		if (this.rootModuleIndicators.length > 1) {
			throw new Error('More than 1 TinySlice root modules were created!');
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static forRoot<RootState = unknown>(
		initialState: RootState,
		reducerConfigurations: ReducerConfiguration<RootState>[] = [],
		effectServices: Type<unknown>[],
		facade: new (slice: Store<RootState>, scope: StoreScope) => unknown,
		storeOptions?: StoreOptions<RootState>
	): ModuleWithProviders<TinySliceModule> {
		const scope = Scope.createScope();
		return {
			ngModule: TinySliceModule,
			providers: [
				{
					provide: TINYSLICE_ROOT_MODULE_INDICATOR_TOKEN,
					useValue: true,
					multi: true,
				},
				{
					provide: StoreScope,
					useValue: scope,
				},
				{
					provide: AbstractRootStore,
					useFactory: (scope: Scope, application: ApplicationRef) => {
						storeOptions?.plugins?.forEach((plugin) =>
							plugin.registerAdditionalTrigger?.(() => application.tick())
						);

						return scope.createStore<RootState>(initialState, reducerConfigurations, {
							...storeOptions,
							plugins: storeOptions?.plugins,
						});
					},
					deps: [StoreScope, ApplicationRef],
				},
				{
					provide: facade,
					useClass: facade,
					deps: [AbstractRootStore, StoreScope],
				},
				...effectServices.map(
					(effectService) =>
						({
							provide: TINYSLICE_EFFECT_SERVICES,
							useClass: effectService,
							multi: true,
						} as Provider)
				),
			],
		};
	}

	/**
	 * TODO: deal with nested features!
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static forFeature<Slice>(
		key: string,
		initialState: Slice,
		reducerConfigurations: ReducerConfiguration<Slice>[] = [],
		effectServices: Type<unknown>[],
		facade: new (slice: StoreSlice<unknown, Slice>, scope: StoreScope) => unknown
	): ModuleWithProviders<TinySliceModule> {
		const featureToken = new InjectionToken<StoreSlice<unknown, Slice>>(key);
		return {
			ngModule: TinySliceModule,
			providers: [
				{
					provide: featureToken,
					useFactory: (rootStore: AbstractRootStore<Slice>) => {
						const featureSlice = rootStore.addSlice<Slice>(
							key as never,
							initialState,
							reducerConfigurations
						);

						return featureSlice;
					},
					deps: [AbstractRootStore],
				},
				{
					provide: facade,
					useClass: facade,
					deps: [featureToken, StoreScope],
				},
				...effectServices.map(
					(effectService) =>
						({
							provide: TINYSLICE_EFFECT_SERVICES,
							useClass: effectService,
							multi: true,
						} as Provider)
				),
			],
		};
	}
}
