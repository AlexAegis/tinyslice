import { Observer, Subscription } from 'rxjs';
import { Action } from '../action';
import { Scope } from './scope.class';
import { Store, StoreSlice } from './store.class';

const createMockObserver = <T>(): Observer<T> => ({
	next: jest.fn(),
	complete: jest.fn(),
	error: jest.fn(),
});

describe('store', () => {
	let sink!: Subscription;
	let scope!: Scope;

	beforeEach(() => {
		sink = new Subscription();
		scope = new Scope();
	});

	afterEach(() => jest.clearAllMocks());
	afterEach(() => sink.unsubscribe());

	describe('unsubscribe', () => {
		interface RootSlice {
			foo: FooSlice;
		}

		interface FooSlice {
			bar: string;
		}

		let rootSlice!: Store<RootSlice>;
		let fooSlice!: StoreSlice<RootSlice, FooSlice>;
		let barSlice!: StoreSlice<FooSlice, string>;

		const initialRootSlice: RootSlice = {
			foo: { bar: 'zed' },
		};

		const rootObserver: Observer<RootSlice> = createMockObserver();
		const fooSliceObserver: Observer<FooSlice> = createMockObserver();
		const barSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			rootSlice = scope.createStore<RootSlice>(initialRootSlice);

			fooSlice = rootSlice.slice('foo');
			barSlice = fooSlice.slice('bar');

			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(fooSlice.subscribe(fooSliceObserver));
			sink.add(barSlice.subscribe(barSliceObserver));
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
		});
	});
	describe('slices', () => {
		interface RootSlice {
			foo: FooSlice;
			unchanging: string;
		}

		interface FooSlice {
			bar: BarSlice;
			ber: string;
		}

		interface BarSlice {
			zed: number;
		}

		let rootSlice!: Store<RootSlice>;
		let fooSlice!: StoreSlice<RootSlice, FooSlice>;
		let barSlice!: StoreSlice<FooSlice, BarSlice>;
		let zedSlice!: StoreSlice<BarSlice, number>;
		let berSlice!: StoreSlice<FooSlice, string>;

		let unchangingSlice!: StoreSlice<RootSlice, string>;

		const initialZedSlice = 1;
		const initialBarSlice: BarSlice = { zed: initialZedSlice };
		const initialBerSlice = 'tangerine';
		const initialFooSlice: FooSlice = { bar: initialBarSlice, ber: initialBerSlice };
		const initialUnchangingSlice = 'solid';
		const initialRootSlice: RootSlice = {
			foo: initialFooSlice,
			unchanging: initialUnchangingSlice,
		};

		const rootObserver: Observer<RootSlice> = createMockObserver();
		const fooSliceObserver: Observer<FooSlice> = createMockObserver();
		const barSliceObserver: Observer<BarSlice> = createMockObserver();
		const berSliceObserver: Observer<string> = createMockObserver();
		const zedSliceObserver: Observer<number> = createMockObserver();
		const unchangingSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			rootSlice = scope.createStore<RootSlice>(initialRootSlice);

			fooSlice = rootSlice.slice('foo');
			barSlice = fooSlice.slice('bar');
			zedSlice = barSlice.slice('zed');
			berSlice = fooSlice.slice('ber');
			unchangingSlice = rootSlice.slice('unchanging');

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
					ber: nextBerSlice,
				};
				const nextRootSlice = {
					...rootSlice.value,
					foo: nextFooSlice,
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
				barSlice.set({ zed: nextZedSlice });

				expect(zedSliceObserver.next).toHaveBeenLastCalledWith(nextZedSlice);

				expect(rootObserver.next).toHaveBeenCalledTimes(2);
				expect(fooSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(barSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(berSliceObserver.next).toHaveBeenCalledTimes(1);
				expect(zedSliceObserver.next).toHaveBeenCalledTimes(2);
				expect(unchangingSliceObserver.next).toHaveBeenCalledTimes(1);
			});

			it('should emit on all nodes up to the root from an updated node and on all changed nodes down, leaf unchanged scenario', () => {
				barSlice.set({ zed: initialZedSlice });

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
		interface ShallowRootSlice {
			data: string | undefined;
		}

		let rootSlice!: Store<ShallowRootSlice>;
		let shallowOptionalSlice!: StoreSlice<ShallowRootSlice, string>;

		const initialRootSlice: ShallowRootSlice = {
			data: undefined,
		};

		const rootObserver: Observer<ShallowRootSlice> = createMockObserver();
		const shallowOptionalSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			rootSlice = scope.createStore<ShallowRootSlice>(initialRootSlice);
			shallowOptionalSlice = rootSlice.slice('data');
			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(shallowOptionalSlice.subscribe(shallowOptionalSliceObserver));
		});

		it('should be able to be set from its parent', () => {
			expect(shallowOptionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			rootSlice.set({ data: 'foo' });
			expect(shallowOptionalSliceObserver.next).toHaveBeenLastCalledWith('foo');
		});

		it('should be able to be set from the premade set action', () => {
			expect(shallowOptionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			shallowOptionalSlice.set('foo');
			expect(shallowOptionalSliceObserver.next).toHaveBeenLastCalledWith('foo');
		});
	});

	describe('deep optional slices', () => {
		interface RootSlice {
			deepOptional: DeepOptionalSlice | undefined;
		}

		interface DeepOptionalSlice {
			data: string;
		}

		let rootSlice!: Store<RootSlice>;
		let optionalSlice!: StoreSlice<RootSlice, DeepOptionalSlice>;
		let optionalInnerSlice!: StoreSlice<DeepOptionalSlice, string>;

		const definedOptionalInnerSlice = 'foo';
		const definedOptionalSlice: DeepOptionalSlice = { data: definedOptionalInnerSlice };

		let externalOptionalSliceSetAction!: Action<DeepOptionalSlice>;
		let externalOptionalInnerSliceSetAction!: Action<string>;

		const initialRootSlice: RootSlice = {
			deepOptional: undefined,
		};

		const rootSliceWithOptionalSlice: RootSlice = {
			deepOptional: definedOptionalSlice,
		};

		const rootObserver: Observer<RootSlice> = createMockObserver();
		const optionalSliceObserver: Observer<DeepOptionalSlice> = createMockObserver();
		const optionalInnerSliceObserver: Observer<string> = createMockObserver();

		beforeEach(() => {
			externalOptionalSliceSetAction = scope.createAction<DeepOptionalSlice>(
				'setOptionalSliceExternal'
			);
			externalOptionalInnerSliceSetAction = scope.createAction<string>(
				'setOptionalInnerSliceExternal'
			);

			rootSlice = scope.createStore<RootSlice>(initialRootSlice, []);

			optionalSlice = rootSlice.slice('deepOptional', [
				externalOptionalSliceSetAction.reduce((state, payload) => {
					return {
						...state,
						...payload,
					};
				}),
			]);
			optionalInnerSlice = optionalSlice.slice('data', [
				externalOptionalInnerSliceSetAction.reduce((state, payload) => {
					return payload;
				}),
			]);

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
