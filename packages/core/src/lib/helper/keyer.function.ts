export type GetNext<T> = (keys: T[]) => T;
export type GetKeys<T, K> = (state: T) => K[];

export const getObjectKeys: GetKeys<Record<string | number, unknown>, string> = (
	state: Record<string | number, unknown>
): string[] => Object.keys(state);
export const getObjectKeysAsNumbers: GetKeys<Record<number, unknown>, number> = (
	state: Record<number, unknown>
): number[] => Object.keys(state).map((key) => Number.parseInt(key, 10));

export const getNextNumberLikeStringKey: GetNext<`${number}`> = (keys: `${number}`[]) =>
	(
		keys.map((key) => Number.parseInt(key, 10)).reduce((a, b) => (a > b ? a : b), 0) + 1
	).toString() as `${number}`;

export const getNextLargestNumber: GetNext<number> = (keys: number[]): number =>
	keys.reduce((a, b) => (a > b ? a : b), 0) + 1;

export const getNextSmallestNumber: GetNext<number> = (keys: number[]): number => {
	const sortedKeys = [...keys].sort((a, b) => a - b);

	for (let i = 0; i < sortedKeys.length; i++) {
		if (!sortedKeys.includes(i + 1)) {
			return i + 1;
		}
	}
	return (sortedKeys.at(-1) ?? 0) + 1;
};

export enum PremadeGetNext {
	nextLargest = 'nextlargest',
	nextSmallest = 'nextsmallest',
}

export type NextKeyStrategy = PremadeGetNext | GetNext<number>;

export const getNextKeyStrategy = (nextKeyStrategy?: NextKeyStrategy): GetNext<number> => {
	if (typeof nextKeyStrategy === 'function') {
		return nextKeyStrategy;
	} else if (nextKeyStrategy === PremadeGetNext.nextLargest) {
		return getNextLargestNumber;
	} else if (nextKeyStrategy === PremadeGetNext.nextSmallest) {
		return getNextSmallestNumber;
	} else {
		return getNextLargestNumber;
	}
};
