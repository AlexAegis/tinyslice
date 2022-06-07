import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MessagesStore } from './messages-store.module';

@Component({
	selector: 'tinyslice-messages',
	templateUrl: './messages.component.html',
	styleUrls: ['./messages.component.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagesComponent {
	constructor(public readonly messagesStore: MessagesStore) {}
}
