import { Injectable } from '@angular/core';
import { CounterStore } from '../../counter-store.module';

export interface ColorState {
	color: string | undefined;
}

@Injectable()
export class ColorStore {
	slice = this.counterStore.slice.addSlice('color', { color: undefined } as ColorState);

	color$ = this.slice.slice('color');

	constructor(private readonly counterStore: CounterStore) {}
}
