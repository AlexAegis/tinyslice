import { isNotNullish } from '@alexaegis/common';

export const hasKey = <T>(parent: T, key: string | number | symbol | undefined): boolean => {
	return (
		isNotNullish(key) &&
		isNotNullish(parent) &&
		typeof parent === 'object' &&
		Object.hasOwn(parent, key)
	);
};
