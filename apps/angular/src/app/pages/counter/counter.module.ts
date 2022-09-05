import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared';
import { CounterStoreModule } from './counter-store.module';
import { CounterComponent } from './counter.component';
import { ColorStore } from './pages/color/color-store.service';
import { ColorComponent } from './pages/color/color.component';
import { RequestStore } from './pages/request/request-store.service';
import { RequestComponent } from './pages/request/request.component';

@NgModule({
	declarations: [CounterComponent, ColorComponent, RequestComponent],
	imports: [
		RouterModule.forChild([{ path: '', component: CounterComponent }]),
		CounterStoreModule,
		SharedModule,
	],
	providers: [ColorStore, RequestStore],
	exports: [CounterComponent],
})
export class CounterModule {}
