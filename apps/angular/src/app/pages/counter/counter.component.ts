import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CounterStore } from './counter-store.module';

@Component({
	selector: 'tinyslice-counter',
	templateUrl: './counter.component.html',
	styleUrls: ['./counter.component.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CounterComponent {
	constructor(public readonly counterStore: CounterStore) {}
}
