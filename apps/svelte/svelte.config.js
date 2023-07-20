// TODO revert anaged-by-autotool
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';

/**
 * TODO: move this to js-tooling
 * @param {string} path
 * @returns {path is `/${string}`}
 */
const isAbsolute = (path) => {
	return path.startsWith('/');
};

/**
 * TODO: move this to js-tooling
 * @param {string | undefined} path
 * @returns {`/${string}` | ''}
 */
const toBaseHref = (path = '') => {
	const trimmed = path.replace(/\/$/, ''); // Must not end with '/'
	if (trimmed) {
		return isAbsolute(trimmed) ? trimmed : `/${trimmed}`;
	} else {
		return '';
	}
};

/** @type {import('@sveltejs/kit').Config} */
export default {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	vitePlugin: {
		inspector: {
			holdMode: true,
			toggleKeyCombo: 'shift',
		},
	},
	kit: {
		paths: {
			base: toBaseHref(process.env['BASE_HREF']),
		},
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter({
			fallback: 'index.html', // may differ from host to host
		}),
	},
};
