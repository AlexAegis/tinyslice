import { ActionPacket } from '../action/action-packet.interface';
import { Action } from '../action/action.class';
import { isNullish } from '../helper';

export interface InitialSliceSnapshot<State> {
	nextState: State;
}

export type ReduceActionSliceSnapshot<State> = {
	action: ActionPacket;
	prevState: State;
	nextState: State;
};

export type SliceSnapshot<State> = InitialSliceSnapshot<State> | ReduceActionSliceSnapshot<State>;

export const isReduceActionSliceSnapshot = <State>(
	t: ReduceActionSliceSnapshot<State> | InitialSliceSnapshot<State>
): t is ReduceActionSliceSnapshot<State> =>
	!isNullish((t as ReduceActionSliceSnapshot<State>).action);

export type MetaPacketReducer<State> = (snapshot: ReduceActionSliceSnapshot<State>) => void;

export type PacketReducer<State, Payload = unknown> = (
	state: State,
	actionPacket: ActionPacket<Payload> | undefined
) => State;

export type PayloadReducer<State, Payload> = (state: State, payload: Payload) => State;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReducerConfiguration<State, Payload = any> = {
	action: Action<Payload>;
	packetReducer: PacketReducer<State, Payload>;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CancellableReducerConfiguration<State, Payload = any> = ReducerConfiguration<
	State,
	Payload
> & { reducerCanceller: () => void };
