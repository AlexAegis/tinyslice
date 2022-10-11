<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import type { Observable } from 'rxjs';
	import { pieDicer } from './deep-dish.slice';
	import Pie from './pie.svelte';
	let sliceKeys$: Observable<string[]> = pieDicer.sliceKeys$;
</script>

<div class="deepDishExample">
	<h1>Deep Dish</h1>

	<ul class="rows">
		{#each $sliceKeys$ as key (key)}
			<li class="row">
				<h2>{key}</h2>
				<Pie pieSlice$={pieDicer.get(key)} />
				<Button kind="danger" on:click={() => pieDicer.remove(key)}>Remove Slice</Button>
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
		margin-top: 2em;
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
		display: flex;
		gap: 1em;
		align-items: center;
	}
</style>
