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
		[countAction.reduce((state, payload) => ({ ...state, count: state.count + payload }))]
	);
	const countSlice = store.slice('count');
</script>

<h1>Welcome to {a}, count: {$countSlice}</h1>

<button on:click={() => countAction.next(1)}>Add 1</button>
<button on:click={() => countAction.next(2)}>Add 2</button>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
