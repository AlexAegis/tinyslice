import { TestBed } from '@angular/core/testing';
import { RootSlice } from '@tinyslice/core';
import { TinySliceModule } from './tinyslice.module';

describe('TinySliceModule', () => {
	interface RootState {
		foo: number;
	}

	class RootStore {
		constructor(public readonly store: RootSlice<RootState>) {}
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [],
			imports: [TinySliceModule.forRoot<RootState>({ foo: 1 }, [], [], RootStore)],
		}).compileComponents();
	});

	it('should make the RootStore available', () => {
		const rootStore = TestBed.inject(RootStore);
		expect(rootStore).toBeDefined();
	});
});
