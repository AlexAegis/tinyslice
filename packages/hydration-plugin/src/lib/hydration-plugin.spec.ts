import { describe, expect, it } from 'vitest';
import { TinySliceHydrationPlugin } from './hydration-plugin.js';

describe('TinySliceHydrationPlugin', () => {
	it('should work', () => {
		const plugin = new TinySliceHydrationPlugin('test');
		expect(plugin).toBeDefined();
	});
});
