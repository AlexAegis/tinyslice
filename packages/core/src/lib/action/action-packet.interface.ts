import { isNotNullish } from '@alexaegis/common';
import type { Action } from './action.class.js';

export interface ActionPacket<Payload = unknown> {
	type: string;
	payload: Payload;
}

export type ActionPacketTuple<T> = {
	[K in keyof T]: ActionPacket<T[K]>;
};

export const isActionPacket = <P>(
	actionPacket?: unknown,
	registeredInActionMap?: Map<string, Action<unknown>>,
): actionPacket is ActionPacket<P> => {
	return (
		actionPacket !== undefined &&
		isNotNullish((actionPacket as ActionPacket).type) &&
		(registeredInActionMap?.has((actionPacket as ActionPacket).type) ?? true)
	);
};
