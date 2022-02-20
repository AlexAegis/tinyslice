import { rootStore, scope } from '../store';

// Ide, get a subscope from slices, automatic action prefixes
export const messageActions = {
	setMessage: scope.createAction<string | undefined>('[Message] set'),
	setSideMessage: scope.createAction<string | undefined>('[Message] set side message'),
	clearMessage: scope.createAction<void>('[Message] clear'),
	setSecondMessage: scope.createAction<string>('[Message] set second message')
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
		messageActions.setMessage.reduce((state, payload) => {
			return {
				...state,
				lastMessage: payload,
				messageHistory: payload ? [...state.messageHistory, payload] : state.messageHistory
			};
		}),
		messageActions.clearMessage.reduce((state) => ({
			...state,
			lastMessage: undefined
		}))
	]
);

export const sideMessage$ = messageSlice.slice<'sideMessage'>('sideMessage', [
	messageActions.setSideMessage.reduce((_state, payload) => payload)
]);

export const messageHistory$ = messageSlice.slice('messageHistory');

export const secondMessage$ = messageHistory$.slice<string>(
	(state) => state?.[1],
	(state, second) => {
		const merged = [...state];
		merged[1] = second;
		return merged;
	},
	[messageActions.setSecondMessage.reduce((_state, payload) => payload)]
);
