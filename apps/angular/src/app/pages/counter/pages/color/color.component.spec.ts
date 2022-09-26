import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RootStoreModule } from '../../../../core/root-store.module';

import { CounterModule } from '../../counter.module';
import { ColorComponent } from './color.component';

describe('RequestComponent', () => {
	let component: ColorComponent;
	let fixture: ComponentFixture<ColorComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ColorComponent],
			imports: [RootStoreModule, CounterModule],
		}).compileComponents();

		fixture = TestBed.createComponent(ColorComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
