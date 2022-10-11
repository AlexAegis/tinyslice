<script lang="ts">
	import {
		Column,
		Grid,
		ListItem,
		Row,
		TextInput,
		UnorderedList,
	} from 'carbon-components-svelte';
	import { messageActions, messageHistory$, messageSlice } from './message.slice';
</script>

<h1>Messages</h1>

<Grid>
	<Row>
		<Column>
			<TextInput
				type="text"
				on:input={(event) => messageActions.sendMessage.next(event.detail)}
			/>
		</Column>
	</Row>
	<Row>
		<Column>
			<span>
				Last message {$messageSlice.lastMessage}
			</span>
		</Column>
	</Row>
</Grid>

<UnorderedList>
	{#each $messageHistory$ as message}
		<ListItem>{message}</ListItem>
	{/each}
</UnorderedList>
