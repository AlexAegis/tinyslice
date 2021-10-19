<script lang="ts">
	import { Action, Store } from 'cqrx';

	let a = 'hello';

	interface ExampleState {
		count: number;
	}

	const countAction = new Action<number>('count2');

	const store = new Store<ExampleState>(
		{
			count: 0
		},
		[countAction.reduce((state) => ({ ...state, count: state.count + 1 }))]
	);
	const countSlice = store.dice('count');
</script>

<h1>Welcome to {a}</h1>

<button on:click={() => countAction.next(1)}>Clicked {$countSlice}</button>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
