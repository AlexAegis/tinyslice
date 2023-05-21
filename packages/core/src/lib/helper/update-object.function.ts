export const updateObject = <T, O extends T>(base: T, other: O | Partial<T>): T => {
	if (other !== undefined && other !== null) {
		if (typeof base === 'object') {
			if (Array.isArray(base)) {
				const copy = [...base];
				for (const [key, value] of (other as unknown[]).entries()) {
					if (value !== undefined) {
						copy[key] = value;
					}
				}
				return copy as T;
			} else {
				return { ...base, ...other };
			}
		} else {
			return other as O;
		}
	} else {
		return base;
	}
};
