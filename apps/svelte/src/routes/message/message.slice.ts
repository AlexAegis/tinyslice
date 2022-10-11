import { rootSlice, scope } from '../../root.slice';

export const messageActions = {
	sendMessage: scope.createAction<string | number | null | undefined>('[Message] send'),
	clearMessage: scope.createAction<void>('[Message] clear'),
	setSecondMessage: scope.createAction<string>('[Message] set second message'),
};

export interface MessageState {
	lastMessage: string | number | undefined;
	messageHistory: (string | number)[];
}

export const messageSlice = rootSlice.addSlice(
	'message',
	{ lastMessage: undefined, messageHistory: [] } as MessageState,
	{
		reducers: [
			messageActions.sendMessage.reduce((state, payload) => ({
				...state,
				lastMessage: payload ?? undefined,
				messageHistory: payload ? [...state.messageHistory, payload] : state.messageHistory,
			})),
			messageActions.clearMessage.reduce((state) => ({
				...state,
				lastMessage: undefined,
			})),
		],
	}
);

export const messageHistory$ = messageSlice.slice('messageHistory');

export const secondMessage$ = messageHistory$.sliceSelect<string | number>(
	(state) => state?.[1],
	(state, second) => {
		const merged = [...state];
		merged[1] = second;
		return merged;
	},
	{ reducers: [messageActions.setSecondMessage.reduce((_state, payload) => payload)] }
);
