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
};

export interface LoggerPluginOptions {
	ignorePaths: (RegExp | string)[];
	ignoreActions: (RegExp | string)[];
	disableGrouping: boolean;
}

export class TinySliceLoggerPlugin<State> implements TinySlicePlugin<State> {
	private options: LoggerPluginOptions;

	#pluginOptions: TinySlicePluginSliceOptions = {
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
		return this.#pluginOptions;
	}

	preRootReduce(absolutePath: string, _state: unknown, action: ActionPacket<unknown>): void {
		if (!this.isIgnored(absolutePath, action)) {
			if (this.options.disableGrouping) {
				console.log(...colorizeLogString(action.type));
			} else {
				console.groupCollapsed(...colorizeLogString(action.type));
			}
		}
	}

	preReduce(absolutePath: string, _state: unknown, action: ActionPacket<unknown>): void {
		if (!this.isIgnored(absolutePath, action)) {
			console.time(`${absolutePath} reduce took`);
		}
	}

	postReduce(absolutePath: string, snapshot: ReduceActionSliceSnapshot<unknown>): void {
		if (!this.isIgnored(absolutePath, snapshot.actionPacket)) {
			const changed = snapshot.prevState !== snapshot.nextState;
			const logCss = changed ? normalCss : hiddenCss;
			if (this.options.disableGrouping) {
				console.log(`%c${absolutePath}`, logCss);
			} else {
				if (changed) {
					console.group(`%c${absolutePath}`, logCss);
				} else {
					console.groupCollapsed(`%c${absolutePath}`, logCss);
				}
			}

			console.info('%cprevState', logCss, snapshot.prevState);
			console.info('%cpayload', logCss, snapshot.actionPacket.payload);
			console.info('%cnextState', logCss, snapshot.nextState);
			console.timeEnd(`${absolutePath} reduce took`);
			if (!this.options.disableGrouping) {
				console.groupEnd();
			}
		}
	}

	postRootReduce(absolutePath: string, snapshot: ReduceActionSliceSnapshot<unknown>): void {
		if (!this.isIgnored(absolutePath, snapshot.actionPacket)) {
			if (!this.options.disableGrouping) {
				console.groupEnd();
			}
		}
	}

	start(): void {
		return undefined;
	}

	stop(): void {
		return undefined;
	}

	register(_hooks: TinySlicePluginHooks<State>): void {
		return undefined;
	}
}
