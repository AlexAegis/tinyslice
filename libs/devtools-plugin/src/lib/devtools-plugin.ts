import { ActionPacket, StorePlugin, StorePluginHooks } from '@tinyslice/core';
import { Subscription, tap } from 'rxjs';
import {
	GlobalReduxDevtools,
	ReduxDevtoolsExtension,
	ReduxDevtoolsExtensionConfig,
	ReduxDevtoolsExtensionConnection,
} from './redux-devtools.type';

export const DEFAULT_DEVTOOLS_OPTIONS: Partial<ReduxDevtoolsExtensionConfig> = {
	name: 'TinySlice',
};

/**
 * Skipping is not implemented
 */
export class TinySliceDevtoolPlugin<State = unknown> implements StorePlugin<State> {
	private extension?: ReduxDevtoolsExtension<State>;
	private extensionConnection?: ReduxDevtoolsExtensionConnection<State>;
	private sink = new Subscription();
	private unsubscribeStateInjector?: () => void;

	private hooks!: StorePluginHooks<State>;
	private committedState: string | undefined;
	private lastState: State | undefined;
	private initialState!: string;

	private actionId = 0;
	private actions: Record<number, ActionPacket<unknown>> = {};
	private actionsTurnedOff = new Set<number>();

	private additionalTriggers: (() => void)[] = [];

	constructor(private readonly options: ReduxDevtoolsExtensionConfig) {
		this.extension = TinySliceDevtoolPlugin.getExtension<State>();
		this.extensionConnection = this.extension?.connect({
			...DEFAULT_DEVTOOLS_OPTIONS,
			...this.options,
		});
	}

	registerAdditionalTrigger = (trigger: () => void): void => {
		this.additionalTriggers.push(trigger);
	};

	register = (hooks: StorePluginHooks<State>): void => {
		this.hooks = hooks;
		this.initialState = JSON.stringify(hooks.initialState);
	};

	onError = (error: unknown): void => {
		console.log('Error from store:', error);
	};

	private connect(connection: ReduxDevtoolsExtensionConnection<State>): void {
		this.lastState = this.initialState ? JSON.parse(this.initialState) : undefined;
		this.committedState = this.initialState;
		connection.init(this.lastState);

		this.sink.add(
			this.hooks.state$
				.pipe(
					tap(({ action, nextState }) => {
						this.lastState = nextState;
						this.actions[this.actionId] = action;
						this.actionId += 1;
						connection.send(action.type, nextState);
					})
				)
				.subscribe()
		);

		this.unsubscribeStateInjector = connection.subscribe((message) => {
			if (message.type === 'DISPATCH') {
				if (message.payload?.type === 'JUMP_TO_ACTION') {
					this.hooks.stateInjector(JSON.parse(message.state) as State);
				} else if (message.payload?.type === 'COMMIT') {
					console.log('COMMIT', this.lastState);
					if (this.lastState) {
						connection.init(this.lastState);
						this.committedState = JSON.stringify(this.lastState);
					} else {
						connection.error('Nothing to commit');
					}
				} else if (message.payload?.type === 'ROLLBACK') {
					if (this.committedState) {
						const parsedCommittedState = JSON.parse(this.committedState) as State;
						connection.init(parsedCommittedState);
						this.hooks.stateInjector(parsedCommittedState);
					} else {
						connection.error('No commit to rollback to');
					}
				} else if (message.payload?.type === 'RESET') {
					const initialState = JSON.parse(this.initialState) as State;
					this.hooks.stateInjector(initialState);
					connection.init(initialState);
				} else if (message.payload?.type === 'IMPORT_STATE') {
					const computedStates = message.payload.nextLiftedState.computedStates;
					Object.values(message.payload.nextLiftedState.actionsById).forEach(
						(action, index) => {
							const state = computedStates[index];
							if (action.action.type === '@@INIT') {
								connection.init(state.state);
							} else {
								connection.send(action.action.type, state.state);
							}
							this.hooks.stateInjector(state.state);
						}
					);
				} else if (message.payload?.type === 'TOGGLE_ACTION') {
					if (this.actionsTurnedOff.has(message.payload.id)) {
						this.actionsTurnedOff.delete(message.payload.id);
					} else {
						this.actionsTurnedOff.add(message.payload.id);
					}
				}
			}

			this.additionalTriggers.forEach((trigger) => trigger());
		});
	}

	start = (): void => {
		if (this.extensionConnection) {
			this.connect(this.extensionConnection);
		}
	};

	stop = (): void => {
		this.sink.unsubscribe();
		this.unsubscribeStateInjector?.();
		this.extensionConnection?.unsubscribe();
	};

	public error(error: string | Error): void {
		this.extensionConnection?.error(error);
	}

	static getExtension<State>(): ReduxDevtoolsExtension<State> | undefined {
		return (globalThis as unknown as GlobalReduxDevtools<State>)?.__REDUX_DEVTOOLS_EXTENSION__;
	}
}
