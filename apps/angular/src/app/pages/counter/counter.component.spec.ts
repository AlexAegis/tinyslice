import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RootStoreModule } from '../../core/root-store.module';

import { CounterComponent } from './counter.component';
import { CounterModule } from './counter.module';

describe('CounterComponent', () => {
	let component: CounterComponent;
	let fixture: ComponentFixture<CounterComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [CounterComponent],
			imports: [RootStoreModule, CounterModule],
		}).compileComponents();

		fixture = TestBed.createComponent(CounterComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
