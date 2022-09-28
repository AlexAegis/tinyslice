import { rootStore, scope } from '../store';

export const messageActions = {
	sendMessage: scope.createAction<string | undefined>('[Message] send'),
	clearMessage: scope.createAction<void>('[Message] clear'),
	setSecondMessage: scope.createAction<string>('[Message] set second message'),
};

export interface MessageState {
	lastMessage: string | undefined;
	sideMessage: string | undefined;
	messageHistory: string[];
}

export const messageSlice = rootStore.addSlice<MessageState>(
	'message',
	{ lastMessage: undefined, messageHistory: [], sideMessage: undefined },
	[
		messageActions.sendMessage.reduce((state, payload) => ({
			...state,
			lastMessage: payload,
			messageHistory: payload ? [...state.messageHistory, payload] : state.messageHistory,
		})),
		messageActions.clearMessage.reduce((state) => ({
			...state,
			lastMessage: undefined,
		})),
	]
);

export const sideMessage$ = messageSlice.slice('sideMessage');

export const messageHistory$ = messageSlice.slice('messageHistory');

export const secondMessage$ = messageHistory$.sliceSelect<string>(
	(state) => state?.[1],
	(state, second) => {
		const merged = [...state];
		merged[1] = second;
		return merged;
	},
	[messageActions.setSecondMessage.reduce((_state, payload) => payload)]
);
