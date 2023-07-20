import type { Observable } from 'rxjs';
import type { ActionPacket } from '../action/index.js';
import type { ReduceActionSliceSnapshot } from '../store/reducer.type.js';

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
	preRootReduce?: (absolutePath: string, state: unknown, action: ActionPacket) => void;
	preReduce?: (absolutePath: string, state: unknown, action: ActionPacket) => void;
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
