import { Subject, Subscription, finalize, map, tap, type Observer } from 'rxjs';
import type { SpyInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Action } from '../action/index.js';
import { Scope } from './scope.class.js';
import { Slice, type RootSlice } from './slice.class.js';

const createMockObserver = <T>(): Observer<T> => ({
	next: vi.fn(),
	complete: vi.fn(),
	error: vi.fn(),
});

function timeout(ms: number): Promise<unknown> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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

	afterEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => sink.unsubscribe());

	describe('effects', () => {
		interface RootState {
			foo: FooState;
		}

		interface FooState {
			bar: number;
			bor: string;
		}

		let rootSlice!: RootSlice<RootState>;
		let fooSlice!: Slice<RootState, FooState>;
		let barSlice!: Slice<FooState, number>;
		let borSlice!: Slice<FooState, string>;

		const initialRootSlice: RootState = {
			[FOO_SLICE_NAME]: {
				[BAR_SLICE_NAME]: 0,
				[BOR_SLICE_NAME]: YON_SLICE_NAME,
			},
		};

		const rootObserver: Observer<RootState> = createMockObserver();
		const fooSliceObserver: Observer<FooState> = createMockObserver();
		const barSliceObserver: Observer<number> = createMockObserver();
		const borSliceObserver: Observer<string> = createMockObserver();

		const rootPauseObserver: Observer<boolean> = createMockObserver();
		const fooSlicePauseObserver: Observer<boolean> = createMockObserver();
		const barSlicePauseObserver: Observer<boolean> = createMockObserver();
		const borSlicePauseObserver: Observer<boolean> = createMockObserver();

		let effectSource: Subject<number>;

		const rootScopeEffectObserver: Observer<number> = createMockObserver();
		const fooScopeEffectObserver: Observer<number> = createMockObserver();
		const barScopeEffectObserver: Observer<number> = createMockObserver();
		const borScopeEffectObserver: Observer<number> = createMockObserver();

		const rootReducerSpy = vi.fn<[RootState, unknown], RootState>((state, _action) => state);
		const fooReducerSpy = vi.fn<[FooState, unknown], FooState>((state, _action) => state);
		const barReducerSpy = vi.fn<[number, unknown], number>((state, _action) => state);
		const borReducerSpy = vi.fn<[string, unknown], string>((state, _action) => state);

		let testAction: Action<number>;
		let auxillaryTestAction: Action<number>;
		const barAuxillaryReducerSpy = vi.fn<[number, number], number>((_state, action) => action);

		beforeEach(() => {
			effectSource = new Subject<number>();
			testAction = scope.createAction<number>('test');
			auxillaryTestAction = scope.createAction<number>('auxillary');

			rootSlice = scope.createRootSlice(initialRootSlice, {
				reducers: [testAction.reduce(rootReducerSpy)],
			});
			fooSlice = rootSlice.slice(FOO_SLICE_NAME, {
				reducers: [testAction.reduce(fooReducerSpy)],
			});
			barSlice = fooSlice.slice(BAR_SLICE_NAME, {
				reducers: [
					testAction.reduce(barReducerSpy),
					auxillaryTestAction.reduce(barAuxillaryReducerSpy),
				],
			});
			borSlice = fooSlice.slice(BOR_SLICE_NAME, {
				reducers: [testAction.reduce(borReducerSpy)],
			});

			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(fooSlice.subscribe(fooSliceObserver));
			sink.add(barSlice.subscribe(barSliceObserver));
			sink.add(borSlice.subscribe(borSliceObserver));

			sink.add(rootSlice.paused$.subscribe(rootPauseObserver));
			sink.add(fooSlice.paused$.subscribe(fooSlicePauseObserver));
			sink.add(barSlice.paused$.subscribe(barSlicePauseObserver));
			sink.add(borSlice.paused$.subscribe(borSlicePauseObserver));

			scope.createEffect(
				auxillaryTestAction.pipe(
					map((payload) => auxillaryTestAction.makePacket(payload + 1))
				)
			);

			rootSlice.createEffect(
				effectSource.pipe(
					tap(rootScopeEffectObserver.next),
					finalize(rootScopeEffectObserver.complete),
					map((n) => testAction.makePacket(n))
				)
			);

			fooSlice.createEffect(
				effectSource.pipe(
					tap(fooScopeEffectObserver.next),
					finalize(fooScopeEffectObserver.complete),
					map((n) => testAction.makePacket(n))
				)
			);

			barSlice.createEffect(
				effectSource.pipe(
					tap(barScopeEffectObserver.next),
					finalize(barScopeEffectObserver.complete),
					map((n) => testAction.makePacket(n))
				)
			);

			borSlice.createEffect(
				effectSource.pipe(
					tap(borScopeEffectObserver.next),
					finalize(borScopeEffectObserver.complete),
					map((n) => testAction.makePacket(n))
				)
			);
		});

		it('should make sure packets returned always reduce after source actions are reduced', async () => {
			expect(barSliceObserver.next).toHaveBeenNthCalledWith(1, 0);
			auxillaryTestAction.next(1);
			expect(barSliceObserver.next).toHaveBeenNthCalledWith(2, 1);
			await timeout(0);
			expect(barSliceObserver.next).toHaveBeenNthCalledWith(3, 2);
		});

		describe('pausing', () => {
			it('should pause all child slices, but not parents', () => {
				fooSlice.pause();

				expect(rootPauseObserver.next).toHaveBeenCalledTimes(1);
				expect(fooSlicePauseObserver.next).toHaveBeenCalledTimes(2);
				expect(barSlicePauseObserver.next).toHaveBeenCalledTimes(2);
				expect(borSlicePauseObserver.next).toHaveBeenCalledTimes(2);

				expect(rootPauseObserver.next).toHaveBeenLastCalledWith(false);
				expect(fooSlicePauseObserver.next).toHaveBeenLastCalledWith(true);
				expect(barSlicePauseObserver.next).toHaveBeenLastCalledWith(true);
				expect(borSlicePauseObserver.next).toHaveBeenLastCalledWith(true);

				barSlice.unpause();

				expect(rootPauseObserver.next).toHaveBeenCalledTimes(1);
				expect(fooSlicePauseObserver.next).toHaveBeenCalledTimes(2);
				expect(barSlicePauseObserver.next).toHaveBeenCalledTimes(3);
				expect(borSlicePauseObserver.next).toHaveBeenCalledTimes(2);

				expect(rootPauseObserver.next).toHaveBeenLastCalledWith(false);
				expect(fooSlicePauseObserver.next).toHaveBeenLastCalledWith(true);
				expect(barSlicePauseObserver.next).toHaveBeenLastCalledWith(false);
				expect(borSlicePauseObserver.next).toHaveBeenLastCalledWith(true);

				rootSlice.unpause();

				expect(rootPauseObserver.next).toHaveBeenCalledTimes(1);
				expect(fooSlicePauseObserver.next).toHaveBeenCalledTimes(3);
				expect(barSlicePauseObserver.next).toHaveBeenCalledTimes(3);
				expect(borSlicePauseObserver.next).toHaveBeenCalledTimes(3);

				expect(rootPauseObserver.next).toHaveBeenLastCalledWith(false);
				expect(fooSlicePauseObserver.next).toHaveBeenLastCalledWith(false);
				expect(barSlicePauseObserver.next).toHaveBeenLastCalledWith(false);
				expect(borSlicePauseObserver.next).toHaveBeenLastCalledWith(false);
			});

			it('should unsubscribe from scoped effects and resubscribe on unpause', () => {
				effectSource.next(0);

				expect(rootScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(fooScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(barScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(borScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(rootScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(fooScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(barScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(borScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(rootScopeEffectObserver.complete).toHaveBeenCalledTimes(0);
				expect(fooScopeEffectObserver.complete).toHaveBeenCalledTimes(0);
				expect(barScopeEffectObserver.complete).toHaveBeenCalledTimes(0);
				expect(borScopeEffectObserver.complete).toHaveBeenCalledTimes(0);

				fooSlice.pause();
				effectSource.next(1);

				expect(rootScopeEffectObserver.next).toHaveBeenCalledTimes(2);
				expect(fooScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(barScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(borScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(rootScopeEffectObserver.next).toHaveBeenLastCalledWith(1);
				expect(fooScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(barScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(borScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(rootScopeEffectObserver.complete).toHaveBeenCalledTimes(0);
				expect(fooScopeEffectObserver.complete).toHaveBeenCalledTimes(1);
				expect(barScopeEffectObserver.complete).toHaveBeenCalledTimes(1);
				expect(borScopeEffectObserver.complete).toHaveBeenCalledTimes(1);

				barSlice.unpause();
				effectSource.next(2);

				expect(rootScopeEffectObserver.next).toHaveBeenCalledTimes(3);
				expect(fooScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(barScopeEffectObserver.next).toHaveBeenCalledTimes(2);
				expect(borScopeEffectObserver.next).toHaveBeenCalledTimes(1);
				expect(rootScopeEffectObserver.next).toHaveBeenLastCalledWith(2);
				expect(fooScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(barScopeEffectObserver.next).toHaveBeenLastCalledWith(2);
				expect(borScopeEffectObserver.next).toHaveBeenLastCalledWith(0);
				expect(rootScopeEffectObserver.complete).toHaveBeenCalledTimes(0);
				expect(fooScopeEffectObserver.complete).toHaveBeenCalledTimes(1);
				expect(barScopeEffectObserver.complete).toHaveBeenCalledTimes(1);
				expect(borScopeEffectObserver.complete).toHaveBeenCalledTimes(1);
			});
		});
	});

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
			rootSlice = scope.createRootSlice(initialRootSlice);

			fooSlice = rootSlice.slice(FOO_SLICE_NAME);
			barSlice = fooSlice.slice(BAR_SLICE_NAME);
			borSlice = fooSlice.slice(BOR_SLICE_NAME);

			sink.add(rootSlice.subscribe(rootObserver));
			sink.add(fooSlice.subscribe(fooSliceObserver));
			sink.add(barSlice.subscribe(barSliceObserver));
			sink.add(borSlice.subscribe(borSliceObserver));
		});

		it('should unsubscribe scoped effects', () => {
			const action = scope.createAction('test');
			const effectSubscription = borSlice.createEffect(action);
			borSlice.complete();
			expect(effectSubscription.closed).toBeTruthy();
		});

		it('should complete scoped actions', () => {
			const action = borSlice.createAction('test');
			const actionCompleteSpy = vi.spyOn(action, 'complete');
			borSlice.complete();
			expect(actionCompleteSpy).toBeCalled();
		});

		it('should complete all subscribers if the root store is shut down', () => {
			rootSlice.complete();
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
			fooSlice.complete();
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
			barSlice.complete();
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

		it('should not complete when the states key gets removed from the parent (unless it is droppable)', () => {
			fooSlice.set({ bar: 'test' } as FooState); // bor is missing
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
			expect(borSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(borSliceObserver.error).toHaveBeenCalledTimes(0);
			expect(borSliceObserver.complete).toHaveBeenCalledTimes(0);

			// Associated actions are also not closed
			expect(borSlice.setAction.closed).toBeFalsy();
			// Parent actions are not closed
			expect(fooSlice.setAction.closed).toBeFalsy();
			// The scopes dispatcher is not
			expect(scope.closed).toBeFalsy();
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
			rootSlice = scope.createRootSlice(initialRootSlice);

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

		let testAction!: Action;

		const reducerSpy = vi.fn<[string, string], unknown>();

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
			testAction.next();
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(6, BAR_SLICE_NAME, 'b');
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(7, BAR_SLICE_NAME, 'a');
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(8, FOO_SLICE_NAME, 'a');
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(9, FOO_SLICE_NAME, 'b');
			expect(reducerSpy).toHaveBeenNthCalledWith<[string, string]>(10, ROOT_SLICE_NAME, 'a');
		});

		describe('pausing', () => {
			it('should not execute any reducers in paused slices', async () => {
				testAction.next();
				expect(reducerSpy).toHaveBeenCalledTimes(5);
				fooSlice.pause();
				testAction.next();
				expect(reducerSpy).toHaveBeenCalledTimes(6);
				fooSlice.unpause();
				testAction.next();
				await timeout(0);
				expect(reducerSpy).toHaveBeenCalledTimes(11);
			});
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

		let errorTestAction: Action;
		const testError = new Error('error from test action');

		const rootObserver: Observer<RootState> = createMockObserver();

		let consoleErrorSpy: SpyInstance;

		beforeEach(() => {
			errorTestAction = scope.createAction('error test action');
			rootSlice = scope.createRootSlice(initialRootSlice, {
				reducers: [
					errorTestAction.reduce((_state) => {
						throw testError;
					}),
				],
			});

			consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

			sink.add(rootSlice.subscribe(rootObserver));
		});

		it('should forward the errors from reducers to the console', () => {
			errorTestAction.next();
			expect(rootObserver.next).toHaveBeenCalledTimes(1); // Initial emit
			expect(rootObserver.error).toHaveBeenCalledTimes(0); // No error surfaced
			expect(rootObserver.complete).toHaveBeenCalledTimes(0);

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.anything(), testError);
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
			rootSlice = scope.createRootSlice(initialRootSlice);

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
			rootSlice = scope.createRootSlice(initialRootSlice);
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

		const definedRootSlice: RootState = {
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
			expect(optionalSlice.value).toBeUndefined();
		});

		it.todo('should not emit if the parent was changed but the optional slice not', () => {
			expect(optionalSlice.value).toBeUndefined();
		});

		it.todo('should emit undefined if the slice becomes uninitialzed', () => {
			expect(optionalSlice.value).toBeUndefined();
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
			expect(rootObserver.next).toHaveBeenLastCalledWith(definedRootSlice);
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

		it('should be able to be uninitialized by setting it to undefined, then initialize it again', () => {
			expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(rootObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);

			rootSlice.set(definedRootSlice);
			expect(rootObserver.next).toHaveBeenLastCalledWith(definedRootSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(definedOptionalSlice);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(
				definedOptionalInnerSlice
			);
			expect(rootObserver.next).toHaveBeenCalledTimes(2);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(2);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(2);

			rootSlice.set(initialRootSlice);
			expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(
				definedOptionalInnerSlice
			); // does not emit again
			expect(rootObserver.next).toHaveBeenCalledTimes(3);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(3);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(2);

			rootSlice.set({ deepOptional: { data: 'fefe' } });
			expect(rootObserver.next).toHaveBeenLastCalledWith({ deepOptional: { data: 'fefe' } });
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith({ data: 'fefe' });
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith('fefe');
			expect(rootObserver.next).toHaveBeenCalledTimes(4);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(4);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(3);
		});
	});
});
