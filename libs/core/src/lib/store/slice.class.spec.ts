import { Observer, Subscription } from 'rxjs';
import { Action } from '../action';
import { Scope } from './scope.class';
import { RootSlice, Slice } from './slice.class';

const createMockObserver = <T>(): Observer<T> => ({
	next: jest.fn(),
	complete: jest.fn(),
	error: jest.fn(),
});

describe('slice', () => {
	let sink!: Subscription;
	let scope!: Scope;

	const ROOT_SLICE_NAME = 'root';
	const FOO_SLICE_NAME = 'foo';
	const BAR_SLICE_NAME = 'bar';
	const BER_SLICE_NAME = 'ber';
	const BOR_SLICE_NAME = 'bor';
	const ZED_SLICE_NAME = 'zed';
	const YON_SLICE_NAME = 'yon';

	beforeEach(() => {
		sink = new Subscription();
		scope = new Scope();
	});

	afterEach(() => jest.clearAllMocks());
	afterEach(() => sink.unsubscribe());

	describe('unsubscribe', () => {
		interface RootState {
			foo: FooState;
		}

		interface FooState {
			bar: string;
			bor: string;
		}

		let rootSlice!: RootSlice<RootState>;
		let fooSlice!: Slice<RootState, FooState>;
		let barSlice!: Slice<FooState, string>;
		let borSlice!: Slice<FooState, string>;

		const initialRootSlice: RootState = {
			[FOO_SLICE_NAME]: {
				[BAR_SLICE_NAME]: ZED_SLICE_NAME,
				[BOR_SLICE_NAME]: YON_SLICE_NAME,
			},
		};

		const rootObserver: Observer<RootState> = createMockObserver();
		const fooSliceObserver: Observer<FooState> = createMockObserver();
		const barSliceObserver: Observer<string> = createMockObserver();
		const borSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			rootSlice = scope.createRootSlice<RootState>(initialRootSlice);

			fooSlice = rootSlice.slice(FOO_SLICE_NAME);
			barSlice = fooSlice.slice(BAR_SLICE_NAME);
			borSlice = fooSlice.slice(BOR_SLICE_NAME);

			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(fooSlice.subscribe(fooSliceObserver));
			sink.add(barSlice.subscribe(barSliceObserver));
			sink.add(borSlice.subscribe(borSliceObserver));
		});

		it('should complete all subscribers if the root store is shut down', () => {
			rootSlice.unsubscribe();
			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(rootObserver.error).toHaveBeenCalledTimes(0);
			expect(rootObserver.complete).toHaveBeenCalledTimes(1);

			expect(fooSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(fooSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(fooSliceObserver.complete).toHaveBeenCalledTimes(1);

			expect(barSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(barSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(barSliceObserver.complete).toHaveBeenCalledTimes(1);

			expect(borSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(borSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(borSliceObserver.complete).toHaveBeenCalledTimes(1);
		});

		it('should complete all child slices if the slice is unsubscribed but not the parent', () => {
			fooSlice.unsubscribe();
			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(rootObserver.error).toHaveBeenCalledTimes(0);
			expect(rootObserver.complete).toHaveBeenCalledTimes(0);

			expect(fooSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(fooSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(fooSliceObserver.complete).toHaveBeenCalledTimes(1);

			expect(barSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(barSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(barSliceObserver.complete).toHaveBeenCalledTimes(1);

			expect(borSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(borSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(borSliceObserver.complete).toHaveBeenCalledTimes(1);
		});

		it('should complete the leaf slices if the slice is unsubscribed but not the parents', () => {
			barSlice.unsubscribe();
			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(rootObserver.error).toHaveBeenCalledTimes(0);
			expect(rootObserver.complete).toHaveBeenCalledTimes(0);

			expect(fooSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(fooSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(fooSliceObserver.complete).toHaveBeenCalledTimes(0);

			expect(barSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(barSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(barSliceObserver.complete).toHaveBeenCalledTimes(1);

			expect(borSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(borSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(borSliceObserver.complete).toHaveBeenCalledTimes(0);
		});
	});

	describe('emission', () => {
		interface RootState {
			[FOO_SLICE_NAME]: FooState;
		}

		interface FooState {
			[BAR_SLICE_NAME]: string;
			[BOR_SLICE_NAME]: string;
		}

		let rootSlice!: RootSlice<RootState>;
		let fooSlice!: Slice<RootState, FooState>;
		let barSlice!: Slice<FooState, string>;
		let borSlice!: Slice<FooState, string>;

		const initialBarSlice = 'a';
		const initialBorSlice = 'b';

		const initialRootSlice: RootState = {
			[FOO_SLICE_NAME]: {
				[BAR_SLICE_NAME]: initialBarSlice,
				[BOR_SLICE_NAME]: initialBorSlice,
			},
		};

		const rootObserver: Observer<RootState> = createMockObserver();
		const fooSliceObserver: Observer<FooState> = createMockObserver();
		const barSliceObserver: Observer<string> = createMockObserver();
		const borSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			rootSlice = scope.createRootSlice<RootState>(initialRootSlice);

			fooSlice = rootSlice.slice(FOO_SLICE_NAME);
			barSlice = fooSlice.slice(BAR_SLICE_NAME);
			borSlice = fooSlice.slice(BOR_SLICE_NAME);

			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(fooSlice.subscribe(fooSliceObserver));
			sink.add(barSlice.subscribe(barSliceObserver));
			sink.add(borSlice.subscribe(borSliceObserver));
		});

		describe('the premade set action', () => {
			it('should require all fields on a slice and emit all parents and all children', () => {
				fooSlice.set({ [BOR_SLICE_NAME]: 'c', [BAR_SLICE_NAME]: 'd' });
				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(rootObserver.error).toHaveBeenCalledTimes(0);
				expect(rootObserver.complete).toHaveBeenCalledTimes(0);

				expect(fooSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(fooSliceObserver.complete).toHaveBeenCalledTimes(0);

				expect(barSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(barSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(barSliceObserver.complete).toHaveBeenCalledTimes(0);

				expect(borSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(borSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(borSliceObserver.complete).toHaveBeenCalledTimes(0);
			});
		});

		describe('the premade update action', () => {
			it('should emit itself and nothing else with an empty update', () => {
				rootSlice.update({});
				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(rootObserver.error).toHaveBeenCalledTimes(0);
				expect(rootObserver.complete).toHaveBeenCalledTimes(0);

				expect(fooSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(fooSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(fooSliceObserver.complete).toHaveBeenCalledTimes(0);

				expect(barSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(barSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(barSliceObserver.complete).toHaveBeenCalledTimes(0);

				expect(borSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(borSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(borSliceObserver.complete).toHaveBeenCalledTimes(0);
			});

			it('should emit all parents and all changed children', () => {
				fooSlice.update({ [BOR_SLICE_NAME]: initialBorSlice + 'change' });
				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(rootObserver.error).toHaveBeenCalledTimes(0);
				expect(rootObserver.complete).toHaveBeenCalledTimes(0);

				expect(fooSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(fooSliceObserver.complete).toHaveBeenCalledTimes(0);

				expect(barSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(barSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(barSliceObserver.complete).toHaveBeenCalledTimes(0);

				expect(borSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(borSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(borSliceObserver.complete).toHaveBeenCalledTimes(0);
			});

			it('should emit all parents but no siblings', () => {
				barSlice.update('updated');
				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(rootObserver.error).toHaveBeenCalledTimes(0);
				expect(rootObserver.complete).toHaveBeenCalledTimes(0);

				expect(fooSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(fooSliceObserver.complete).toHaveBeenCalledTimes(0);

				expect(barSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(barSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(barSliceObserver.complete).toHaveBeenCalledTimes(0);

				expect(borSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(borSliceObserver.error).toHaveBeenCalledTimes(0);
				expect(borSliceObserver.complete).toHaveBeenCalledTimes(0);
			});
		});
	});

	describe('reducers', () => {
		interface RootState {
			[FOO_SLICE_NAME]: FooState;
		}

		interface FooState {
			[BAR_SLICE_NAME]: string;
		}

		let rootSlice!: RootSlice<RootState>;
		let fooSlice!: Slice<RootState, FooState>;
		let barSlice!: Slice<FooState, string>;

		const initialRootSlice: RootState = {
			[FOO_SLICE_NAME]: { [BAR_SLICE_NAME]: 'a' },
		};

		const rootObserver: Observer<RootState> = createMockObserver();
		const fooSliceObserver: Observer<FooState> = createMockObserver();
		const barSliceObserver: Observer<string> = createMockObserver();

		let testAction!: Action<void>;

		const reducerSpy = jest.fn<void, [string, string]>();

		beforeEach(() => {
			testAction = scope.createAction('test');
			rootSlice = scope.createRootSlice(initialRootSlice, {
				reducers: [
					testAction.reduce((state) => {
						reducerSpy(ROOT_SLICE_NAME, 'a');
						return state;
					}),
				],
			});

			fooSlice = rootSlice.slice(FOO_SLICE_NAME, {
				reducers: [
					testAction.reduce((state) => {
						reducerSpy(FOO_SLICE_NAME, 'a');
						return state;
					}),
					testAction.reduce((state) => {
						reducerSpy(FOO_SLICE_NAME, 'b');
						return state;
					}),
				],
			});
			barSlice = fooSlice.slice(BAR_SLICE_NAME, {
				reducers: [
					testAction.reduce((state) => {
						reducerSpy(BAR_SLICE_NAME, 'b');
						return state;
					}),
					testAction.reduce((state) => {
						reducerSpy(BAR_SLICE_NAME, 'a');
						return state;
					}),
				],
			});

			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(fooSlice.subscribe(fooSliceObserver));
			sink.add(barSlice.subscribe(barSliceObserver));
		});

		it('should always be executed from leaf to root, in order of definition', () => {
			testAction.next();
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(1, BAR_SLICE_NAME, 'b');
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(2, BAR_SLICE_NAME, 'a');
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(3, FOO_SLICE_NAME, 'a');
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(4, FOO_SLICE_NAME, 'b');
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(5, ROOT_SLICE_NAME, 'a');
		});
	});

	describe('error', () => {
		interface RootState {
			[FOO_SLICE_NAME]: string;
		}

		let rootSlice!: RootSlice<RootState>;
		const initialRootSlice: RootState = {
			[FOO_SLICE_NAME]: 'a',
		};

		let errorTestAction: Action<void>;
		const testError = new Error('error from test action');

		const rootObserver: Observer<RootState> = createMockObserver();

		let consoleErrorSpy: jest.SpyInstance;

		beforeEach(() => {
			errorTestAction = scope.createAction('error test action');
			rootSlice = scope.createRootSlice(initialRootSlice, {
				reducers: [
					errorTestAction.reduce((_state) => {
						throw testError;
					}),
				],
			});

			consoleErrorSpy = jest.spyOn(console, 'error');

			sink.add(rootSlice.subscribe(rootObserver));
		});

		it('should forward the errors from reducers to the console', () => {
			errorTestAction.next();
			expect(rootObserver.next).toHaveBeenCalledTimes(1); // Initial emit
			expect(rootObserver.error).toHaveBeenCalledTimes(0); // No error surfaced
			expect(rootObserver.complete).toHaveBeenCalledTimes(0);

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
		});
	});

	describe('slices', () => {
		const UNCHANGING_SLICE_NAME = 'unchanging';

		interface RootState {
			[FOO_SLICE_NAME]: FooState;
			unchanging: string;
		}

		interface FooState {
			[BAR_SLICE_NAME]: BarState;
			ber: string;
		}

		interface BarState {
			[ZED_SLICE_NAME]: number;
		}

		let rootSlice!: RootSlice<RootState>;
		let fooSlice!: Slice<RootState, FooState>;
		let barSlice!: Slice<FooState, BarState>;
		let zedSlice!: Slice<BarState, number>;
		let berSlice!: Slice<FooState, string>;

		let unchangingSlice!: Slice<RootState, string>;

		const initialZedSlice = 1;
		const initialBarSlice: BarState = { [ZED_SLICE_NAME]: initialZedSlice };
		const initialBerSlice = 'tangerine';
		const initialFooSlice: FooState = {
			[BAR_SLICE_NAME]: initialBarSlice,
			[BER_SLICE_NAME]: initialBerSlice,
		};
		const initialUnchangingSlice = 'solid';
		const initialRootSlice: RootState = {
			[FOO_SLICE_NAME]: initialFooSlice,
			[UNCHANGING_SLICE_NAME]: initialUnchangingSlice,
		};

		const rootObserver: Observer<RootState> = createMockObserver();
		const fooSliceObserver: Observer<FooState> = createMockObserver();
		const barSliceObserver: Observer<BarState> = createMockObserver();
		const berSliceObserver: Observer<string> = createMockObserver();
		const zedSliceObserver: Observer<number> = createMockObserver();
		const unchangingSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			rootSlice = scope.createRootSlice<RootState>(initialRootSlice);

			fooSlice = rootSlice.slice(FOO_SLICE_NAME);
			barSlice = fooSlice.slice(BAR_SLICE_NAME);
			zedSlice = barSlice.slice(ZED_SLICE_NAME);
			berSlice = fooSlice.slice(BER_SLICE_NAME);
			unchangingSlice = rootSlice.slice(UNCHANGING_SLICE_NAME);

			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(fooSlice.subscribe(fooSliceObserver));
			sink.add(barSlice.subscribe(barSliceObserver));
			sink.add(berSlice.subscribe(berSliceObserver));
			sink.add(zedSlice.subscribe(zedSliceObserver));
			sink.add(unchangingSlice.subscribe(unchangingSliceObserver));
		});

		beforeEach(() => {
			// Assert initial Setup
			expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootSlice);
			expect(fooSliceObserver.next).toHaveBeenLastCalledWith(initialFooSlice);
			expect(barSliceObserver.next).toHaveBeenLastCalledWith(initialBarSlice);
			expect(berSliceObserver.next).toHaveBeenLastCalledWith(initialBerSlice);
			expect(zedSliceObserver.next).toHaveBeenLastCalledWith(initialZedSlice);
			expect(unchangingSliceObserver.next).toHaveBeenLastCalledWith(initialUnchangingSlice);

			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(fooSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(barSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(berSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(zedSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(unchangingSliceObserver.next).toHaveBeenCalledTimes(1);
		});

		describe('updating the root node', () => {
			it('should emit shallow on a shallow update', () => {
				rootSlice.set({
					...rootSlice.value,
				});

				expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootSlice);
				expect(fooSliceObserver.next).toHaveBeenLastCalledWith(initialFooSlice);
				expect(barSliceObserver.next).toHaveBeenLastCalledWith(initialBarSlice);
				expect(berSliceObserver.next).toHaveBeenLastCalledWith(initialBerSlice);
				expect(zedSliceObserver.next).toHaveBeenLastCalledWith(initialZedSlice);
				expect(unchangingSliceObserver.next).toHaveBeenLastCalledWith(
					initialUnchangingSlice
				);

				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(barSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(berSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(zedSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(unchangingSliceObserver.next).toHaveBeenCalledTimes(1);
			});

			it('should emit on changed nodes only', () => {
				const nextBerSlice = 'fusilli';
				const nextFooSlice = {
					...rootSlice.value.foo,
					[BER_SLICE_NAME]: nextBerSlice,
				};
				const nextRootSlice = {
					...rootSlice.value,
					[FOO_SLICE_NAME]: nextFooSlice,
				};
				rootSlice.set(nextRootSlice);

				expect(rootObserver.next).toHaveBeenLastCalledWith(nextRootSlice);
				expect(fooSliceObserver.next).toHaveBeenLastCalledWith(nextFooSlice);
				expect(barSliceObserver.next).toHaveBeenLastCalledWith(initialBarSlice);
				expect(berSliceObserver.next).toHaveBeenLastCalledWith(nextBerSlice);
				expect(zedSliceObserver.next).toHaveBeenLastCalledWith(initialZedSlice);
				expect(unchangingSliceObserver.next).toHaveBeenLastCalledWith(
					initialUnchangingSlice
				);

				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(barSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(berSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(zedSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(unchangingSliceObserver.next).toHaveBeenCalledTimes(1);
			});
		});

		describe('updating a leaf node', () => {
			it('should emit on all slices up to the root if a leaf is updated', () => {
				const nextZedSlice = initialZedSlice + 1;
				zedSlice.set(nextZedSlice);

				expect(zedSliceObserver.next).toHaveBeenLastCalledWith(nextZedSlice);

				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(barSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(berSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(zedSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(unchangingSliceObserver.next).toHaveBeenCalledTimes(1);
			});
		});

		describe('updating a non-root, non-leaf node', () => {
			it('should emit on all nodes up to the root from an updated node and on all changed nodes down, leaf changed scenario', () => {
				const nextZedSlice = initialZedSlice + 1;
				barSlice.set({ [ZED_SLICE_NAME]: nextZedSlice });

				expect(zedSliceObserver.next).toHaveBeenLastCalledWith(nextZedSlice);

				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(barSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(berSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(zedSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(unchangingSliceObserver.next).toHaveBeenCalledTimes(1);
			});

			it('should emit on all nodes up to the root from an updated node and on all changed nodes down, leaf unchanged scenario', () => {
				barSlice.set({ [ZED_SLICE_NAME]: initialZedSlice });

				expect(zedSliceObserver.next).toHaveBeenLastCalledWith(initialZedSlice);

				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(barSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(berSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(zedSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(unchangingSliceObserver.next).toHaveBeenCalledTimes(1);
			});
		});
	});

	describe('shallow optional slices', () => {
		interface ShallowRootState {
			[FOO_SLICE_NAME]: string | undefined;
		}

		let rootSlice!: RootSlice<ShallowRootState>;
		let shallowOptionalSlice!: Slice<ShallowRootState, string>;

		const initialRootSlice: ShallowRootState = {
			[FOO_SLICE_NAME]: undefined,
		};

		const rootObserver: Observer<ShallowRootState> = createMockObserver();
		const shallowOptionalSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			rootSlice = scope.createRootSlice<ShallowRootState>(initialRootSlice);
			shallowOptionalSlice = rootSlice.slice(FOO_SLICE_NAME);
			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(shallowOptionalSlice.subscribe(shallowOptionalSliceObserver));
		});

		it('should be able to be set from its parent', () => {
			const nextFoo = 'b';
			expect(shallowOptionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			rootSlice.set({ [FOO_SLICE_NAME]: nextFoo });
			expect(shallowOptionalSliceObserver.next).toHaveBeenLastCalledWith(nextFoo);
		});

		it('should be able to be set from the premade set action', () => {
			const nextFoo = 'b';
			expect(shallowOptionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			shallowOptionalSlice.set(nextFoo);
			expect(shallowOptionalSliceObserver.next).toHaveBeenLastCalledWith(nextFoo);
		});
	});

	describe('deep optional slices', () => {
		interface RootState {
			deepOptional: DeepOptionalSlice | undefined;
		}

		interface DeepOptionalSlice {
			data: string;
		}

		let rootSlice!: RootSlice<RootState>;
		let optionalSlice!: Slice<RootState, DeepOptionalSlice>;
		let optionalInnerSlice!: Slice<DeepOptionalSlice, string>;

		const definedOptionalInnerSlice = 'foo';
		const definedOptionalSlice: DeepOptionalSlice = { data: definedOptionalInnerSlice };

		let externalOptionalSliceSetAction!: Action<DeepOptionalSlice>;
		let externalOptionalInnerSliceSetAction!: Action<string>;

		const initialRootSlice: RootState = {
			deepOptional: undefined,
		};

		const rootSliceWithOptionalSlice: RootState = {
			deepOptional: definedOptionalSlice,
		};

		const rootObserver: Observer<RootState> = createMockObserver();
		const optionalSliceObserver: Observer<DeepOptionalSlice> = createMockObserver();
		const optionalInnerSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			externalOptionalSliceSetAction = scope.createAction<DeepOptionalSlice>(
				'setOptionalSliceExternal'
			);
			externalOptionalInnerSliceSetAction = scope.createAction<string>(
				'setOptionalInnerSliceExternal'
			);

			rootSlice = scope.createRootSlice(initialRootSlice);

			optionalSlice = rootSlice.slice('deepOptional', {
				reducers: [
					externalOptionalSliceSetAction.reduce((state, payload) => ({
						...state,
						...payload,
					})),
				],
			});
			optionalInnerSlice = optionalSlice.slice('data', {
				reducers: [
					externalOptionalInnerSliceSetAction.reduce((_state, payload) => payload),
				],
			});

			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(optionalSlice.subscribe(optionalSliceObserver));
			sink.add(optionalInnerSlice.subscribe(optionalInnerSliceObserver));
		});

		it('should be undefined initially', () => {
			expect(optionalSlice.value?.data).toBeUndefined();
		});

		it('should not emit if the parent was changed but the optional slice not', () => {
			expect(optionalSlice.value?.data).toBeUndefined();
		});

		it('should emit undefined if the slice becomes uninitialzed', () => {
			expect(optionalSlice.value?.data).toBeUndefined();
		});

		it('should be able to be initialized from their parent', () => {
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);

			rootSlice.set({ deepOptional: definedOptionalSlice });

			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(definedOptionalSlice);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(
				definedOptionalInnerSlice
			);
		});

		it('should be able to be initialized from the premade set action', () => {
			expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
			optionalSlice.set(definedOptionalSlice);
			expect(rootObserver.next).toHaveBeenLastCalledWith(rootSliceWithOptionalSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(definedOptionalSlice);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(
				definedOptionalInnerSlice
			);
			expect(rootObserver.next).toHaveBeenCalledTimes(2);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(2);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(2);
		});

		it('should be able to be initialized from the explicit set action', () => {
			expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
			externalOptionalSliceSetAction.next(definedOptionalSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(definedOptionalSlice);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(
				definedOptionalInnerSlice
			);
			expect(rootObserver.next).toHaveBeenCalledTimes(2);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(2);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(2);
		});

		it('should not react to reducers on slices with undefined parents', () => {
			expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
			optionalInnerSlice.set(definedOptionalInnerSlice);
			expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
		});
	});
});
