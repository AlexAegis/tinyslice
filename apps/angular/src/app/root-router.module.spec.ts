import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AppModule } from './app.module';
import { AppComponent } from './core/app.component';
import { CounterComponent } from './pages/counter/counter.component';
import { MessagesComponent } from './pages/messages/messages.component';

describe('RootRouterModule', () => {
	let component!: AppComponent;
	let fixture!: ComponentFixture<AppComponent>;
	let router!: Router;

	beforeEach(fakeAsync(async () => {
		await TestBed.configureTestingModule({
			imports: [AppModule],
		}).compileComponents();

		fixture = TestBed.createComponent(AppComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		router = TestBed.inject(Router);

		fixture.ngZone?.run(() => router.initialNavigation());
		tick();
	}));

	it('renders /counter with CounterComponent', fakeAsync(() => {
		expect(component).toBeDefined();
		fixture.ngZone?.run(() => router.navigate(['counter']));
		tick();
		const counterComponent = fixture.debugElement.query(By.directive(CounterComponent));
		expect(counterComponent).toBeDefined();
		const counterComponentInstance = counterComponent.componentInstance as CounterComponent;
		expect(counterComponentInstance).toBeDefined();
	}));

	it('renders /messages with MessagesComponent', fakeAsync(() => {
		expect(component).toBeDefined();
		fixture.ngZone?.run(() => router.navigate(['messages']));
		tick();
		const messagesComponent = fixture.debugElement.query(By.directive(MessagesComponent));
		expect(messagesComponent).toBeDefined();
		const messagesComponentInstance = messagesComponent.componentInstance as MessagesComponent;
		expect(messagesComponentInstance).toBeDefined();
	}));
});
