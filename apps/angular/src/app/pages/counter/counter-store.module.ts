import { Injectable, NgModule } from '@angular/core';
import { Action, Scope, Slice, TinySliceModule } from '@tinyslice/ngx';
import { filter, map } from 'rxjs';

export interface CounterState {
	count: number;
}

export class CounterStore {
	static increment = new Action<number>('increment');
	static decrement = new Action<number>('decrement');

	increment = CounterStore.increment;
	decrement = CounterStore.decrement;

	count$ = this.slice.slice('count');

	constructor(public readonly slice: Slice<unknown, CounterState>) {}
}

@Injectable()
class CounterEffects {
	constructor(public readonly counterStore: CounterStore, private readonly scope: Scope) {
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
			],
			[CounterEffects],
			CounterStore
		),
	],
	exports: [TinySliceModule],
})
export class CounterStoreModule {}
