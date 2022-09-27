import { Observable } from 'rxjs';
import { ReduceActionSliceSnapshot } from './reducer.type';

export interface TinySlicePluginHooks<State> {
	state$: Observable<ReduceActionSliceSnapshot<State>>;
	initialState: State;
	stateInjector: (state: State) => void;
}

export interface TinySlicePlugin<State> {
	register: (hooks: TinySlicePluginHooks<State>) => void;
	onError?: (error: unknown) => void;
	start: () => void;
	stop: () => void;
	registerAdditionalTrigger?: (trigger: () => void) => void;
}
