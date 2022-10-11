import { TINYSLICE_ACTION_PREFIX } from '../internal/consts';
import type { MetaPacketReducer } from '../store/reducer.type';

const brightFgColor = '#ffe36a';
const dimFgColor = '#f9c33c';

const defaultCss = `background: #222; color: ${brightFgColor};`;
const defaultCssDim = `background: #222; color: ${dimFgColor};`;
const successCss = `background: #090; color: ${brightFgColor};`;
const failCss = `background: #900; color: ${brightFgColor};`;

const isSuccessMessage = (message: string): boolean => message.toLowerCase().includes('success');
const isFailureMessage = (message: string): boolean => message.toLowerCase().includes('fail');
const isErrorMessage = (message: string): boolean => message.toLowerCase().includes('error');

const isTinySliceMessage = (message: string): boolean => message.includes(TINYSLICE_ACTION_PREFIX);

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

export const createLoggingMetaReducer =
	<State>(): MetaPacketReducer<State> =>
	({ action, prevState, nextState }) => {
		console.groupCollapsed(...colorizeLogString(action.type));
		console.log('prevState', prevState);
		console.log('payload', action.payload);
		console.log('nextState', nextState);
		console.groupEnd();
	};
