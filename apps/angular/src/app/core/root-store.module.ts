import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, NgModule } from '@angular/core';
import {
	Action,
	createLoggingMetaReducer,
	RootSlice,
	Scope,
	TinySliceModule,
} from '@tinyslice/ngx';
import { filter, map, of, switchMap, take, tap } from 'rxjs';
import packageJson from '../../../../../package.json';

const PACKAGE_NAME_AND_VERSION = `${packageJson?.displayName ?? 'app'} (${
	packageJson?.version ?? '0.0.0'
})`;

export interface RootState {
	title: string;
	debug: boolean;
}

export class RootStore {
	static setTitle = new Action<string>('setTitle');

	setTitle = RootStore.setTitle;

	title$ = this.store.slice('title');
	debug$ = this.store.slice('debug');

	constructor(public readonly store: RootSlice<RootState>, private readonly scope: Scope) {
		this.scope.createEffect(
			this.debug$.pipe(
				filter((debug) => debug),
				take(1),
				switchMap((debug) => {
					if (debug) {
						return import('@tinyslice/devtools-plugin');
					} else {
						return of();
					}
				}),
				map(
					(pluginBundle) =>
						new pluginBundle.TinySliceDevtoolPlugin<RootState>({
							name: PACKAGE_NAME_AND_VERSION,
						})
				),
				tap((plugin) => store.addPlugin(plugin))
			)
		);

		this.scope.createEffect(
			this.debug$.pipe(
				filter((debug) => debug),
				take(1),
				tap(() => store.addMetaReducer(createLoggingMetaReducer<RootState>()))
			)
		);
	}
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
				title: PACKAGE_NAME_AND_VERSION,
				debug: false,
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
				plugins: [],
				useDefaultLogger: false,
			}
		),
	],
	providers: [RootStoreEffects],
	exports: [TinySliceModule],
})
export class RootStoreModule {}
