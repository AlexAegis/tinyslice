<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import { onDestroy, onMount } from 'svelte';
	import { listenThrottled$, mouseMoveSlice$, positionPrint$ } from './mousemove.slice';

	onMount(() => mouseMoveSlice$.unpauseEffects());
	onDestroy(() => mouseMoveSlice$.pauseEffects());
</script>

<div class="mousemovetest">
	<h1>
		<span class="strikethrought" class:nonstrikethrought={$listenThrottled$}>Throttled</span>
		Mouse Position: {$positionPrint$}
	</h1>

	<Button on:click={() => listenThrottled$.set(!listenThrottled$.value)}>
		Toggle Throttled Listener
	</Button>
	<span>Using throttled listener? {$listenThrottled$}</span>
</div>

<style>
	.mousemovetest {
		display: flex;
		gap: 2em;
		flex-direction: column;
	}

	span.strikethrought {
		text-decoration: line-through;
	}

	span.nonstrikethrought {
		text-decoration: none;
	}
</style>
