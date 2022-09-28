<script lang="ts">
	import { messageActions, messageHistory$, messageSlice, sideMessage$ } from './message.store';

	let sideMessage: string | undefined;

	function changeMessage(event: Event) {
		const message = (event as unknown as { target?: { value: string } }).target?.value;
		sideMessage = message;
		messageActions.sendMessage.next(message);
	}
</script>

<input type="text" on:input={changeMessage} />
<span>
	Last message {$messageSlice.lastMessage}
</span>
<ol>
	{#each $messageHistory$ as message}
		<li>
			{message}
		</li>
	{/each}
</ol>

<span>
	Side message: {$sideMessage$}
</span>

<button on:click={() => sideMessage$.set(sideMessage ?? '')}>SetSideMessage</button>
<button on:click={() => messageActions.setSecondMessage.next(sideMessage ?? 'Default')}
	>SetSideMessageToSecondMessage</button
>
