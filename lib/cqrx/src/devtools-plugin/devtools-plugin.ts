import { Observable, Subscription, tap } from 'rxjs';
import { ReduxDevtoolsExtensionConfig } from '.';
import {
	ActionLike,
	ReduxDevtoolsExtension,
	ReduxDevtoolsExtensionConnection,
} from './redux-devtools.type';

export interface DevtoolPluginOptions<State> {
	initialState: State;
	state$: Observable<{ action: ActionLike; newState: State }>;
	stateInjector: (state: State) => void;
	devtoolsPluginOptions: ReduxDevtoolsExtensionConfig;
}

export class DevtoolsPlugin<State> {
	private extension: ReduxDevtoolsExtension<State>;
	private extensionConnection: ReduxDevtoolsExtensionConnection<State>;
	private stateSubscription: Subscription;
	private unsubscribeStateInjector: () => void;

	constructor(private readonly options: DevtoolPluginOptions<State>) {
		const extension = DevtoolsPlugin.getExtension<State>();
		if (!extension) {
			throw new Error('Devtools cant be instrumented!');
		}
		this.extension = extension;
		this.extensionConnection = this.extension.connect(this.options.devtoolsPluginOptions);
		this.extensionConnection.init(this.options.initialState);
		this.stateSubscription = this.options.state$
			.pipe(
				tap(({ action, newState }) => this.extensionConnection.send(action.type, newState))
			)
			.subscribe();

		this.unsubscribeStateInjector = this.extensionConnection.subscribe((message) => {
			if (message.type === 'DISPATCH') {
				if (message.payload?.type === 'JUMP_TO_ACTION') {
					this.options.stateInjector(JSON.parse(message.state) as State);
				}
			}
		});
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
