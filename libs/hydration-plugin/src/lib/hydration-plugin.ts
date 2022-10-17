import { TinySlicePlugin, TinySlicePluginHooks } from '@tinyslice/core';
import { Observable, Subscription, tap } from 'rxjs';

export const DEFAULT_OPTIONS: HydrationPluginOptions<unknown, unknown> = {
	trimmer: (state) => state,
};

export interface HydrationPluginOptions<State, SavedState extends State = State> {
	trimmer: (state: State) => SavedState;
	validateRetrieved?: (state: unknown) => state is State;
}

/**
 * TODO: Add plugin order constraints. Reason: hydration HAS to happen before ReduxDevtoolsPlugin OR add a REHYDRATE action when setting the latter seems simpler, OR BOTH because then the rehydrate action can be missed
 * TODO: the logger plugin should be the first
 * TODO: if the constrained plugin is also present in the plugins array and not meeting the constraint, put it where it does
 * TODO: do it until
 */
export class TinySliceHydrationPlugin<State, SavedState extends State = State>
	implements TinySlicePlugin<State>
{
	private sink = new Subscription();
	private options: HydrationPluginOptions<State, SavedState>;
	private hooks!: TinySlicePluginHooks<State>;
	private additionalTriggers: (() => void)[] = [];

	private pipeline?: Observable<unknown>;

	constructor(
		private readonly localStorageKey: string,
		options?: Partial<HydrationPluginOptions<State, SavedState>>
	) {
		this.options = {
			...(DEFAULT_OPTIONS as HydrationPluginOptions<State, SavedState>),
			...options,
		};
	}

	retrieve(): State | undefined {
		const persistedState = localStorage.getItem(this.localStorageKey);
		if (persistedState) {
			return JSON.parse(persistedState);
		} else {
			return undefined;
		}
	}

	persist(snapshot: State): void {
		const trimmedState = this.options.trimmer(snapshot);
		const serializedState = JSON.stringify(trimmedState);
		localStorage.setItem(this.localStorageKey, serializedState);
	}

	register = (hooks: TinySlicePluginHooks<State>): void => {
		this.hooks = hooks;
		const retrievedState = this.retrieve();
		if (retrievedState && (this.options.validateRetrieved?.(retrievedState) ?? true)) {
			this.hooks.stateInjector(retrievedState);
		}
		this.pipeline = this.hooks.state$.pipe(tap((state) => this.persist(state.nextState)));
	};

	start = (): void => {
		if (this.pipeline) this.sink.add(this.pipeline.subscribe());
	};

	stop = (): void => {
		this.sink.unsubscribe();
		this.sink = new Subscription();
	};

	registerAdditionalTrigger = (trigger: () => void): void => {
		this.additionalTriggers.push(trigger);
	};
}
