import { fromEvent, map, withLatestFrom } from 'rxjs';
import { rootSlice } from '../../root.slice';

export interface MouseMoveState {
	position: { x: number; y: number };
	listenThrottled: boolean;
}

export const mouseMoveSlice$ = rootSlice.addSlice('mousemove', {
	position: { x: 0, y: 0 },
	listenThrottled: true,
} as MouseMoveState);

export const mouseMoveActions = {
	move: mouseMoveSlice$.createAction<{ x: number; y: number }>('move', {
		throttleTime: 100,
	}),
};

export const position$ = mouseMoveSlice$.slice('position', {
	reducers: [mouseMoveActions.move.reduce((_state, payload) => payload)],
});

export const listenThrottled$ = mouseMoveSlice$.slice('listenThrottled');

export const positionPrint$ = position$.pipe(map(({ x, y }) => `x:${x}, y:${y}`));

mouseMoveSlice$.createEffect(
	fromEvent(document, 'mousemove').pipe(
		map((event) => ({
			x: (event as MouseEvent).clientX,
			y: (event as MouseEvent).clientY,
		})),
		withLatestFrom(listenThrottled$),
		map(([packet, listenThrottled]) =>
			listenThrottled
				? mouseMoveActions.move.makePacket(packet)
				: position$.setAction.makePacket(packet)
		)
	)
);
