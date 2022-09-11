import { Injectable } from '@angular/core';
import { CounterStore } from '../../counter-store.module';

export interface ColorState {
	color: string | undefined;
}

@Injectable()
export class ColorStore {
	slice = this.counterStore.slice.addSlice<ColorState>('color', { color: undefined });

	color$ = this.slice.slice('color');

	constructor(private readonly counterStore: CounterStore) {}
}
