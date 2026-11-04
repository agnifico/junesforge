<script lang="ts">
	let {
		label = '',
		buttons
	}: {
		label?: string;
		// `active` turns a button into a toggle's lit state — used by the
		// per-axis pickers, which need to show what they're about to affect.
		buttons: { label: string; title?: string; active?: boolean; onClick: () => void }[];
	} = $props();
</script>

<div class="field">
	{#if label}
		<div class="field-label"><span class="fname">{label}</span></div>
	{/if}
	<div class="btn-row">
		{#each buttons as b (b.label)}
			<button type="button" class="mini-btn" class:on={b.active} title={b.title} onclick={b.onClick}
				>{b.label}</button
			>
		{/each}
	</div>
</div>
