export interface ActionPacket<T> {
	type: string;
	payload: T;
}

export type ActionPacketTuple<T> = {
	[K in keyof T]: ActionPacket<T[K]>;
};
