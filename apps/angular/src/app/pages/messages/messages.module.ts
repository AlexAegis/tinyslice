import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared';
import { MessagesStoreModule } from './messages-store.module';
import { MessagesComponent } from './messages.component';

@NgModule({
	declarations: [MessagesComponent],
	imports: [
		SharedModule,
		RouterModule.forChild([{ path: '', component: MessagesComponent }]),
		MessagesStoreModule,
	],
})
export class MessagesModule {}
