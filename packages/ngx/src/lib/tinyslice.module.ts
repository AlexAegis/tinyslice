import { CommonModule } from '@angular/common';
import {
	ApplicationRef,
	Inject,
	InjectionToken,
	NgModule,
	Optional,
	Type,
	type ModuleWithProviders,
	type Provider,
} from '@angular/core';
import {
	Scope,
	Slice,
	type ReducerConfiguration,
	type RootSlice,
	type SliceOptions,
	type TinySlicePlugin,
	type TinySlicePluginHooks,
} from '@tinyslice/core';
import { Subscription } from 'rxjs';
import {
	ROOT_STORE,
	TINYSLICE_EFFECT_SERVICES,
	TINYSLICE_ROOT_MODULE_INDICATOR_TOKEN,
} from './services';

export class TinySliceAngularPlugin<State = unknown> implements TinySlicePlugin<State> {
	private hooks!: TinySlicePluginHooks<State>;
	private sink = new Subscription();

	constructor(private readonly application: ApplicationRef) {}

	register = (hooks: TinySlicePluginHooks<State>): void => {
		this.hooks = hooks;
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

		console.log(this._effectServices);
	}

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
						if (storeOptions?.plugins)
							for (const plugin of storeOptions.plugins)
								plugin.registerAdditionalTrigger?.(() => application.tick());

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
						rootStore.addSlice<State, string>(key, initialState, { reducers }),
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
