import { BehaviorSubject } from 'rxjs';
import { State } from './state.interface';

export type Reducer<T> = (state: State<T>) => State<T>;
/**
 *
 */
export class Store<T> extends BehaviorSubject<T> {
	private reducers: Reducer<T>[] = [];
	public reduce(reducer: Reducer<T>): this {
		console.log('');
		this.reducers.push(reducer);
		return this;
	}
}
