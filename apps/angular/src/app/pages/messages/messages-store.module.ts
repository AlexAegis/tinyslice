import { NgModule } from '@angular/core';
import { Action, StoreSlice, TinySliceModule } from '@tinyslice/ngx';

export interface MessagesState {
	lastMessage: string | undefined;
	messages: string[];
}

export class MessagesStore {
	static send = new Action<string>('send');
	send = MessagesStore.send;

	lastMessage$ = this.slice.slice('lastMessage');
	messages$ = this.slice.slice('messages');

	constructor(public readonly slice: StoreSlice<unknown, MessagesState>) {}
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
