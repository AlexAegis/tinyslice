export const getObjectKeys = <T>(state: Record<string | number, T>): string[] => Object.keys(state);
export const getObjectKeysAsNumbers = <T>(state: Record<number, T>): number[] =>
	Object.keys(state).map((key) => parseInt(key, 10));

export const getNextNumberLikeStringKey = (keys: `${number}`[]) =>
	(keys.map((key) => parseInt(key, 10)).reduce((a, b) => (a > b ? a : b), 0) + 1).toString();

export const getNextLargestNumber = (keys: number[]): number =>
	keys.reduce((a, b) => (a > b ? a : b), 0) + 1;

export const getNextSmallestNumber = (keys: number[]): number => {
	const sortedKeys = [...keys].sort((a, b) => a - b);

	for (let i = 0; i < sortedKeys.length; i++) {
		if (!sortedKeys.includes(i + 1)) {
			return i + 1;
		}
	}
	return sortedKeys[sortedKeys.length - 1] + 1;
};
