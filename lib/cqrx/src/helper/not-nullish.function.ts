export const notNullish = <T>(o: T | undefined | null): o is T => o !== undefined && o !== null;
