import { Injectable } from '@angular/core';
import { Action } from '@tinyslice/core';
import { CounterStore } from '../../counter-store.module';

export interface ColorState {
	color: string | undefined;
}

@Injectable()
export class ColorStore {
	setColor = new Action<string>('setColor');

	slice = this.counterStore.slice.addSlice<ColorState>('color', { color: undefined }, [
		this.setColor.reduce((state, payload) => ({ ...state, color: payload })),
	]);

	color$ = this.slice.slice('color');

	constructor(private readonly counterStore: CounterStore) {
		console.log('ColorStore constructor');
	}
}
