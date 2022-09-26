import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './core/app.component';
import { CoreModule } from './core/core.module';
import { RootRouterModule } from './root-router.module';
import { SharedModule } from './shared';

registerLocaleData(en);

@NgModule({
	declarations: [AppComponent],
	imports: [BrowserModule, CoreModule, SharedModule, RootRouterModule],
	bootstrap: [AppComponent],
})
export class AppModule {}
