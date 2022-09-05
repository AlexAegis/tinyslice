import { NgModule, Optional, SkipSelf } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RootStoreModule } from './root-store.module';

@NgModule({
	imports: [BrowserModule, BrowserAnimationsModule, RootStoreModule],
	exports: [BrowserModule, BrowserAnimationsModule],
})
export class CoreModule {
	constructor(@Optional() @SkipSelf() private readonly coreModule: CoreModule) {
		if (this.coreModule) {
			throw new Error('CoreModule initialized twice!');
		}
	}
}
