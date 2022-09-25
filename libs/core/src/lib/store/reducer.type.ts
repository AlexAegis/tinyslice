import { ActionPacket } from '../action/action-packet.interface';
import { Action } from '../action/action.class';
import { isNullish } from '../helper';

export interface InitialSnapshot<State> {
	nextState: State;
}

export type ActionReduceSnapshot<State> = {
	action: ActionPacket;
	prevState: State;
	nextState: State;
};

export const isActionReduceSnapshot = <State>(
	t: ActionReduceSnapshot<State> | InitialSnapshot<State>
): t is ActionReduceSnapshot<State> => !isNullish((t as ActionReduceSnapshot<State>).action);

export type MetaPacketReducer<State> = (snapshot: ActionReduceSnapshot<State>) => void;

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
