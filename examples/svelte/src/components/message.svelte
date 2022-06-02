<script lang="ts">
	import { messageActions, messageSlice, sideMessage$ } from './message.store';

	let sideMessage: string | undefined;

	function changeMessage(event: Event) {
		const message = (event as any as { target?: { value: string } }).target?.value;
		sideMessage = message;
		messageActions.setMessage.next(message);
	}
</script>

<input type="text" on:input={changeMessage} />
<span>
	Last message {$messageSlice.lastMessage}
</span>

<ol>
	{$messageSlice.messageHistory}
</ol>
<span>
	Side message: {$sideMessage$}
</span>

<button on:click={() => messageActions.setSideMessage.next(sideMessage)}>SetSideMessage</button>
<button on:click={() => messageActions.setSecondMessage.next(sideMessage ?? 'DES')}
	>SetSideMessageToSecondMessage</button
>
