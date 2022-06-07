import { Scope } from '@tinyslice/core';

export abstract class StoreScope<EveryStore = unknown, EveryPayload = unknown> extends Scope<
	EveryStore,
	EveryPayload
> {}
