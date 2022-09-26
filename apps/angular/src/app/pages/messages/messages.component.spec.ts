import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RootStoreModule } from '../../core/root-store.module';

import { MessagesComponent } from './messages.component';
import { MessagesModule } from './messages.module';

describe('MessagesComponent', () => {
	let component: MessagesComponent;
	let fixture: ComponentFixture<MessagesComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [MessagesComponent],
			imports: [RootStoreModule, MessagesModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MessagesComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
