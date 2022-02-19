<script lang="ts">
	import { messageActions, messageSlice } from './message.store';

	let name: string;

	function changeMessage(event: Event) {
		const message = (event as any as { target?: { value: string } }).target?.value;
		messageActions.setMessage.next(message);
	}
</script>

<input type="text" on:input={changeMessage} />
Last message {$messageSlice.lastMessage}
