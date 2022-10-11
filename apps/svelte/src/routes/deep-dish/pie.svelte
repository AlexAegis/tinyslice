<script lang="ts">
	import type { DicedSliceChild } from '@tinyslice/core';
	import { Button } from 'carbon-components-svelte';
	import type { pieDicer } from './deep-dish.slice';

	export let pieSlice$: DicedSliceChild<typeof pieDicer>;
	let cheese$ = pieSlice$.internals.cheese$;
	let sauce$ = pieSlice$.internals.sauce$;
</script>

<span>
	Cheese: {$cheese$}
	<Button on:click={() => cheese$.set(cheese$.value + 1)}>Add Cheese</Button>
	<Button on:click={() => pieSlice$.internals.pieActions.clearCheese.next()}>Clear Cheese</Button>
</span>
<span>
	Sauce: {$sauce$}
	<Button on:click={() => sauce$.set(sauce$.value + 1)}>Add Sauce</Button>
	<Button on:click={() => pieSlice$.internals.pieActions.clearSauce.next()}>Clear Sauce</Button>
</span>

<style>
</style>
