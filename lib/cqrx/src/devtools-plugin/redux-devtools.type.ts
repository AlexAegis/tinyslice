/**
 * https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Arguments.md
 * https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Methods.md
 */

declare global {
	interface Window {
		__REDUX_DEVTOOLS_EXTENSION__: ReduxDevtoolsExtension<unknown>;
	}
}

export interface ActionLike {
	type: string;
}

export interface ReduxDevtoolsMessagePayloadJumpToAction {
	type: 'JUMP_TO_ACTION';
	actionId: number;
}
export interface ReduxDevtoolsMessagePayloadToggleAction {
	type: 'TOGGLE_ACTION';
	id: number;
}

export interface ReduxDevtoolsMessageStart {
	id: undefined;
	source: '@devtools-extension';
	type: 'START';
	state: undefined;
}

export interface ReduxDevtoolsMessageDispatch {
	id: number;
	source: '@devtools-extension';
	type: 'DISPATCH';
	state: string;
	payload:
		| ReduxDevtoolsMessagePayloadJumpToAction
		| ReduxDevtoolsMessagePayloadToggleAction
		| undefined;
}

export type ReduxDevtoolsMessage = ReduxDevtoolsMessageStart | ReduxDevtoolsMessageDispatch;

export interface ReduxDevtoolsExtensionConnection<State> {
	subscribe(listener: (change: ReduxDevtoolsMessage) => void): () => void;
	unsubscribe(): void;
	send(action: ActionLike | string | null, state: State): void;
	init(state?: State): void;
	error(anyErr: string | Error): void;
}

export interface ReduxDevtoolsExtension<State> {
	connect(options: ReduxDevtoolsExtensionConfig): ReduxDevtoolsExtensionConnection<State>;
	send(action: ActionLike | string, state: State, options: ReduxDevtoolsExtensionConfig): void;
}

export interface ReduxDevtoolsExtensionConfig {
	name: string;
	latency?: number;
	trace?: boolean;
	traceLimit?: number;
	features?: object | boolean;
	maxAge?: number;
	autoPause?: boolean;
	serialize?: boolean | SerializationOptions;
}

export type SerializationOptions = {
	options?: unknown;
	replacer?: (key: string, value: unknown) => void;
	reviver?: (key: string, value: unknown) => void;
	immutable?: boolean;
	refs?: Array<unknown>;
};
