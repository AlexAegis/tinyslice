import { Component } from '@angular/core';
import packageJson from '../../../../../package.json';
import { RootStore } from './root-store.module';

@Component({
	selector: 'tinyslice-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css'],
})
export class AppComponent {
	title = 'angular';
	isCollapsed = false;
	version = packageJson.version;

	constructor(public readonly rootStore: RootStore) {}
}
