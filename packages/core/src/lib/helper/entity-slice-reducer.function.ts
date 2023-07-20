import type { ActionReducer } from '../store/index.js';

export const entitySliceReducerWithPrecompute = <
	State extends Record<Key, Entity>,
	Key extends keyof State,
	Entity extends State[Key],
	Payload,
	Precomputed,
>(
	precompute: (state: State, payload: Payload) => Precomputed,
	entityReducer: (
		key: Key,
		entity: Entity,
		payload: Payload,
		precomputed: Precomputed,
	) => Entity | undefined,
): ActionReducer<State, Payload> => {
	return (state, payload) => {
		const precomputed = precompute(state, payload);
		// todo use mapRecord
		// const b = Object.fromEntries<Entity>(
		// 	(Object.entries<Entity>(state) as [Key, Entity][]).map<[Key, Entity]>(([key, tile]) => {
		// 		return [key, entityReducer(key, tile, payload, precomputed) ?? tile];
		// 	})
		// );
		// return b as State;
		return (Object.entries<Entity>(state) as [Key, Entity][]).reduce<State>(
			(acc, [key, tile]) => {
				acc[key] = entityReducer(key, tile, payload, precomputed) ?? tile;
				return acc;
			},
			// eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
			{} as State,
		);
	};
};

export const entitySliceReducer = <
	State extends Record<Key, Entity>,
	Key extends keyof State,
	Entity extends State[Key],
	Payload,
>(
	entityReducer: (key: Key, entity: Entity, payload: Payload) => Entity | undefined,
): ActionReducer<State, Payload> => {
	return (state, payload) =>
		(Object.entries<Entity>(state) as [Key, Entity][]).reduce<State>(
			(acc, [key, tile]) => {
				acc[key] = entityReducer(key, tile, payload) ?? tile;
				return acc;
			},
			// eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
			{} as State,
		);
};
