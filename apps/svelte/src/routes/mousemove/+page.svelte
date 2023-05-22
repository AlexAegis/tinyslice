<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { listenThrottled$, mouseMoveSlice$, positionPrint$ } from './mousemove.slice.js';

	const paused$ = mouseMoveSlice$.paused$;
	$: paused = $paused$;

	onMount(() => mouseMoveSlice$.unpause());
	onDestroy(() => mouseMoveSlice$.pause());
</script>

<div class="mousemovetest">
	<h1>
		<span class="strikethrought" class:nonstrikethrought="{$listenThrottled$}">Throttled</span>
		Mouse Position: {$positionPrint$}
	</h1>

	<button
		type="button"
		class="btn variant-filled"
		on:click="{() => listenThrottled$.set(!listenThrottled$.value)}"
	>
		Toggle Throttled Listener
	</button>

	<button
		type="button"
		class="btn variant-filled"
		on:click="{() => (paused ? mouseMoveSlice$.unpause() : mouseMoveSlice$.pause())}"
	>
		{#if paused}
			Unpause
		{:else}
			Pause
		{/if}
		Slice
	</button>
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
