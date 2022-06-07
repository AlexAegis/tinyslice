import { Store, StoreSlice } from '@tinyslice/core';

export abstract class AbstractRootStore<RootState> extends Store<RootState> {}

export abstract class AbstractFeatureStore<Slice> extends StoreSlice<unknown, Slice, unknown> {}
