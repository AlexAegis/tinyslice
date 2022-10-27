import type { ReduceActionSliceSnapshot } from '@tinyslice/core';
import {
	ActionPacket,
	TinySlicePlugin,
	TinySlicePluginHooks,
	TinySlicePluginSliceOptions,
	TINYSLICE_PREFIX,
} from '@tinyslice/core';

const brightFgColor = '#ffe36a';
const dimFgColor = '#f9c33c';

const defaultCss = `background: #222; color: ${brightFgColor};`;
const defaultCssDim = `background: #222; color: ${dimFgColor};`;
const successCss = `background: #090; color: ${brightFgColor};`;
const failCss = `background: #900; color: ${brightFgColor};`;
const normalCss = 'background: #222; color: #fff;';
const hiddenCss = 'background: #222; color: #444;';

const isSuccessMessage = (message: string): boolean => message.toLowerCase().includes('success');
const isFailureMessage = (message: string): boolean => message.toLowerCase().includes('fail');
const isErrorMessage = (message: string): boolean => message.toLowerCase().includes('error');

const isTinySliceMessage = (message: string): boolean => message.includes(TINYSLICE_PREFIX);

const getMessageCss = (message: string, isInternal: boolean): string => {
	if (isSuccessMessage(message)) {
		return successCss;
	} else if (isFailureMessage(message) || isErrorMessage(message)) {
		return failCss;
	} else {
		return isInternal ? defaultCssDim : defaultCss;
	}
};

const bracketMatcher = /\[[^\]]*\]/g;

const separateMessage = (message: string): string[] => {
	const a = message.split(bracketMatcher) ?? []; // Removes delimiters
	const b = message.match(bracketMatcher) ?? []; // Removed delimiters
	const result = [a[0]];
	for (let i = 1; i < a.length; i++) {
		result.push(b[i - 1]);
		result.push(a[i]);
	}
	return result.filter((a) => !!a);
};

export const colorizeLogString = (message: string): string[] => {
	const segments = separateMessage(message);
	const codedSegments: string[] = [];
	const colorisedSegments: string[] = [];

	const isInternal = segments.some((segment) => isTinySliceMessage(segment));
	for (const segment of segments) {
		const css = getMessageCss(segment, isInternal);
		if (css) {
			codedSegments.push(`%c${segment}`);
			colorisedSegments.push(getMessageCss(segment, isInternal));
		} else {
			codedSegments.push(segment);
			colorisedSegments.push('');
		}
	}

	return ['🍕 ' + codedSegments.join(''), ...colorisedSegments];
};

export const DEFAULT_OPTIONS: LoggerPluginOptions = {
	ignorePaths: [],
	ignoreActions: [],
	disableGrouping: false,
	onlyRoot: false,
	onlyTimers: false,
};

export interface LoggerPluginOptions {
	ignorePaths: (RegExp | string)[];
	ignoreActions: (RegExp | string)[];
	disableGrouping: boolean;
	/**
	 * Will only execute the root logs
	 */
	onlyRoot: boolean;
	/**
	 * Will only print timers
	 */
	onlyTimers: boolean;
}

/**
 * This plugin lets you see changes during reduces.
 *
 * Every executed reducer is printed, ones where the state is changed are
 * printed white while unchanged ones are grey. Optimizations won't run
 * reducers where they wouldn't do anything so you'll mostly only see white
 * texts unless you have reducers that can just return the previous state
 * as is.
 *
 * It also measures each reducer how long it takes to execute and how long
 * the total action roundtrip took.
 *
 * For more accurate timing results, close the devtools panel, fire your
 * actions and then reopen to inspect. That way the cost of rendering these
 * console logs is minimal. You can also enable 'onlyTimers' and 'onlyRoot'
 * for even better results.
 */
export class TinySliceLoggerPlugin<State> implements TinySlicePlugin<State> {
	private options: LoggerPluginOptions;

	private first = false;
	private enabled = false;
	private lastTimer: string | undefined = undefined;

	private pluginOptions: TinySlicePluginSliceOptions = {
		passToChildren: true,
	};

	constructor(options?: Partial<LoggerPluginOptions>) {
		this.options = {
			...DEFAULT_OPTIONS,
			...options,
		};
	}

	private isIgnored(path: string, actionPacket: ActionPacket<unknown>): boolean {
		return (
			this.options.ignorePaths.some((pathIgnore) =>
				typeof pathIgnore === 'string'
					? path.startsWith(pathIgnore) || actionPacket.type.startsWith(pathIgnore)
					: pathIgnore.test(path)
			) ||
			this.options.ignoreActions.some((actionIgnore) =>
				typeof actionIgnore === 'string'
					? actionIgnore === actionPacket.type
					: actionIgnore.test(actionPacket.type)
			)
		);
	}

	sliceOptions(): TinySlicePluginSliceOptions {
		return this.pluginOptions;
	}

	preRootReduce(absolutePath: string, _state: unknown, action: ActionPacket<unknown>): void {
		this.first = true;
		if (this.enabled && !this.isIgnored(absolutePath, action)) {
			console.time('entire reduce took');
			if (this.options.disableGrouping) {
				console.log(...colorizeLogString(action.type));
			} else {
				console.groupCollapsed(...colorizeLogString(action.type));
			}
		}
	}

	preReduce(absolutePath: string, _state: unknown, action: ActionPacket<unknown>): void {
		if (this.enabled && !this.options.onlyRoot && !this.isIgnored(absolutePath, action)) {
			this.lastTimer = `${absolutePath} reduce took`;
			console.time(this.lastTimer);
		}
	}

	postReduce(absolutePath: string, snapshot: ReduceActionSliceSnapshot<unknown>): void {
		if (
			this.enabled &&
			!this.options.onlyRoot &&
			!this.isIgnored(absolutePath, snapshot.actionPacket)
		) {
			const changed = snapshot.prevState !== snapshot.nextState;
			const logCss = changed ? normalCss : hiddenCss;
			if (!this.options.onlyTimers) {
				if (this.options.disableGrouping) {
					console.log(`%c${absolutePath}`, logCss);
				} else {
					if (this.first) {
						this.first = false;
						console.group(`%c${absolutePath}`, logCss);
					} else {
						console.groupCollapsed(`%c${absolutePath}`, logCss);
					}
				}

				console.info('%cprevState', logCss, snapshot.prevState);
				console.info('%cpayload', logCss, snapshot.actionPacket.payload);
				console.info('%cnextState', logCss, snapshot.nextState);
			}

			console.timeEnd(`${absolutePath} reduce took`);
			if (!this.options.onlyTimers && !this.options.disableGrouping) {
				console.groupEnd();
			}
		}
	}

	postRootReduce(absolutePath: string, snapshot: ReduceActionSliceSnapshot<unknown>): void {
		if (this.enabled && !this.isIgnored(absolutePath, snapshot.actionPacket)) {
			console.timeEnd('entire reduce took');
			if (!this.options.disableGrouping) {
				console.groupEnd();
			}
		}
	}

	start(): void {
		this.enabled = true;
		return undefined;
	}

	stop(): void {
		if (!this.options.disableGrouping) {
			if (this.lastTimer) {
				console.timeEnd(this.lastTimer);
			}
			console.groupEnd();
		}
		this.enabled = false;
		return undefined;
	}

	register(_hooks: TinySlicePluginHooks<State>): void {
		return undefined;
	}
}
