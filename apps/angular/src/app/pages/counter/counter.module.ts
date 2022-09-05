import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared';
import { CounterStoreModule } from './counter-store.module';
import { CounterComponent } from './counter.component';

@NgModule({
	declarations: [CounterComponent],
	imports: [
		RouterModule.forChild([{ path: '', component: CounterComponent }]),
		CounterStoreModule,
		SharedModule,
	],
	exports: [CounterComponent],
})
export class CounterModule {}
