import { Scope } from '@tinyslice/core';
import { TinySliceHydrationPlugin } from '@tinyslice/hydration-plugin';
import packageJson from '../../../package.json';

import { tap } from 'rxjs';

const PACKAGE_NAME_AND_VERSION = `${packageJson?.displayName ?? 'app'} (${
	packageJson?.version ?? '0.0.0'
})`;

type CarbonTheme = 'white' | 'g10' | 'g80' | 'g90' | 'g100';

export const scope = new Scope();

export const rootActions = {
	nextTheme: scope.createAction('[root] next state'),
};

export const rootSlice = scope.createRootSlice(
	{
		theme: 'g100' as CarbonTheme,
		debug: false as boolean,
	},
	{
		plugins: [new TinySliceHydrationPlugin(PACKAGE_NAME_AND_VERSION)],
	}
);

export const debug$ = rootSlice.slice('debug');

export const theme$ = rootSlice.slice('theme', {
	reducers: [rootActions.nextTheme.reduce((state) => (state === 'g100' ? 'white' : 'g100'))],
});

scope.createEffect(
	theme$.pipe(tap((theme) => document.documentElement.setAttribute('theme', theme)))
);

scope.createEffect(
	debug$.pipe(
		tap((debug) => {
			if (debug) {
				rootSlice.loadAndSetPlugins(
					() =>
						import('@tinyslice/devtools-plugin').then(
							(plugin) =>
								new plugin.TinySliceDevtoolPlugin({
									name: PACKAGE_NAME_AND_VERSION,
								})
						),
					() =>
						import('@tinyslice/logger-plugin').then(
							(plugin) =>
								new plugin.TinySliceLoggerPlugin({
									onlyTimers: true,
								})
						)
				);
			} else {
				rootSlice.setPlugins([]);
			}
		})
	)
);
