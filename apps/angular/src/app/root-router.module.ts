import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
	imports: [
		RouterModule.forRoot([
			{ path: '', pathMatch: 'full', redirectTo: '/counter' },
			{
				path: 'counter',
				loadChildren: () =>
					import('./pages/counter/counter.module').then((m) => m.CounterModule),
			},
			{
				path: 'messages',
				loadChildren: () =>
					import('./pages/messages/messages.module').then((m) => m.MessagesModule),
			},
		]),
	],
	exports: [RouterModule],
})
export class RootRouterModule {}
