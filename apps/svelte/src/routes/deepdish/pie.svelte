<script lang="ts">
	import type { DicedSliceChild } from '@tinyslice/core';
	import { Button } from 'carbon-components-svelte';
	import type { pieDicer } from './deepdish.slice';

	export let pieSlice$: DicedSliceChild<typeof pieDicer>;

	$: cheese$ = pieSlice$.internals.cheese$;
	$: sauce$ = pieSlice$.internals.sauce$;
	$: pieActions = pieSlice$.internals.pieActions;

	function addSauce() {
		sauce$.set(sauce$.value + 1);
	}

	function addCheese() {
		cheese$.set(cheese$.value + 1);
	}
</script>

<span>
	<h4>Sauce: {$sauce$}</h4>

	<Button on:click={addSauce}>Add Sauce</Button>
	<Button on:click={() => pieActions.clearSauce.next()}>Clear Sauce</Button>
</span>

<span>
	<h4 title="It's under the sauce">Cheese: {$cheese$}</h4>

	<Button on:click={addCheese}>Add Cheese</Button>
	<Button on:click={() => pieActions.clearCheese.next()}>Clear Cheese</Button>
</span>

<style>
	span {
		display: flex;
		align-items: center;
		gap: 1em;
	}

	span :global(button) {
		width: 14em;
	}

	h4 {
		width: 10em;
	}
</style>
