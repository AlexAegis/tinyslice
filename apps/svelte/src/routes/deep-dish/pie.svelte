<script lang="ts">
	import type { Observable } from 'rxjs';
	import type { PieState } from './deep-dish.slice';

	export let pieState$: Observable<PieState>;
	export let sauce$: Observable<PieState>;
	export let cheese$: Observable<PieState>;
</script>

<span> Cheese: {$cheese$} </span>
<span> Sauce: {$sauce$} </span>
