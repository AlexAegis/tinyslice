import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { RootStoreModule } from '../../core/root-store.module';
import { SharedModule } from '../../shared';
import { CounterComponent } from './counter.component';

@NgModule({
	declarations: [CounterComponent],
	imports: [
		RouterModule.forChild([{ path: '', component: CounterComponent }]),
		SharedModule,
		RootStoreModule,
	],
	exports: [CounterComponent],
})
export class CounterModule {}
