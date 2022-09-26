import { TestBed } from '@angular/core/testing';
import { Store } from '@tinyslice/core';
import { TinySliceModule } from './tinyslice.module';

describe('TinySliceModule', () => {
	interface RootSlice {
		foo: number;
	}

	class RootStore {
		constructor(public readonly store: Store<RootSlice>) {}
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [],
			imports: [TinySliceModule.forRoot<RootSlice>({ foo: 1 }, [], [], RootStore)],
		}).compileComponents();
	});

	it('should make the RootStore available', () => {
		const rootStore = TestBed.inject(RootStore);
		expect(rootStore).toBeDefined();
	});
});
