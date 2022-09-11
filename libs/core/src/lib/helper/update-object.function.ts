export const updateObject = <T>(base: T, other: T): T => {
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
			return other;
		}
	} else {
		return base;
	}
};
