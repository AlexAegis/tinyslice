import type { Action } from './action.class';

export interface ActionPacket<Payload = unknown> {
	type: string;
	payload: Payload;
}

export type ActionPacketTuple<T> = {
	[K in keyof T]: ActionPacket<T[K]>;
};

export const isActionPacket = <P>(
	actionPacket: unknown,
	registeredInActionMap?: Map<string, Action<unknown>>
): actionPacket is ActionPacket<P> => {
	return (
		(actionPacket as ActionPacket).type !== undefined &&
		(registeredInActionMap?.has((actionPacket as ActionPacket).type) ?? true)
	);
};
