import { Injectable, NgModule } from '@angular/core';
import { TinySliceDevtoolPlugin } from '@tinyslice/devtools-plugin';
import { Action, Store, TinySliceModule } from '@tinyslice/ngx';

export interface RootState {
	count: number;
}

@Injectable()
export class RootStore {
	static increment = new Action<number>('increment');
	static decrement = new Action<number>('decrement');

	increment = RootStore.increment;
	decrement = RootStore.decrement;

	count$ = this.store.slice('count');
	constructor(public readonly store: Store<RootState>) {}
}

@NgModule({
	imports: [
		TinySliceModule.forRoot<RootState>(
			{
				count: 0,
			},
			[
				RootStore.increment.reduce((state, payload) => ({
					...state,
					count: state.count + payload,
				})),
				RootStore.decrement.reduce((state, payload) => ({
					...state,
					count: state.count - payload,
				})),
			],
			RootStore,
			{
				plugins: [
					new TinySliceDevtoolPlugin({
						name: 'myExampleApp',
					}),
				],
				useDefaultLogger: true,
			}
		),
	],
	providers: [],
	exports: [TinySliceModule],
})
export class RootStoreModule {}
