import { ActionPacket } from '../action/action-packet.interface';
import { Action } from '../action/action.class';

export type ActionReduceSnapshot<State, Payload = unknown> = {
	action: ActionPacket<Payload>;
	prevState: State;
	nextState: State;
};

export type MetaPacketReducer<State, Payload = unknown> = (
	snapshot: ActionReduceSnapshot<State, Payload>
) => void;

export type PacketReducer<State, Payload> = (
	state: State,
	actionPacket: ActionPacket<Payload> | undefined
) => State;

export type PayloadReducer<State, Payload> = (state: State, actionPacket: Payload) => State;

export type ReducerConfiguration<State, Payload> = {
	action: Action<Payload>;
	packetReducer: PacketReducer<State, Payload>;
};
