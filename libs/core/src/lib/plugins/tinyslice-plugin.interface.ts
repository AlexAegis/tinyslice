import { Observable } from 'rxjs';
import { ActionPacket } from '../action';
import { ReduceActionSliceSnapshot } from '../store/reducer.type';

export interface TinySlicePluginHooks<State> {
	state$: Observable<ReduceActionSliceSnapshot<State>>;
	initialState: State;
	stateInjector: (state: State) => void;
}

export interface TinySlicePluginSliceOptions {
	passToChildren?: boolean;
}

export interface TinySlicePlugin<State> {
	/**
	 * What the slice will pass to the plugin
	 */
	register: (hooks: TinySlicePluginHooks<State>) => void;
	onError?: (error: unknown) => void;
	preRootReduce?: (absolutePath: string, state: unknown, action: ActionPacket<unknown>) => void;
	preReduce?: (absolutePath: string, state: unknown, action: ActionPacket<unknown>) => void;
	postReduce?: (absolutePath: string, snapshot: ReduceActionSliceSnapshot<unknown>) => void;
	postRootReduce?: (absolutePath: string, snapshot: ReduceActionSliceSnapshot<unknown>) => void;
	start: () => void;
	stop: () => void;
	/**
	 * What the slice will read from the plugin
	 */
	sliceOptions?: () => TinySlicePluginSliceOptions;
	/**
	 * An additional function
	 */
	registerAdditionalTrigger?: (trigger: () => void) => void;
}
