export interface EffectConfig {
	name?: string;
	logErrors?: boolean;
}

export const DEFAULT_EFFECT_CONFIG: EffectConfig = {
	name: 'Unnamed Effect',
	logErrors: true,
};
