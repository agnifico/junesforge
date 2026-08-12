<script lang="ts">
	import { PALETTE } from '$lib/propsize/core/palette';

	let { onPick }: { onPick: (color: string) => void } = $props();
</script>

<div class="swatches">
	{#each PALETTE as pair (pair[0])}
		<div
			class="swatch"
			style="background:{pair[0]}"
			title={pair[1]}
			role="button"
			tabindex="0"
			onclick={() => onPick(pair[0])}
			onkeydown={(e) => {
				if (e.key === 'Enter') onPick(pair[0]);
			}}
		></div>
	{/each}
</div>
