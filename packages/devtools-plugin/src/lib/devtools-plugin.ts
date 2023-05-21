import type {
	ActionPacket,
	ReduceActionSliceSnapshot,
	TinySlicePlugin,
	TinySlicePluginHooks,
} from '@tinyslice/core';
import { Subscription, tap } from 'rxjs';
import type {
	ActionLike,
	GlobalReduxDevtools,
	ReduxDevtoolsExtension,
	ReduxDevtoolsExtensionConfig,
	ReduxDevtoolsExtensionConnection,
} from './redux-devtools.type.js';

export const DEFAULT_DEVTOOLS_OPTIONS: Partial<ReduxDevtoolsExtensionConfig> = {
	name: 'TinySlice',
};

// eslint-disable-next-line unicorn/no-null
const jsonUndefinedReplacer = <T>(_key: string, value: T) => (value === undefined ? null : value);

const normalizeUndefined = <T>(obj: T): T => {
	const stringified = JSON.stringify(obj, jsonUndefinedReplacer);
	return JSON.parse(stringified) as T;
};

/**
 * Skipping is not implemented
 *
 * Note that the devtools does not show keys defined as undefined so they are
 * normalized to null
 */
export class TinySliceDevtoolPlugin<State = unknown> implements TinySlicePlugin<State> {
	private extension?: ReduxDevtoolsExtension<State> | undefined;
	private extensionConnection?: ReduxDevtoolsExtensionConnection<State> | undefined;
	private sink = new Subscription();
	private unsubscribeStateInjector?: () => void;

	private hooks!: TinySlicePluginHooks<State>;
	private committedState: string | undefined;
	private lastState: State | undefined;
	private initialState!: string;

	private actionId = 0;
	private actions: Record<number, ActionPacket> = {};
	private actionsTurnedOff = new Set<number>();

	private additionalTriggers: (() => void)[] = [];

	constructor(private readonly options: ReduxDevtoolsExtensionConfig) {
		this.extension = TinySliceDevtoolPlugin.getExtension<State>();
	}

	registerAdditionalTrigger = (trigger: () => void): void => {
		this.additionalTriggers.push(trigger);
	};

	register = (hooks: TinySlicePluginHooks<State>): void => {
		this.hooks = hooks;
		this.initialState = JSON.stringify(normalizeUndefined(hooks.initialState));
	};

	onError = (error: unknown): void => {
		console.log('Error from store:', error);
	};

	private connect(connection: ReduxDevtoolsExtensionConnection<State>): void {
		this.lastState = this.initialState ? (JSON.parse(this.initialState) as State) : undefined;
		this.committedState = this.initialState;
		connection.init(this.lastState);

		this.sink.add(
			this.hooks.state$
				.pipe(
					tap<ReduceActionSliceSnapshot<State>>(({ actionPacket, nextState }) => {
						this.lastState = normalizeUndefined(nextState);

						this.actions[this.actionId] = actionPacket ;
						this.actionId += 1;
						connection.send(actionPacket as ActionLike, this.lastState);
					})
				)
				.subscribe()
		);

		this.unsubscribeStateInjector = connection.subscribe((message) => {
			if (message.type === 'DISPATCH') {
				switch (message.payload?.type) {
					case 'JUMP_TO_ACTION': {
						this.hooks.stateInjector(JSON.parse(message.state) as State);

						break;
					}
					case 'COMMIT': {
						console.log('COMMIT', this.lastState);
						if (this.lastState) {
							connection.init(this.lastState);
							this.committedState = JSON.stringify(this.lastState);
						} else {
							connection.error('Nothing to commit');
						}

						break;
					}
					case 'ROLLBACK': {
						if (this.committedState) {
							const parsedCommittedState = JSON.parse(this.committedState) as State;
							connection.init(parsedCommittedState);
							this.hooks.stateInjector(parsedCommittedState);
						} else {
							connection.error('No commit to rollback to');
						}

						break;
					}
					case 'RESET': {
						const initialState = JSON.parse(this.initialState) as State;
						this.hooks.stateInjector(initialState);
						connection.init(initialState);

						break;
					}
					case 'IMPORT_STATE': {
						const computedStates = message.payload.nextLiftedState.computedStates;
						const actions = Object.values(message.payload.nextLiftedState.actionsById);
						const lastState = computedStates[actions.length - 1]?.state;
						for (const [index, action] of actions.entries()) {
							const state = computedStates[index];
							if (state) {
								if (action.action.type === '@@INIT') {
									connection.init(state.state);
								} else {
									connection.send(action.action, state.state);
								}
							}
						}
						if (lastState) {
							this.hooks.stateInjector(lastState);
						}

						break;
					}
					case 'TOGGLE_ACTION': {
						if (this.actionsTurnedOff.has(message.payload.id)) {
							this.actionsTurnedOff.delete(message.payload.id);
						} else {
							this.actionsTurnedOff.add(message.payload.id);
						}

						break;
					}
					// No default
				}
			}

			for (const trigger of this.additionalTriggers) trigger();
		});
	}

	private disconnect(): void {
		this.extension?.disconnect();
	}

	start = (): void => {
		this.extensionConnection = this.extension?.connect({
			...DEFAULT_DEVTOOLS_OPTIONS,
			...this.options,
		});
		if (this.extensionConnection) {
			this.connect(this.extensionConnection);
		}
	};

	stop = (): void => {
		this.sink.unsubscribe();
		this.unsubscribeStateInjector?.();
		this.extensionConnection?.unsubscribe();
		if (this.extensionConnection) {
			this.disconnect();
		}
		this.sink = new Subscription();
	};

	public error(error: string | Error): void {
		this.extensionConnection?.error(error);
	}

	static getExtension<State>(): ReduxDevtoolsExtension<State> | undefined {
		return (globalThis as unknown as GlobalReduxDevtools<State>).__REDUX_DEVTOOLS_EXTENSION__;
	}
}
