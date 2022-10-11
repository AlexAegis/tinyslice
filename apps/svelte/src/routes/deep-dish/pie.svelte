<script lang="ts">
	import type { DicedSliceChild } from '@tinyslice/core';
	import { Button } from 'carbon-components-svelte';
	import type { pieDicer } from './deep-dish.slice';

	export let pieSlice$: DicedSliceChild<typeof pieDicer>;

	$: cheese$ = pieSlice$.internals.cheese$;
	$: sauce$ = pieSlice$.internals.sauce$;
	$: pieActions = pieSlice$.internals.pieActions;

	function addSauce() {
		sauce$.set(sauce$.value + 1);
	}

	function addCheese() {
		sauce$.set(cheese$.value + 1);
	}
</script>

<span>
	Cheese: {$cheese$}
	<Button on:click={addCheese}>Add Cheese</Button>
	<Button on:click={() => pieActions.clearCheese.next()}>Clear Cheese</Button>
</span>
<span>
	Sauce: {$sauce$}
	<Button on:click={addSauce}>Add Sauce</Button>
	<Button on:click={() => pieActions.clearSauce.next()}>Clear Sauce</Button>
</span>

<style>
	span {
		display: flex;
		align-items: center;
		gap: 1em;
	}
</style>
