export type Select<Slice> = () => Slice;
export type Selector<State, Slice> = (state: State) => Slice;
export type DiceSelector<State, Slice, SliceKey> = (state: State, key: SliceKey) => Slice;
