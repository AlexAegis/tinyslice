<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import type { Observable } from 'rxjs';
	import { pieDicer } from './deepdish.slice';
	import Pie from './pie.svelte';
	let keys$: Observable<string[]> = pieDicer.keys$;
</script>

<div class="deepDishExample">
	<h1>Deep Dish</h1>

	<ul class="rows">
		{#each $keys$ as key (key)}
			<li class="row">
				<h2>{key}</h2>
				<Pie pieSlice$={pieDicer.get(key)} />
				<Button class="delete" kind="danger" on:click={() => pieDicer.remove(key)}
					>Remove Slice</Button
				>
			</li>
		{/each}
	</ul>

	<div class="controls">
		<Button on:click={() => pieDicer.add({ cheese: 0, sauce: 0 })}>Add Slice</Button>
		<Button on:click={() => pieDicer.create()}>Create Slice</Button>
	</div>
</div>

<style>
	.deepDishExample {
		display: flex;
		flex-direction: column;
		gap: 1em;
		width: 100%;
	}

	.controls {
		display: flex;
		gap: 1em;
		flex-direction: row-reverse;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}

	.row {
		display: grid;
		grid-template-rows: 1fr 1fr;
		grid-template-columns: 4em 3fr 1fr;
		gap: 1em;
		align-items: center;
	}

	.row h2,
	.row :global(.delete) {
		grid-row: 1 / -1;
	}

	.row :global(.delete) {
		grid-column: -1;
	}

	.row :global(span) {
		grid-column: 2;
		justify-content: space-between;
	}
</style>
