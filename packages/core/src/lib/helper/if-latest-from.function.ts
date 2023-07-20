import {
	filter,
	map,
	withLatestFrom,
	type Observable,
	type ObservableInput,
	type OperatorFunction,
} from 'rxjs';

export function ifLatestFrom<T, O>(
	input: ObservableInput<O>,
	condition: (inputResult: O, sourceResult: T) => boolean,
): OperatorFunction<T, T> {
	return (source: Observable<T>) => {
		return source.pipe(
			withLatestFrom(input),
			filter(([sourceResult, inputResult]) => condition(inputResult, sourceResult)),
			map(([a]) => a),
		);
	};
}
