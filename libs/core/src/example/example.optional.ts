import { Scope } from '../lib/store';

const scope = new Scope();

scope.schedulingDispatcher$.subscribe((a) => console.log('action: ' + JSON.stringify(a)));
export interface RootStore {
	optional: OptionalInnerSlice | undefined;
	nonOptional: string;
}

export interface OptionalInnerSlice {
	data: string;
}
const setNonOptional = scope.createAction<string>('set nonopt');

const rootStore = scope.createRootSlice(
	{
		optional: undefined,
		nonOptional: 'foo',
	} as RootStore,
	{
		reducers: [setNonOptional.reduce((state, payload) => ({ ...state, nonOptional: payload }))],
		defineInternals: (_slice) => {
			return 1;
		},
	}
);

rootStore.subscribe((state) => console.log('--root', JSON.stringify(state)));

const optionalSlice = rootStore.slice('optional', {
	reducers: [setNonOptional.reduce((state, _payload) => ({ ...state }))],
});
optionalSlice.subscribe((state) => console.log('--optionalSlice', JSON.stringify(state)));

const setDataAction = scope.createAction<string>('set data');

const optionalSliceData = optionalSlice.slice('data', {
	reducers: [setDataAction.reduce((_state, payload) => payload)],
});
optionalSliceData.subscribe((state) => console.log('--optionalSliceData', JSON.stringify(state)));

setNonOptional.next('bar');
optionalSlice.set({ data: 'lazy Init' });

rootStore.set({ optional: { data: 'lazy from root' }, nonOptional: 'bar' });
