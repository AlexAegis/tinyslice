export type Comparator<T> = (a: T, b: T) => boolean;

export const includesArrayComparator = <T>(prev: T[], next: T[]) =>
	prev.every((slice) => next.includes(slice));

export const fastArrayComparator = <T>(prev: T[], next: T[]) => {
	if (prev.length !== next.length) {
		return false;
	} else if (next.length === 0) {
		return true;
	} else {
		for (let i = 0; i <= next.length; i++) {
			if (prev[i] !== next[i]) {
				return false;
			}
		}
		return true;
	}
};
