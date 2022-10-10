import { Injectable } from '@angular/core';
import { Action } from '@tinyslice/core';
import { Scope } from '@tinyslice/ngx';
import { catchError, delay, map, of, switchMap } from 'rxjs';
import { CounterStore } from '../../counter-store.module';

export interface RequestState {
	result: string | undefined;
	loading: boolean;
}

const fakeRequest = (request: string) =>
	of(`success ${request}`).pipe(
		delay(500),
		map((message) => {
			if (Math.random() > 0.5) {
				throw new Error(`error ${request}`);
			} else {
				return message;
			}
		})
	);

@Injectable()
export class RequestStore {
	request = new Action<string>('request');
	requestSuccess = new Action<string>('requestSuccess');
	requestFailure = new Action<string>('requestFailure');

	slice = this.counterStore.slice.addSlice(
		'request',
		{ result: undefined, loading: false } as RequestState,
		{
			reducers: [
				this.request.reduce((state) => ({ ...state, loading: true })),
				this.requestSuccess.reduce((state, payload) => ({
					...state,
					result: payload,
					loading: false,
				})),
				this.requestFailure.reduce((state, payload) => ({
					...state,
					result: payload,
					loading: false,
				})),
			],
		}
	);

	loading$ = this.slice.slice('loading');
	result$ = this.slice.slice('result');

	constructor(private readonly counterStore: CounterStore, readonly scope: Scope) {
		scope.createEffect(
			this.request.pipe(
				switchMap((request) =>
					fakeRequest(request).pipe(
						map((payload) => this.requestSuccess.makePacket(payload)),
						catchError((error: Error) =>
							of(this.requestFailure.makePacket(error.message))
						)
					)
				)
			)
		);
	}

	makeRequest(): void {
		this.request.next(new Date().toISOString());
	}
}
