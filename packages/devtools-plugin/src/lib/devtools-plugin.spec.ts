import { describe, expect, it } from 'vitest';
import { TinySliceDevtoolPlugin } from './devtools-plugin.js';

describe('TinySliceDevtoolPlugin', () => {
	it('should work', () => {
		const plugin = new TinySliceDevtoolPlugin({ name: 'test' });
		expect(plugin).toBeDefined();
	});
});
