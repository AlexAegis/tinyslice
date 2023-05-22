<script lang="ts">
	import { Observer } from 'svelte-rxjs-observer';

	import { count$, counterActions, counterSlice } from './counter.slice.js';
</script>

<div class="counter-example">
	<h1 class="h1">Counter: {$count$}</h1>
	<div>
		<button
			type="button"
			class="btn variant-filled"
			on:click="{() => counterActions.increment.next(1)}"
		>
			Add 1
		</button>
		<button
			type="button"
			class="btn variant-filled"
			on:click="{() => counterActions.decrement.next(1)}"
		>
			Sub 1
		</button>
	</div>
	<div class="internal-counter m-12">
		<div>
			<div>
				<Observer observable="{counterSlice.internals.internalCounter$}" let:next>
					internalCounter: {JSON.stringify(next)}
				</Observer>
			</div>
			<div>
				<button
					type="button"
					class="btn variant-filled"
					on:click="{() =>
						counterSlice.internals.internalCount$.set(
							counterSlice.internals.internalCount$.value + 1
						)}">Add 1</button
				>
				<button
					type="button"
					class="btn variant-filled"
					on:click="{() =>
						counterSlice.internals.internalCount$.set(
							counterSlice.internals.internalCount$.value - 1
						)}"
				>
					Sub 1
				</button>
			</div>
		</div>
		<div>
			internalCount:
			<Observer observable="{counterSlice.internals.internalCount$}" let:next>
				value: {next}
			</Observer>
		</div>
		<div>
			internalDirectCounter:
			<Observer observable="{counterSlice.internals.internalDirectCounter$}" let:next>
				value: {next}
			</Observer>
		</div>

		<div>
			<div>
				internalNullableCounter:
				<Observer observable="{counterSlice.internals.internalNullableCounter$}" let:next>
					value: {JSON.stringify(next)}
				</Observer>
			</div>
			<div>
				<button
					type="button"
					class="btn variant-filled"
					on:click="{() =>
						counterSlice.internals.internalNullableCounter$.set({ internalCount: 1 })}"
				>
					Set Nullable
				</button>
				<button
					type="button"
					class="btn variant-filled"
					on:click="{() =>
						counterSlice.internals.internalNullableCounter$.set(undefined)}"
				>
					Unset Nullable
				</button>

				<Observer
					observable="{counterSlice.internals.internalNullableCounter$.paused$}"
					let:next
				>
					{#if next}
						<button
							type="button"
							class="btn variant-filled"
							on:click="{() =>
								counterSlice.internals.internalNullableCounter$.unpause()}"
						>
							Unpause Nullable
						</button>
					{:else}
						<button
							type="button"
							class="btn variant-filled"
							on:click="{() =>
								counterSlice.internals.internalNullableCounter$.pause()}"
						>
							Pause Nullable
						</button>
					{/if}
				</Observer>
			</div>
		</div>

		<div>
			<div>
				internalNullableCounterCount:
				<Observer
					observable="{counterSlice.internals.internalNullableCounterCount$}"
					let:next
				>
					value: {JSON.stringify(next)}
				</Observer>

				<button
					type="button"
					class="btn variant-filled"
					on:click="{() =>
						counterSlice.internals.internalNullableCounterCount$.set(
							counterSlice.internals.internalNullableCounterCount$.value + 1
						)}"
				>
					Increment internalNullableCounterCount
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.counter-example {
		display: flex;
		flex-direction: column;
		gap: 2em;
	}

	div {
		display: flex;
		align-items: center;
		gap: 2em;
	}

	.internal-counter {
		margin-top: 2em;
		display: flex;
		flex-direction: column;
	}
</style>
