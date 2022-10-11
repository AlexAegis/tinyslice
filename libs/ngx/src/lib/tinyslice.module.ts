import { CommonModule } from '@angular/common';
import {
	ApplicationRef,
	Inject,
	InjectionToken,
	ModuleWithProviders,
	NgModule,
	Optional,
	Provider,
	Type,
} from '@angular/core';
import {
	ReducerConfiguration,
	RootSlice,
	Scope,
	Slice,
	SliceOptions,
	TinySlicePlugin,
	TinySlicePluginHooks,
} from '@tinyslice/core';
import { Subscription } from 'rxjs';
import {
	ROOT_STORE,
	TINYSLICE_EFFECT_SERVICES,
	TINYSLICE_ROOT_MODULE_INDICATOR_TOKEN,
} from './services';

export class TinySliceAngularPlugin<State = unknown> implements TinySlicePlugin<State> {
	private hooks!: TinySlicePluginHooks<State>;
	private initialState!: string;
	private sink = new Subscription();

	constructor(private readonly application: ApplicationRef) {}
	register = (hooks: TinySlicePluginHooks<State>): void => {
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
		@Optional()
		private readonly _effectServices: Type<unknown>[]
	) {
		if (this.rootModuleIndicators.length > 1) {
			throw new Error('More than 1 TinySlice root modules were created!');
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static forRoot<RootState = unknown>(
		initialState: RootState,
		effectServices: Type<unknown>[],
		facade: new (slice: RootSlice<RootState>, scope: Scope) => unknown,
		storeOptions?: SliceOptions<never, RootState, unknown>
	): ModuleWithProviders<TinySliceModule> {
		return {
			ngModule: TinySliceModule,
			providers: [
				{
					provide: TINYSLICE_ROOT_MODULE_INDICATOR_TOKEN,
					useValue: true,
					multi: true,
				},
				{
					provide: Scope,
					useFactory: () => new Scope(),
				},
				{
					provide: ROOT_STORE,
					useFactory: (scope: Scope, application: ApplicationRef) => {
						storeOptions?.plugins?.forEach((plugin) =>
							plugin.registerAdditionalTrigger?.(() => application.tick())
						);

						return scope.createRootSlice<RootState>(initialState, storeOptions);
					},
					deps: [Scope, ApplicationRef],
				},
				{
					provide: facade,
					useClass: facade,
					deps: [ROOT_STORE, Scope],
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
	public static forFeature<State>(
		key: string,
		initialState: State,
		reducers: ReducerConfiguration<State>[] = [],
		effectServices: Type<unknown>[],
		facade: new (slice: Slice<unknown, State>, scope: Scope) => unknown
	): ModuleWithProviders<TinySliceModule> {
		const featureToken = new InjectionToken<Slice<unknown, State>>(key);
		return {
			ngModule: TinySliceModule,
			providers: [
				{
					provide: featureToken,
					useFactory: (rootStore: RootSlice<unknown>) =>
						rootStore.addSlice<State, string, string>(key, initialState, { reducers }),
					deps: [ROOT_STORE],
				},
				{
					provide: facade,
					useClass: facade,
					deps: [featureToken, Scope],
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
