import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, NgModule } from '@angular/core';
import { TinySliceDevtoolPlugin } from '@tinyslice/devtools-plugin';
import { Action, RootSlice, Scope, TinySliceModule } from '@tinyslice/ngx';
import { tap } from 'rxjs';

export interface RootState {
	title: string;
}

export class RootStore {
	static setTitle = new Action<string>('setTitle');

	setTitle = RootStore.setTitle;

	title$ = this.store.slice('title');
	constructor(public readonly store: RootSlice<RootState>) {}
}

@Injectable()
export class RootStoreEffects {
	constructor(
		readonly scope: Scope,
		readonly store: RootStore,
		@Inject(DOCUMENT) readonly document: Document
	) {
		scope.createEffect(store.title$.pipe(tap((title) => (document.title = title))));
	}
}

@NgModule({
	imports: [
		TinySliceModule.forRoot<RootState>(
			{
				title: 'myExampleApp',
			},
			[
				RootStore.setTitle.reduce((state, payload) => ({
					...state,
					title: payload,
				})),
			],
			[RootStoreEffects],
			RootStore,
			{
				plugins: [
					new TinySliceDevtoolPlugin({
						name: 'myExampleApp',
					}),
				],
				useDefaultLogger: true,
			}
		),
	],
	providers: [RootStoreEffects],
	exports: [TinySliceModule],
})
export class RootStoreModule {}
