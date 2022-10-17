import { TINYSLICE_PREFIX } from '../internal/consts';
import type { MetaReducer } from '../store/reducer.type';

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

/**
 * When measuring times, do it with a closed console so rendering of the logs
 * won't be accounted
 */
export const createLoggingMetaReducer = (): MetaReducer => ({
	preRootReduce: (_absolutePath, _state, action) => {
		console.groupCollapsed(...colorizeLogString(action.type));
	},
	preReduce: (absolutePath) => {
		console.time(`${absolutePath} reduce took`);
	},
	postReduce: (absolutePath, { action, prevState, nextState }) => {
		const changed = prevState !== nextState;
		const logCss = changed ? normalCss : hiddenCss;
		if (changed) {
			console.group(`%c${absolutePath}`, logCss);
		} else {
			console.groupCollapsed(`%c${absolutePath}`, logCss);
		}

		console.info('%cprevState', logCss, prevState);
		console.info('%cpayload', logCss, action.payload);
		console.info('%cnextState', logCss, nextState);
		console.timeEnd(`${absolutePath} reduce took`);
		console.groupEnd();
	},
	postRootReduce: () => {
		console.groupEnd();
	},
});
