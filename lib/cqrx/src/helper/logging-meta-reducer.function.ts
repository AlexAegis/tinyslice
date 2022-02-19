import type { MetaPacketReducer } from '../store/reducer.type';

export const createLoggingMetaReducer =
	<State, Payload = unknown>(): MetaPacketReducer<State, Payload> =>
	({ action, prevState, nextState }) => {
		console.groupCollapsed(action.type);
		console.log('prevState', prevState);
		console.log('payload', action.payload);
		console.log('nextState', nextState);
		console.groupEnd();
	};
