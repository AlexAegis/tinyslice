import { Observable } from 'rxjs';

export interface ActionConfig {
	/**
	 * Defining this adds a throttleTime operator to the actions dispatcher
	 * pipeline with start and end emits enabled. You will always get the first
	 * and the last emit of a throttled timeframe if there is one.
	 *
	 * ```ts
	 * 	throttleTime(this.config.throttleTime, asyncScheduler, {
	 * 			leading: true,
	 * 			trailing: true,
	 * 	)
	 * ```
	 */
	throttleTime?: number | undefined;
	pauseWhile?: Observable<boolean> | undefined;
}

export const DEFAULT_ACTION_CONFIG: ActionConfig = {
	throttleTime: undefined,
};
