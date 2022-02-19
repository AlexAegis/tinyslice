export type Wrapper<Slice, State> = (slice: Slice) => Partial<State>;
