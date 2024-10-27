<script lang="ts">
	import type { DicedSliceChild } from '@tinyslice/core';
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

	<button type="button" class="btn variant-filled" on:click={addSauce}>Add Sauce</button>
	<button
		type="button"
		class="btn variant-filled"
		on:click={() => pieActions.clearSauce.next(undefined)}
	>
		Clear Sauce
	</button>
</span>

<span>
	<h4 title="It's under the sauce">Cheese: {$cheese$}</h4>

	<button type="button" class="btn variant-filled" on:click={addCheese}> Add Cheese </button>
	<button
		type="button"
		class="btn variant-filled"
		on:click={() => pieActions.clearCheese.next(undefined)}
	>
		Clear Cheese
	</button>
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
