import { isNonNullable } from '../helper/non-nullable.function.js';
import type { Action } from './action.class.js';

export interface ActionPacket<Payload = unknown> {
	type: string;
	payload: Payload;
}

export type ActionPacketTuple<T> = {
	[K in keyof T]: ActionPacket<T[K]>;
};

export const isActionPacket = <P>(
	actionPacket?: unknown | undefined,
	registeredInActionMap?: Map<string, Action<unknown>>
): actionPacket is ActionPacket<P> => {
	return (
		actionPacket !== undefined &&
		isNonNullable((actionPacket as ActionPacket).type) &&
		(registeredInActionMap?.has((actionPacket as ActionPacket).type) ?? true)
	);
};
