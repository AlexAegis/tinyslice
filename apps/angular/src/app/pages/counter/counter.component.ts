import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RootStore } from '../../core/root-store.module';

@Component({
	selector: 'tinyslice-counter',
	templateUrl: './counter.component.html',
	styleUrls: ['./counter.component.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CounterComponent {
	constructor(public readonly rootStore: RootStore) {}
}
