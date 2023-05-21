/**
 * https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Arguments.md
 * https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Methods.md
 */
declare global {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const __REDUX_DEVTOOLS_EXTENSION__: ReduxDevtoolsExtension<unknown> | undefined;

	interface Window {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		__REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension<unknown>;
	}
}

export interface GlobalReduxDevtools<State = unknown> {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	__REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension<State>;
}

export interface ActionLike {
	type: string;
}

export interface ReduxDevtoolsMessagePayloadActionId {
	type: 'JUMP_TO_ACTION';
	actionId: number;
}

export interface ReduxDevtoolsMessagePayloadIndex {
	type: 'JUMP_TO_STATE';
	index: number;
}

export interface ReduxDevtoolsMessagePayloadId {
	type: 'TOGGLE_ACTION';
	id: number;
}

export interface ReduxDevtoolsMessagePayloadTimestamp {
	type: 'COMMIT' | 'ROLLBACK' | 'RESET';
	timestamp: number;
}

export interface ReduxDevtoolsMessagePayloadEmpty {
	type: 'SWEEP';
}

export interface ReduxDevtoolsMessagePayloadSetActionsActive {
	type: 'SET_ACTIONS_ACTIVE';
	start: number;
	end: number;
	active: boolean;
}

export interface ReduxDevtoolsMessagePayloadReorderAction {
	type: 'REORDER_ACTION';
	actionId: number;
	beforeActionId: number;
}

export interface ReduxDevtoolsAction {
	type: 'PERFORM_ACTION';
	action: ActionLike;
	timestamp: number;
}

export interface ReduxDevtoolsMessagePayloadImportState<State> {
	type: 'IMPORT_STATE';
	nextLiftedState: ReduxDevtoolsStateSnapshot<State>;
	preloadedState: ReduxDevtoolsStateSnapshot<State>;
}

export interface ReduxDevtoolsMessagePayloadStatus {
	type: 'LOCK_CHANGES' | 'PAUSE_RECORDING';
	status: boolean;
}

export interface ReduxDevtoolsStateSnapshot<State> {
	actionsById: Record<number, ReduxDevtoolsAction>;
	computedStates: { state: State }[];
	currentStateIndex: number;
	nextActionId: number;
	skippedActionIds: number[];
	stagedActionIds: number[];
}

export interface ReduxDevtoolsMessageStart {
	id: undefined;
	source: '@devtools-extension';
	type: 'START';
	state: undefined;
}

export interface ReduxDevtoolsMessageDispatch<State> {
	id: number;
	source: '@devtools-extension';
	type: 'DISPATCH';
	state: string;
	payload:
		| ReduxDevtoolsAction
		| ReduxDevtoolsMessagePayloadEmpty
		| ReduxDevtoolsMessagePayloadSetActionsActive
		| ReduxDevtoolsMessagePayloadReorderAction
		| ReduxDevtoolsMessagePayloadStatus
		| ReduxDevtoolsMessagePayloadActionId
		| ReduxDevtoolsMessagePayloadId
		| ReduxDevtoolsMessagePayloadIndex
		| ReduxDevtoolsMessagePayloadTimestamp
		| ReduxDevtoolsMessagePayloadImportState<State>
		| undefined;
}

export type ReduxDevtoolsMessage<State> =
	| ReduxDevtoolsMessageStart
	| ReduxDevtoolsMessageDispatch<State>;

export interface ReduxDevtoolsExtensionConnection<State> {
	subscribe(listener: (change: ReduxDevtoolsMessage<State>) => void): () => void;
	unsubscribe(): void;
	send(action: ActionLike | string | null, state: State): void;
	init(state?: State): void;
	error(anyErr: string | Error): void;
	open(position: 'left' | 'right' | 'bottom' | 'panel' | 'remote'): void;
}

export interface ReduxDevtoolsExtension<State> {
	connect(options: ReduxDevtoolsExtensionConfig): ReduxDevtoolsExtensionConnection<State>;
	disconnect(): void;
	send(action: ActionLike | string, state: State, options: ReduxDevtoolsExtensionConfig): void;
}

export interface ReduxDevtoolsExtensionConfig {
	name: string;
	latency?: number;
	trace?: boolean;
	traceLimit?: number;

	maxAge?: number;
	autoPause?: boolean;
	serialize?: boolean | SerializationOptions;
	features?: {
		/**
		 * start/pause recording of dispatched actions
		 */
		pause?: boolean;
		/**
		 * lock/unlock dispatching actions and side effects
		 */
		lock?: boolean;
		/**
		 * persist states on page reloading
		 */
		persist?: boolean;
		/**
		 * export history of actions in a file
		 */
		export?: boolean;
		/**
		 * import history of actions from a file
		 */
		import?: boolean;
		/**
		 * jump back and forth (time travelling)
		 */
		jump?: boolean;
		/**
		 * skip (cancel) actions
		 */
		skip?: boolean;
		/**
		 * drag and drop actions in the history list
		 */
		reorder?: boolean;
		/**
		 * dispatch custom actions or action creators
		 */
		dispatch?: boolean;
		/**
		 *  generate tests for the selected actions
		 */
		test?: boolean;
	};
}

export interface SerializationOptions {
	options?: unknown;
	replacer?: (key: string, value: unknown) => void;
	reviver?: (key: string, value: unknown) => void;
	immutable?: boolean;
	refs?: unknown[];
}
