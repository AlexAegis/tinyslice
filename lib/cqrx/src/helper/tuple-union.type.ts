/**
 * Union type of a tuple
 * Union<[number, string]> === number | string
 */
export type TupleUnion<T extends unknown[]> = T[number];
