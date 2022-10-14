<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import { Observer } from 'svelte-rxjs-observer';

	import { count$, counterActions, counterSlice } from './counter.slice';
</script>

<div class="counterExample">
	<h1>Counter: {$count$}</h1>
	<div>
		<Button on:click={() => counterActions.increment.next(1)}>Add 1</Button>
		<Button on:click={() => counterActions.decrement.next(1)}>Sub 1</Button>
	</div>
	<div class="internalCounter">
		<div>
			<div>
				<Observer observable={counterSlice.internals.internalCounter$} let:next>
					internalCounter: {JSON.stringify(next)}
				</Observer>
			</div>
			<div>
				<Button
					on:click={() =>
						counterSlice.internals.internalCount$.set(
							counterSlice.internals.internalCount$.value + 1
						)}>Add 1</Button
				>
				<Button
					on:click={() =>
						counterSlice.internals.internalCount$.set(
							counterSlice.internals.internalCount$.value - 1
						)}>Sub 1</Button
				>
			</div>
		</div>
		<div>
			internalCount:
			<Observer observable={counterSlice.internals.internalCount$} let:next>
				value: {next}
			</Observer>
		</div>
		<div>
			internalDirectCounter:
			<Observer observable={counterSlice.internals.internalDirectCounter$} let:next>
				value: {next}
			</Observer>
		</div>

		<div>
			<div>
				internalNullableCounter:
				<Observer observable={counterSlice.internals.internalNullableCounter$} let:next>
					value: {JSON.stringify(next)}
				</Observer>
			</div>
			<div>
				<Button
					on:click={() =>
						counterSlice.internals.internalNullableCounter$.set({ internalCount: 1 })}
				>
					Set Nullable
				</Button>
				<Button
					on:click={() => counterSlice.internals.internalNullableCounter$.set(undefined)}
				>
					Unset Nullable
				</Button>

				<Observer
					observable={counterSlice.internals.internalNullableCounter$.paused$}
					let:next
				>
					{#if next}
						<Button
							on:click={() =>
								counterSlice.internals.internalNullableCounter$.unpause()}
						>
							Unpause Nullable
						</Button>
					{:else}
						<Button
							on:click={() => counterSlice.internals.internalNullableCounter$.pause()}
						>
							Pause Nullable
						</Button>
					{/if}
				</Observer>
			</div>
		</div>

		<div>
			<div>
				internalNullableCounterCount:
				<Observer
					observable={counterSlice.internals.internalNullableCounterCount$}
					let:next
				>
					value: {JSON.stringify(next)}
				</Observer>

				<Button
					on:click={() =>
						counterSlice.internals.internalNullableCounterCount$.set(
							counterSlice.internals.internalNullableCounterCount$.value + 1
						)}
				>
					Increment internalNullableCounterCount
				</Button>
			</div>
		</div>
	</div>
</div>

<style>
	.counterExample {
		display: flex;
		flex-direction: column;
		gap: 2em;
	}

	div {
		display: flex;
		align-items: center;
		gap: 2em;
	}

	.internalCounter {
		margin-top: 2em;
		display: flex;
		flex-direction: column;
	}
</style>
