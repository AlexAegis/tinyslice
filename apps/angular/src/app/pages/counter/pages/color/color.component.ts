import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ColorStore } from './color-store.service';

@Component({
	selector: 'tinyslice-color',
	templateUrl: './color.component.html',
	styleUrls: ['./color.component.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorComponent {
	constructor(public readonly colorStore: ColorStore) {}
}
