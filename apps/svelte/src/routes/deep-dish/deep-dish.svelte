<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import type { Observable } from 'rxjs';
	import { pieDicer } from './deep-dish.slice';
	import Pie from './pie.svelte';
	let sliceKeys$: Observable<string[]> = pieDicer.sliceKeys$;

	console.log('DEEPDISH');
</script>

<div class="deepDishExample">
	<h1>Deep Dish</h1>
	<div class="controls">
		<Button on:click={() => pieDicer.add({ cheese: 0, sauce: 0 })}>Add Slice</Button>
	</div>

	<div class="rows">
		{#each $sliceKeys$ as key}
			<div class="row">
				<span> {key} </span>
				<Pie pieSlice$={pieDicer.get(key)} />
				<Button kind="danger" on:click={() => pieDicer.remove(key)}>Remove Slice</Button>
			</div>
		{/each}
	</div>
</div>

<style>
	.deepDishExample {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}

	.controls {
		display: flex;
		gap: 1em;
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
