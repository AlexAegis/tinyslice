export type Selector<State, Slice> = (state: State) => Slice;
export type Select<Slice> = () => Slice;
