<script lang="ts">
	import { Button, Column, Grid, Row } from 'carbon-components-svelte';
	import DeepDish from '../deep-dish/deep-dish.svelte';
	import { count$, counterActions } from './counter.slice';
</script>

<Grid>
	<Row>
		<Column>
			<span>count: {$count$}</span>
		</Column>
	</Row>
	<Row>
		<Column>
			<Button on:click={() => counterActions.decrement.next(1)}>Sub 1</Button>
		</Column>
		<Column>
			<Button on:click={() => counterActions.increment.next(1)}>Add 1</Button>
		</Column>
	</Row>
	<Row>
		<DeepDish />
	</Row>
</Grid>
