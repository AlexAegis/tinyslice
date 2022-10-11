<script lang="ts">
	import { Button, Grid, Row } from 'carbon-components-svelte';

	import DeepDish from '../deep-dish/deep-dish.svelte';
	import { count$, counterActions } from './counter.slice';
</script>

<Grid>
	<Row>
		<div>
			<h1>Counter: {$count$}</h1>
			<div>
				<Button on:click={() => counterActions.decrement.next(1)}>Sub 1</Button>
				<Button on:click={() => counterActions.increment.next(1)}>Add 1</Button>
			</div>
		</div>
	</Row>
	<Row>
		<DeepDish />
	</Row>
</Grid>

<style>
	div {
		display: flex;
		align-items: center;
		gap: 2em;
	}
</style>
