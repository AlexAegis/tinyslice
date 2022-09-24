import { Observer, Subscription } from 'rxjs';
import { Action } from '../action';
import { Scope } from './scope.class';
import { Store, StoreSlice } from './store.class';

export interface RootState {
	optional: OptionalSlice | undefined;
}

export interface OptionalSlice {
	inner: string;
}

describe('Store', () => {
	let scope!: Scope;

	let rootStore!: Store<RootState>;
	let optionalSlice!: StoreSlice<RootState, OptionalSlice>;
	let optionalInnerSlice!: StoreSlice<OptionalSlice, string>;

	const definedOptionalInnerSlice = 'foo';
	const definedOptionalSlice: OptionalSlice = { inner: definedOptionalInnerSlice };

	let externalOptionalSliceSetAction!: Action<OptionalSlice>;
	let externalOptionalInnerSliceSetAction!: Action<string>;

	let sink!: Subscription;

	const initialRootState: RootState = {
		optional: undefined,
	};

	const rootObserver: Observer<RootState> = {
		next: jest.fn(),
		complete: jest.fn(),
		error: jest.fn(),
	};

	const optionalSliceObserver: Observer<OptionalSlice> = {
		next: jest.fn(),
		complete: jest.fn(),
		error: jest.fn(),
	};

	const optionalInnerSliceObserver: Observer<string> = {
		next: jest.fn(),
		complete: jest.fn(),
		error: jest.fn(),
	};

	beforeEach(() => {
		sink = new Subscription();

		scope = new Scope();

		externalOptionalSliceSetAction = scope.createAction<OptionalSlice>(
			'setOptionalSliceExternal'
		);
		externalOptionalInnerSliceSetAction = scope.createAction<string>(
			'setOptionalInnerSliceExternal'
		);

		rootStore = scope.createStore<RootState>(initialRootState);
		optionalSlice = rootStore.slice('optional', [
			externalOptionalSliceSetAction.reduce((state, payload) => {
				// ??????????
				expect(state).toBeDefined();
				return {
					...state,
					...payload,
				};
			}),
		]);
		optionalInnerSlice = optionalSlice.slice('inner', [
			externalOptionalInnerSliceSetAction.reduce((state, payload) => {
				// ??????????
				expect(state).toBeDefined();
				return payload;
			}),
		]);

		sink.add(rootStore.subscribe(rootObserver));
		sink.add(optionalSlice.subscribe(optionalSliceObserver));
		sink.add(optionalInnerSlice.subscribe(optionalInnerSliceObserver));
	});

	afterEach(() => jest.clearAllMocks());
	afterEach(() => sink.unsubscribe());

	it('should emit the initial state immediately', () => {
		expect(rootObserver.next).toHaveBeenLastCalledWith(initialRootState);

		expect(rootObserver.next).toHaveBeenCalledTimes(1);
		expect(rootObserver.error).toHaveBeenCalledTimes(0);
		expect(rootObserver.complete).toHaveBeenCalledTimes(0);
	});

	it('should complete all subscribers if the root store is shut down', () => {
		rootStore.unsubscribe();
		expect(rootObserver.next).toHaveBeenCalledTimes(1);
		expect(rootObserver.error).toHaveBeenCalledTimes(0);
		expect(rootObserver.complete).toHaveBeenCalledTimes(1);

		expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
		expect(optionalSliceObserver.error).toHaveBeenCalledTimes(0);
		expect(optionalSliceObserver.complete).toHaveBeenCalledTimes(1);

		expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
		expect(optionalInnerSliceObserver.error).toHaveBeenCalledTimes(0);
		expect(optionalInnerSliceObserver.complete).toHaveBeenCalledTimes(1);
	});

	it('should complete all child slices if the slice is unsubscribed but not the parent', () => {
		optionalSlice.unsubscribe();
		expect(rootObserver.next).toHaveBeenCalledTimes(1);
		expect(rootObserver.error).toHaveBeenCalledTimes(0);
		expect(rootObserver.complete).toHaveBeenCalledTimes(0);

		expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
		expect(optionalSliceObserver.error).toHaveBeenCalledTimes(0);
		expect(optionalSliceObserver.complete).toHaveBeenCalledTimes(1);

		expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
		expect(optionalInnerSliceObserver.error).toHaveBeenCalledTimes(0);
		expect(optionalInnerSliceObserver.complete).toHaveBeenCalledTimes(1);
	});

	it('should complete the leaf slices if the slice is unsubscribed but not the parents', () => {
		optionalInnerSlice.unsubscribe();
		expect(rootObserver.next).toHaveBeenCalledTimes(1);
		expect(rootObserver.error).toHaveBeenCalledTimes(0);
		expect(rootObserver.complete).toHaveBeenCalledTimes(0);

		expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
		expect(optionalSliceObserver.error).toHaveBeenCalledTimes(0);
		expect(optionalSliceObserver.complete).toHaveBeenCalledTimes(0);

		expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
		expect(optionalInnerSliceObserver.error).toHaveBeenCalledTimes(0);
		expect(optionalInnerSliceObserver.complete).toHaveBeenCalledTimes(1);
	});

	describe('Optional Slices', () => {
		it('should be undefined initially', () => {
			expect(optionalSlice.value?.inner).toBeUndefined();
		});

		it('should not emit if the parent was changed but the optional slice not', () => {
			expect(optionalSlice.value?.inner).toBeUndefined();
		});

		it('should emit undefined if the slice becomes uninitialzed', () => {
			expect(optionalSlice.value?.inner).toBeUndefined();
		});

		it('should be able to be initialized from their parent', () => {
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);

			rootStore.set({ optional: definedOptionalSlice });

			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(definedOptionalSlice);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(
				definedOptionalInnerSlice
			);
		});

		it('should be able to be initialized from the premade set action', () => {
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			optionalSlice.set(definedOptionalSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(definedOptionalSlice);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(
				definedOptionalInnerSlice
			);
		});

		it('should be able to be initialized from the explicit set action', () => {
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			externalOptionalSliceSetAction.next(definedOptionalSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(definedOptionalSlice);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(
				definedOptionalInnerSlice
			);
		});

		it('should not react to reducers on slices with undefined parents', () => {
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
			optionalInnerSlice.set(definedOptionalInnerSlice);
			expect(optionalSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalInnerSliceObserver.next).toHaveBeenLastCalledWith(undefined);
			expect(optionalSliceObserver.next).toHaveBeenCalledTimes(1);
			expect(optionalInnerSliceObserver.next).toHaveBeenCalledTimes(1);
		});
	});
});
