import { Scope } from '@tinyslice/core';
import { TinySliceDevtoolPlugin } from '@tinyslice/devtools-plugin';
import { TinySliceLoggerPlugin } from '@tinyslice/logger-plugin';
import { tap } from 'rxjs';

type CarbonTheme = 'white' | 'g10' | 'g80' | 'g90' | 'g100';

export const scope = new Scope();

export const rootActions = {
	nextTheme: scope.createAction('[root] next state'),
};

export const rootSlice = scope.createRootSlice(
	{
		theme: 'g100' as CarbonTheme,
	},
	{
		plugins: [
			new TinySliceLoggerPlugin({
				ignorePaths: ['root.theme'],
				disableGrouping: false,
			}),
			// new TinySliceHydrationPlugin('cache2'),
			new TinySliceDevtoolPlugin({
				name: 'Svelte TinySlice',
			}),
		],
	}
);

export const theme$ = rootSlice.slice('theme', {
	reducers: [rootActions.nextTheme.reduce((state) => (state === 'g100' ? 'white' : 'g100'))],
});

scope.createEffect(
	theme$.pipe(tap((theme) => document.documentElement.setAttribute('theme', theme)))
);
