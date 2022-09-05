import type { MetaPacketReducer } from '../store/reducer.type';

/**
 * TODO: Color me green for SUCCESS and red for FAIL(URE)
 */
export const createLoggingMetaReducer =
	<State>(): MetaPacketReducer<State> =>
	({ action, prevState, nextState }) => {
		console.groupCollapsed(action.type);
		console.log('prevState', prevState);
		console.log('payload', action.payload);
		console.log('nextState', nextState);
		console.groupEnd();
	};
