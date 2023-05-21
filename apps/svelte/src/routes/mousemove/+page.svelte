<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import { onDestroy, onMount } from 'svelte';
	import { listenThrottled$, mouseMoveSlice$, positionPrint$ } from './mousemove.slice';

	const paused$ = mouseMoveSlice$.paused$;
	$: paused = $paused$;

	onMount(() => mouseMoveSlice$.unpause());
	onDestroy(() => mouseMoveSlice$.pause());
</script>

<div class="mousemovetest">
	<h1>
		<span class="strikethrought" class:nonstrikethrought={$listenThrottled$}>Throttled</span>
		Mouse Position: {$positionPrint$}
	</h1>

	<Button on:click={() => listenThrottled$.set(!listenThrottled$.value)}>
		Toggle Throttled Listener
	</Button>

	<Button on:click={() => (paused ? mouseMoveSlice$.unpause() : mouseMoveSlice$.pause())}>
		{#if paused}
			Unpause
		{:else}
			Pause
		{/if}
		Slice
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
