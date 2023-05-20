import { isNonNullable } from './non-nullable.function';

export const hasKey = <T>(parent: T, key: string | number | symbol | undefined): boolean => {
	return (
		isNonNullable(key) &&
		isNonNullable(parent) &&
		typeof parent === 'object' &&
		Object.hasOwn(parent, key)
	);
};
