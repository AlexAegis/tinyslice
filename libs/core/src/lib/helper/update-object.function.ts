export const updateObject = <T, O extends T>(base: T, other: O | Partial<T>): T => {
	if (other !== undefined && other !== null) {
		if (typeof base === 'object') {
			if (Array.isArray(base)) {
				const copy = [...base];
				for (const [key, value] of (other as Array<unknown>).entries()) {
					if (value !== undefined) {
						copy[key] = value;
					}
				}
				return copy as T;
			} else {
				return { ...base, ...other };
			}
		} else {
			return base;
		}
	} else {
		return base;
	}
};
