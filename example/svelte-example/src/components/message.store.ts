import { rootStore, scope } from '../store';

// Ide, get a subscope from slices, automatic action prefixes
export const messageActions = {
	setMessage: scope.createAction<string | undefined>('[Message] set'),
	setWrappedMessage: scope.createAction<{ value: string }>('[Message] set wrapped'),

	clearMessage: scope.createAction<void>('[Message] clear')
};

messageActions.setMessage
	.and(messageActions.setWrappedMessage)
	.combinedActions.subscribe((a) => a.payload);

export interface MessageState {
	lastMessage: string | undefined;
}

export const messageSlice = rootStore.addSlice<MessageState>(
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
