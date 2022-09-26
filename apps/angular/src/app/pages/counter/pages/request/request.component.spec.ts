import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RootStoreModule } from '../../../../core/root-store.module';

import { CounterModule } from '../../counter.module';
import { RequestComponent } from './request.component';

describe('RequestComponent', () => {
	let component: RequestComponent;
	let fixture: ComponentFixture<RequestComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [RequestComponent],
			imports: [RootStoreModule, CounterModule],
		}).compileComponents();

		fixture = TestBed.createComponent(RequestComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
