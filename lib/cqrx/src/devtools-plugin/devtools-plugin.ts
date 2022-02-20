import { Observable, Subscription, tap } from 'rxjs';
import { ReduxDevtoolsExtensionConfig } from '.';
import { ActionPacket } from '..';
import { ActionReduceSnapshot } from '../store/reducer.type';
import { ReduxDevtoolsExtension, ReduxDevtoolsExtensionConnection } from './redux-devtools.type';

export const DEFAULT_DEVTOOLS_OPTIONS: Partial<ReduxDevtoolsExtensionConfig> = {
	name: 'TinySlice',
};

export interface DevtoolPluginOptions<State, Payload = unknown> {
	initialState: State;
	state$: Observable<ActionReduceSnapshot<State, Payload>>;
	stateInjector: (state: State) => void;
	devtoolsPluginOptions: ReduxDevtoolsExtensionConfig;
}

/**
 * Skipping is not implemented
 */
export class DevtoolsPlugin<State> {
	private extension: ReduxDevtoolsExtension<State>;
	private extensionConnection: ReduxDevtoolsExtensionConnection<State>;
	private stateSubscription: Subscription;
	private unsubscribeStateInjector: () => void;

	private committedState: string;
	private lastState: State | undefined;
	private initialState: string;

	private actionId = 0;
	private actions: Record<number, ActionPacket<unknown>> = {};
	private actionsTurnedOff = new Set<number>();

	constructor(private readonly options: DevtoolPluginOptions<State>) {
		const extension = DevtoolsPlugin.getExtension<State>();
		if (!extension) {
			throw new Error('Devtools extension not installed!');
		}
		this.extension = extension;
		this.lastState = this.options.initialState;
		this.initialState = JSON.stringify(this.options.initialState);
		this.committedState = this.initialState;

		this.extensionConnection = this.extension.connect({
			...DEFAULT_DEVTOOLS_OPTIONS,
			...this.options.devtoolsPluginOptions,
		});
		this.extensionConnection.init(this.options.initialState);
		this.stateSubscription = this.options.state$
			.pipe(
				tap(({ action, nextState }) => {
					this.lastState = nextState;
					this.actions[this.actionId] = action;
					this.actionId += 1;
					this.extensionConnection.send(action.type, nextState);
				})
			)
			.subscribe();

		this.unsubscribeStateInjector = this.extensionConnection.subscribe((message) => {
			console.log('message from extension', message);
			if (message.type === 'DISPATCH') {
				if (message.payload?.type === 'JUMP_TO_ACTION') {
					this.options.stateInjector(JSON.parse(message.state) as State);
				} else if (message.payload?.type === 'COMMIT') {
					console.log('COMMIT', this.lastState);
					if (this.lastState) {
						this.extensionConnection.init(this.lastState);
						this.committedState = JSON.stringify(this.lastState);
					} else {
						this.extensionConnection.error('Nothing to commit');
					}
				} else if (message.payload?.type === 'ROLLBACK') {
					if (this.committedState) {
						const parsedCommittedState = JSON.parse(this.committedState) as State;
						this.extensionConnection.init(parsedCommittedState);
						this.options.stateInjector(parsedCommittedState);
					} else {
						this.extensionConnection.error('No commit to rollback to');
					}
				} else if (message.payload?.type === 'RESET') {
					const initialState = JSON.parse(this.initialState) as State;
					this.options.stateInjector(initialState);
					this.extensionConnection.init(initialState);
				} else if (message.payload?.type === 'IMPORT_STATE') {
					const computedStates = message.payload.nextLiftedState.computedStates;
					Object.values(message.payload.nextLiftedState.actionsById).forEach(
						(action, index) => {
							const state = computedStates[index];
							if (action.action.type === '@@INIT') {
								this.extensionConnection.init(state.state);
							} else {
								this.extensionConnection.send(action.action.type, state.state);
							}
							this.options.stateInjector(state.state);
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
		});
	}

	public error(error: string | Error): void {
		this.extensionConnection.error(error);
	}

	static getExtension<State>(): ReduxDevtoolsExtension<State> | undefined {
		return window?.__REDUX_DEVTOOLS_EXTENSION__ as ReduxDevtoolsExtension<State>;
	}

	unsubscribe(): void {
		this.stateSubscription.unsubscribe();
		this.unsubscribeStateInjector();
		this.extensionConnection.unsubscribe();
	}
}
