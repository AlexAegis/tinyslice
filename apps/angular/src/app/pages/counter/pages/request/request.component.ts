import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RequestStore } from './request-store.service';

@Component({
	selector: 'tinyslice-request',
	templateUrl: './request.component.html',
	styleUrls: ['./request.component.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestComponent {
	constructor(public readonly requestStore: RequestStore) {}
}
