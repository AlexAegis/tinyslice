import { TinySliceDevtoolPlugin } from './devtools-plugin';

describe('TinySliceDevtoolPlugin', () => {
	it('should work', () => {
		const plugin = new TinySliceDevtoolPlugin({ name: 'test' });
		expect(plugin).toBeDefined();
	});
});
