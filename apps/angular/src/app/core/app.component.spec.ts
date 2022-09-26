import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RootRouterModule } from '../root-router.module';
import { SharedModule } from '../shared';

import { AppComponent } from './app.component';
import { CoreModule } from './core.module';

describe('AppComponent', () => {
	let component: AppComponent;
	let fixture: ComponentFixture<AppComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AppComponent],
			imports: [SharedModule, CoreModule, RootRouterModule],
		}).compileComponents();

		fixture = TestBed.createComponent(AppComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
