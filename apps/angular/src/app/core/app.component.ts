import { Component } from '@angular/core';
import { RootStore } from './root-store.module';

@Component({
	selector: 'tinyslice-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css'],
})
export class AppComponent {
	title = 'angular';
	isCollapsed = false;

	constructor(public readonly rootStore: RootStore) {}
}
