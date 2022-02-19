import { countStore, scope } from '../store';

// Ide, get a subscope from slices, automatic action prefixes
export const messageActions = {
	setMessage: scope.createAction<string | undefined>('[Message] set'),
	clearMessage: scope.createAction<void>('[Message] clear')
};

export interface MessageState {
	lastMessage: string | undefined;
}
console.log('lelel');
export const messageSlice = countStore.addSlice<MessageState>(
	'message',
	{ lastMessage: undefined },
	[
		messageActions.setMessage.reduce((state, payload) => ({ ...state, lastMessage: payload })),
		messageActions.clearMessage.reduce((state) => ({
			...state,
			lastMessage: undefined
		}))
	]
);
