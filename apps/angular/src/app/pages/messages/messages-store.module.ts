import { NgModule } from '@angular/core';
import { Action, Slice, TinySliceModule } from '@tinyslice/ngx';

export interface MessagesState {
	lastMessage: string | undefined;
	messages: string[];
}

export class MessagesStore {
	static send = new Action<string>('send');
	send = MessagesStore.send;

	lastMessage$ = this.slice.slice('lastMessage');

	messages$ = this.slice.slice('messages');

	secondMessage$ = this.messages$.sliceSelect(
		(state) => state[1],
		(state, slice) => {
			if (state.length >= 1 && slice !== undefined) {
				const merged = [...state];
				merged[1] = slice;
				return merged;
			} else {
				return state;
			}
		}
	);

	constructor(public readonly slice: Slice<unknown, MessagesState>) {}
}

@NgModule({
	imports: [
		TinySliceModule.forFeature<MessagesState>(
			'messages',
			{
				lastMessage: undefined,
				messages: [],
			},
			[
				MessagesStore.send.reduce((state, payload) => ({
					...state,
					lastMessage: payload,
					messages: [...state.messages, payload],
				})),
			],
			[],
			MessagesStore
		),
	],
	exports: [TinySliceModule],
})
export class MessagesStoreModule {}
