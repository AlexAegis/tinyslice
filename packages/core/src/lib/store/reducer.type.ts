import { isNotNullish } from '@alexaegis/common';
import type { ActionPacket } from '../action/action-packet.interface';
import { Action } from '../action/action.class';

export interface InitialSliceSnapshot<State> {
	nextState: State;
}

export interface ReduceActionSliceSnapshot<State> {
	actionPacket: ActionPacket;
	prevState: State;
	nextState: State;
}

export type SliceSnapshot<State> = InitialSliceSnapshot<State> | ReduceActionSliceSnapshot<State>;

export const isReduceActionSliceSnapshot = <State>(
	t: ReduceActionSliceSnapshot<State> | InitialSliceSnapshot<State>
): t is ReduceActionSliceSnapshot<State> =>
	isNotNullish((t as ReduceActionSliceSnapshot<State>).actionPacket);

export interface MetaReducer {
	preRootReduce: (absolutePath: string, state: unknown, action: ActionPacket<unknown>) => void;
	preReduce: (absolutePath: string, state: unknown, action: ActionPacket<unknown>) => void;
	postReduce: MetaSnapshotReducer;
	postRootReduce: MetaSnapshotReducer;
}

export type MetaSnapshotReducer = (
	absolutePath: string,
	snapshot: ReduceActionSliceSnapshot<unknown>
) => void;

export type PacketReducer<State, Payload = unknown> = (
	state: State,
	actionPacket: ActionPacket<Payload> | undefined
) => State;

export type PayloadReducer<State, Payload> = (state: State, payload: Payload) => State;
export type StatelessReducer<State> = () => State;
export type ActionReducer<State, Payload> =
	| PayloadReducer<State, Payload>
	| StatelessReducer<State>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ReducerConfiguration<State, Payload = any> {
	action: Action<Payload>;
	packetReducer: PacketReducer<State, Payload>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CancellableReducerConfiguration<State, Payload = any> = ReducerConfiguration<
	State,
	Payload
> & { reducerCanceller: () => void };
