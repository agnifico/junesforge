<script lang="ts">
	let {
		label = '',
		buttons
	}: { label?: string; buttons: { label: string; title?: string; onClick: () => void }[] } = $props();
</script>

<div class="field">
	{#if label}
		<div class="field-label"><span class="fname">{label}</span></div>
	{/if}
	<div class="btn-row">
		{#each buttons as b (b.label)}
			<button type="button" class="mini-btn" title={b.title} onclick={b.onClick}>{b.label}</button>
		{/each}
	</div>
</div>
