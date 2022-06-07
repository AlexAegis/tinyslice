<script lang="ts">
	import Message from './components/message.svelte';
	import { count$, countAction } from './store';
</script>

<h1>Welcome to the Svelte Example, count: {$count$}</h1>

<button on:click={() => countAction.increment.next(1)}>Add 1</button>
<button on:click={() => countAction.decrement.next(1)}>Sub 1</button>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
<Message />
