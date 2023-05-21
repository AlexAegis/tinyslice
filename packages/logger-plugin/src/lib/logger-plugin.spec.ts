import { describe, expect, it } from 'vitest';
import { TinySliceLoggerPlugin } from './logger-plugin.js';

describe('TinySliceLoggerPlugin', () => {
	it('should work', () => {
		const plugin = new TinySliceLoggerPlugin();
		expect(plugin).toBeDefined();
	});
});
