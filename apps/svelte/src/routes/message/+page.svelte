<script lang="ts">
	import { messageActions, messageHistory$, messageSlice } from './message.slice.js';

	let value: string;
</script>

<section>
	<h1>Messages</h1>

	<div>
		<input
			class="input"
			type="text"
			bind:value
			on:input="{() => messageActions.sendMessage.next(value)}"
		/>
	</div>

	<div>
		<span>
			Last message {$messageSlice.lastMessage}
		</span>
	</div>

	<ol>
		{#each $messageHistory$ as message}
			<li>{message}</li>
		{/each}
	</ol>
</section>

<style>
	section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1em;
	}

	ol,
	h1 {
		grid-column: -1 / 1;
	}
</style>
