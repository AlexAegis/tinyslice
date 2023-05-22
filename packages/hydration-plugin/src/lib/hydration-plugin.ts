import { isNotNullish } from '@alexaegis/common';
import {
	TINYSLICE_PREFIX,
	type ReduceActionSliceSnapshot,
	type TinySlicePlugin,
	type TinySlicePluginHooks,
} from '@tinyslice/core';
import { Observable, Subscription, debounceTime, tap } from 'rxjs';

export const DEFAULT_OPTIONS: HydrationPluginOptions<unknown, unknown> = {
	trimmer: (state) => state,
	migrations: [],
	getter: (key) => {
		const persistedState = localStorage.getItem(key);
		return persistedState ? (JSON.parse(persistedState) as unknown) : undefined;
	},
	setter: (key, state) => {
		const serializedState = JSON.stringify(state);
		localStorage.setItem(key, serializedState);
	},
	remover: (key) => localStorage.removeItem(key),
	debounceTime: 100,
};

export interface Migration<OldState, NewState> {
	fromKey: string;
	toKey: string;
	migrate: (oldState: OldState, existingNewState: NewState | undefined) => NewState;
	getter?: (key: string) => OldState | undefined | null;
	setter?: (key: string, state: NewState) => void;
	remover?: (key: string) => void;
}

export interface HydrationPluginOptions<State, SavedState extends State = State> {
	trimmer: (state: State) => SavedState;
	validateRetrieved?: (state: unknown) => state is State;
	migrations: Migration<unknown, unknown>[];
	getter: (key: string) => State | undefined | null;
	setter: (key: string, state: State) => void;
	remover: (key: string) => void;
	debounceTime: number;
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

	private pipeline?: Observable<ReduceActionSliceSnapshot<State>> | undefined;

	constructor(
		private readonly localStorageKey: string,
		options?: Partial<HydrationPluginOptions<State, SavedState>>
	) {
		this.options = {
			...(DEFAULT_OPTIONS as HydrationPluginOptions<State, SavedState>),
			...options,
		};
		this.tryMigrations();
	}

	private runMigrations(): boolean {
		let migrated = false;
		for (const migration of this.options.migrations) {
			const getter = migration.getter ?? this.options.getter;
			const stateToBeMigrated = getter(migration.fromKey);

			if (isNotNullish(stateToBeMigrated)) {
				console.group(
					`${TINYSLICE_PREFIX} Running migration from ${migration.fromKey} to ${migration.toKey}`
				);
				console.log('Migrating', stateToBeMigrated);
				try {
					const stateToBeMigratedTo = getter(migration.toKey);
					if (stateToBeMigratedTo) {
						console.log('Merging...', stateToBeMigratedTo);
					}
					const migratedState = migration.migrate(stateToBeMigrated, stateToBeMigratedTo);
					const setter = migration.setter ?? this.options.setter;
					setter(migration.toKey, migratedState as State);
					const remover = migration.remover ?? this.options.remover;
					remover(migration.fromKey);
					migrated = true;
					console.log('Migration finished!', migratedState);
				} catch (error) {
					console.error('Migration error!', error);
				}

				console.groupEnd();
			}
		}
		return migrated;
	}

	private tryMigrations(): void {
		let migrated = true;
		while (migrated) {
			migrated = this.runMigrations();
		}
	}

	retrieve(): State | undefined | null {
		return this.options.getter(this.localStorageKey);
	}

	persist(snapshot: State): void {
		const trimmedState = this.options.trimmer(snapshot);
		this.options.setter(this.localStorageKey, trimmedState);
	}

	register = (hooks: TinySlicePluginHooks<State>): void => {
		this.hooks = hooks;
		const retrievedState = this.retrieve();
		if (retrievedState && (this.options.validateRetrieved?.(retrievedState) ?? true)) {
			this.hooks.stateInjector(retrievedState);
		}
		this.pipeline = this.hooks.state$;
		if (this.options.debounceTime) {
			this.pipeline = this.pipeline.pipe(debounceTime(this.options.debounceTime));
		}
		this.pipeline = this.pipeline.pipe(tap((state) => this.persist(state.nextState)));
	};

	start = (): void => {
		if (this.pipeline) {
			this.sink.add(this.pipeline.subscribe());
		}
	};

	stop = (): void => {
		this.sink.unsubscribe();
		this.sink = new Subscription();
	};

	registerAdditionalTrigger = (trigger: () => void): void => {
		this.additionalTriggers.push(trigger);
	};
}
