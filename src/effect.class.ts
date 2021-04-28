export interface EffectConfig {
	name?: string;
}

export const DEFAULT_EFFECT_CONFIG: EffectConfig = {
	name: 'Unnamed Effect',
};

export class Effect<T> {
	private s?: T;

	private static registered: Effect<unknown>[] = [];

	public static register<T>(effect: Effect<T>, _config: EffectConfig): void {
		Effect.registered.push(effect);
	}

	public constructor(config: EffectConfig = {}) {
		Effect.register(this, {
			...DEFAULT_EFFECT_CONFIG,
			...config,
		});
	}
}

export function RegisterEffect(config: EffectConfig = {}) {
	return function <T>(target: Effect<T>): void {
		Effect.register<T>(target, {
			...DEFAULT_EFFECT_CONFIG,
			...config,
		});
	};
}
