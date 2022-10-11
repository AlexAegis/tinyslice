import { filter, map } from 'rxjs';
import { rootSlice, scope } from '../../root.slice';

export interface UselessState {
	isOn: boolean;
}

export const uselessSlice$ = rootSlice.addSlice('useless', {
	isOn: false,
} as UselessState);

export const isOn$ = uselessSlice$.slice('isOn');

// This piece of state should immediately turn itself off!
scope.createEffect(
	isOn$.pipe(
		filter((isOn) => isOn),
		map(() => isOn$.setAction.makePacket(false))
	)
);
