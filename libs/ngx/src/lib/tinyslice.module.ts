import { CommonModule } from '@angular/common';
import { ApplicationRef, InjectionToken, ModuleWithProviders, NgModule } from '@angular/core';
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
import { AbstractRootStore, StoreScope } from './services';

export class TinySliceAngularPlugin<State = unknown> implements StorePlugin<State, unknown> {
	private hooks!: StorePluginHooks<State, unknown>;
	private initialState!: string;
	private sink = new Subscription();

	constructor(private readonly application: ApplicationRef) {}
	register = (hooks: StorePluginHooks<State, unknown>): void => {
		this.hooks = hooks;
		this.initialState = JSON.stringify(hooks.initialState);
	};

	onError = (error: unknown): void => {
		console.log('Error from store:', error);
	};

	start = (): void => {
		console.log('asd');
		this.sink.add(
			this.hooks.state$.subscribe(() => {
				console.log('satechangege');
				this.application.tick();
			})
		);
	};

	stop = (): void => {
		console.log('asd');
		this.sink.unsubscribe();
	};
}
@NgModule({
	imports: [CommonModule],
})
export class TinySliceModule {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static forRoot<RootState = unknown, Payload = any>(
		initialState: RootState,
		reducerConfigurations: ReducerConfiguration<RootState, Payload>[] = [],
		facade: new (slice: Store<RootState, Payload>) => unknown,
		storeOptions?: StoreOptions<RootState>
	): ModuleWithProviders<TinySliceModule> {
		const scope = Scope.createScope();
		return {
			ngModule: TinySliceModule,
			providers: [
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
					deps: [AbstractRootStore],
				},
			],
		};
	}

	/**
	 * TODO: deal with nested features!
	 * TODO: it registers another state the devtools gets two!
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static forFeature<Slice, Payload = any>(
		key: string,
		initialState: Slice,
		reducerConfigurations: ReducerConfiguration<Slice, Payload>[] = [],
		facade: new (slice: StoreSlice<unknown, Slice, Payload>) => unknown
	): ModuleWithProviders<TinySliceModule> {
		const featureToken = new InjectionToken<StoreSlice<unknown, Slice, Payload>>(key);
		return {
			ngModule: TinySliceModule,
			providers: [
				{
					provide: featureToken,
					useFactory: (rootStore: AbstractRootStore<Slice>) => {
						console.log('rootstore', rootStore);
						const featureSlice = rootStore.addSlice<Slice>(
							key,
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
					deps: [featureToken],
				},
			],
		};
	}
}
