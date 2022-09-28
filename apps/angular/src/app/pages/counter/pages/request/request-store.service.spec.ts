import { fakeAsync, flush, TestBed, tick, waitForAsync } from '@angular/core/testing';
import { Observable, Observer, Subscription } from 'rxjs';
import { RootStoreModule } from '../../../../core/root-store.module';
import { CounterModule } from '../../counter.module';

import { RequestStore } from './request-store.service';

const mockSubscribe = <T>(observable: Observable<T>, sink?: Subscription): Observer<T> => {
	const observer = {
		next: jest.fn(),
		complete: jest.fn(),
		error: jest.fn(),
	};

	const subscription = observable.subscribe(observer);
	sink?.add(subscription);

	return observer;
};

describe('RequestStore', () => {
	let service: RequestStore;

	let loadingObserver: Observer<boolean>;
	let request: Observer<string>;
	let requestSuccess: Observer<string>;
	let requestFailure: Observer<string>;

	let randomSpy: jest.SpyInstance;
	let sink: Subscription;

	const assertNoCompletesAndErrors = () => {
		expect(loadingObserver.complete).toHaveBeenCalledTimes(0);
		expect(request.complete).toHaveBeenCalledTimes(0);
		expect(requestSuccess.complete).toHaveBeenCalledTimes(0);
		expect(requestFailure.complete).toHaveBeenCalledTimes(0);

		expect(loadingObserver.error).toHaveBeenCalledTimes(0);
		expect(request.error).toHaveBeenCalledTimes(0);
		expect(requestSuccess.error).toHaveBeenCalledTimes(0);
		expect(requestFailure.error).toHaveBeenCalledTimes(0);
	};

	beforeEach(waitForAsync(async () => {
		sink = new Subscription();
		await TestBed.configureTestingModule({
			providers: [RequestStore],
			imports: [RootStoreModule, CounterModule],
		}).compileComponents();

		service = TestBed.inject(RequestStore);

		loadingObserver = mockSubscribe(service.loading$, sink);
		request = mockSubscribe(service.request, sink);
		requestSuccess = mockSubscribe(service.requestSuccess, sink);
		requestFailure = mockSubscribe(service.requestFailure, sink);
		randomSpy = jest.spyOn(global.Math, 'random');
	}));

	afterEach(() => {
		sink.unsubscribe();
		jest.clearAllMocks();
	});

	it('should be able to make a failing fake request without errors', fakeAsync(() => {
		randomSpy.mockReturnValueOnce(0.9);

		expect(service).toBeTruthy();

		assertNoCompletesAndErrors();
		expect(request.next).toHaveBeenCalledTimes(0);
		expect(requestSuccess.next).toHaveBeenCalledTimes(0);
		expect(requestFailure.next).toHaveBeenCalledTimes(0);
		expect(loadingObserver.next).toHaveBeenLastCalledWith(false);
		expect(loadingObserver.next).toHaveBeenCalledTimes(1);
		service.makeRequest();

		assertNoCompletesAndErrors();
		expect(request.next).toHaveBeenCalledTimes(1);
		expect(requestSuccess.next).toHaveBeenCalledTimes(0);
		expect(requestFailure.next).toHaveBeenCalledTimes(0);
		expect(loadingObserver.next).toHaveBeenLastCalledWith(true);
		expect(loadingObserver.next).toHaveBeenCalledTimes(2);
		tick(500);
		assertNoCompletesAndErrors();
		expect(request.next).toHaveBeenCalledTimes(1);
		expect(requestSuccess.next).toHaveBeenCalledTimes(0);
		expect(requestFailure.next).toHaveBeenCalledTimes(1);
		expect(loadingObserver.next).toHaveBeenLastCalledWith(false);
		expect(loadingObserver.next).toHaveBeenCalledTimes(3);
		flush();
	}));

	it('should be able to make a successive fake request', fakeAsync(() => {
		randomSpy.mockReturnValueOnce(0);
		assertNoCompletesAndErrors();
		expect(service).toBeTruthy();
		expect(request.next).toHaveBeenCalledTimes(0);
		expect(requestSuccess.next).toHaveBeenCalledTimes(0);
		expect(requestFailure.next).toHaveBeenCalledTimes(0);
		expect(loadingObserver.next).toHaveBeenLastCalledWith(false);
		expect(loadingObserver.next).toHaveBeenCalledTimes(1);
		service.makeRequest();

		assertNoCompletesAndErrors();
		expect(request.next).toHaveBeenCalledTimes(1);
		expect(requestSuccess.next).toHaveBeenCalledTimes(0);
		expect(requestFailure.next).toHaveBeenCalledTimes(0);
		expect(loadingObserver.next).toHaveBeenLastCalledWith(true);
		expect(loadingObserver.next).toHaveBeenCalledTimes(2);
		tick(500);
		assertNoCompletesAndErrors();
		expect(request.next).toHaveBeenCalledTimes(1);
		expect(requestSuccess.next).toHaveBeenCalledTimes(1);
		expect(requestFailure.next).toHaveBeenCalledTimes(0);
		expect(loadingObserver.next).toHaveBeenLastCalledWith(false);
		expect(loadingObserver.next).toHaveBeenCalledTimes(3);
		flush();
	}));
});
