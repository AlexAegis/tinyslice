import type { Action } from './action.class';

export interface ActionPacket<Payload = unknown> {
	type: string;
	payload: Payload;
}

export type ActionPacketTuple<T> = {
	[K in keyof T]: ActionPacket<T[K]>;
};

export const isActionPacket = <P>(
	t: unknown,
	actionMap: Map<string, Action<unknown>>
): t is ActionPacket<P> => {
	return (
		(t as ActionPacket).type !== undefined &&
		(t as ActionPacket).payload !== undefined &&
		actionMap.has((t as ActionPacket).type)
	);
};
