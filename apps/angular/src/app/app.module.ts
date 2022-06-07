import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './core/app.component';
import { CoreModule } from './core/core.module';
import { RootStoreModule } from './core/root-store.module';
import { SharedModule } from './shared';
import { IconsProviderModule } from './shared/icons-provider.module';

registerLocaleData(en);

@NgModule({
	declarations: [AppComponent],
	imports: [
		BrowserModule,
		CoreModule,
		SharedModule,
		RootStoreModule,
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
		IconsProviderModule,
	],
	bootstrap: [AppComponent],
})
export class AppModule {}
