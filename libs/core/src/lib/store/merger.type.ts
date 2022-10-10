/**
 * A merger should create a new instance of a slice with the subslice being replaced
 * @default (slice, subSlice) => ({...slice, subSlice})
 */
export type Merge<Slice, SubSlice> = (subSlice: SubSlice) => Slice;
export type Merger<Slice, SubSlice> = (slice: Slice, subSlice: SubSlice) => Slice;
export type DiceMerger<Slice, SubSlice, SliceKey> = (
	state: Slice,
	subSlice: SubSlice,
	key: SliceKey
) => Slice;
