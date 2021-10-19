import { ActionPacket } from '../action/action-packet.interface';
import { Action } from '../action/action.class';

export type PacketReducer<State, Payload> = (
	state: State,
	actionPacket: ActionPacket<Payload>
) => State;

export type PayloadReducer<State, Payload> = (state: State, actionPacket: Payload) => State;

export type ReducerConfiguration<State, Payload> = {
	action: Action<Payload>;
	packetReducer: PacketReducer<State, Payload>;
};
