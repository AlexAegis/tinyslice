import { ActionReducer } from '../store';

export const entitySliceReducerWithPrecompute = <
	State extends Record<Key, Entity>,
	Key extends keyof State,
	Entity extends State[Key],
	Payload,
	Precomputed
>(
	precompute: (state: State, payload: Payload) => Precomputed,
	entityReducer: (
		key: Key,
		entity: Entity,
		payload: Payload,
		precomputed: Precomputed
	) => Entity | undefined
): ActionReducer<State, Payload> => {
	return (state, payload) => {
		const precomputed = precompute(state, payload);
		return (Object.entries<Entity>(state) as [Key, Entity][]).reduce((acc, [key, tile]) => {
			acc[key] = entityReducer(key, tile, payload, precomputed) ?? tile;
			return acc;
		}, {} as State);
	};
};

export const entitySliceReducer = <
	State extends Record<Key, Entity>,
	Key extends keyof State,
	Entity extends State[Key],
	Payload
>(
	entityReducer: (key: Key, entity: Entity, payload: Payload) => Entity | undefined
): ActionReducer<State, Payload> => {
	return (state, payload) =>
		(Object.entries<Entity>(state) as [Key, Entity][]).reduce((acc, [key, tile]) => {
			acc[key] = entityReducer(key, tile, payload) ?? tile;
			return acc;
		}, {} as State);
};
