import { TinySliceLoggerPlugin } from './logger-plugin';

describe('TinySliceLoggerPlugin', () => {
	it('should work', () => {
		const plugin = new TinySliceLoggerPlugin();
		expect(plugin).toBeDefined();
	});
});
