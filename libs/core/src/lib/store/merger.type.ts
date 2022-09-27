/**
 * A merger should create a new instance of a slice with the subslice being replaced
 * @default (slice, subSlice) => ({...slice, subSlice})
 */
export type Merger<Slice, SubSlice> = (slice: Slice, subSlice: SubSlice) => Slice;

export type Merge<Slice, SubSlice> = (subSlice: SubSlice) => Slice;
