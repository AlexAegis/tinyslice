import { TinySliceHydrationPlugin } from './hydration-plugin';

describe('TinySliceHydrationPlugin', () => {
	it('should work', () => {
		const plugin = new TinySliceHydrationPlugin('test');
		expect(plugin).toBeDefined();
	});
});
