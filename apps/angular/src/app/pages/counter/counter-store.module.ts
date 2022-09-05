import { Injectable, NgModule } from '@angular/core';
import { Action, StoreScope, StoreSlice, TinySliceModule } from '@tinyslice/ngx';
import { filter, map } from 'rxjs';

export interface CounterState {
	count: number;
}

export class CounterStore {
	static increment = new Action<number>('increment');
	static decrement = new Action<number>('decrement');
	static setValue = new Action<number>('setValue');

	increment = CounterStore.increment;
	decrement = CounterStore.decrement;
	setValue = CounterStore.setValue;

	count$ = this.slice.slice('count');

	constructor(public readonly slice: StoreSlice<unknown, CounterState>) {}
}

@Injectable()
class CounterEffects {
	constructor(public readonly counterStore: CounterStore, private readonly scope: StoreScope) {
		this.scope.createEffect(
			this.counterStore.count$.pipe(
				filter((count) => count >= 10),
				map((count) => CounterStore.decrement.makePacket(count))
			)
		);
	}
}

@NgModule({
	imports: [
		TinySliceModule.forFeature<CounterState>(
			'counter',
			{
				count: 0,
			},
			[
				CounterStore.increment.reduce((state, payload) => ({
					...state,
					count: state.count + payload,
				})),
				CounterStore.decrement.reduce((state, payload) => ({
					...state,
					count: state.count - payload,
				})),
				CounterStore.setValue.reduce((state, payload) => ({
					...state,
					count: payload,
				})),
			],
			[CounterEffects],
			CounterStore
		),
	],
	exports: [TinySliceModule],
})
export class CounterStoreModule {}
