<script lang="ts">
	let {
		label = '',
		value,
		options,
		onchange
	}: {
		label?: string;
		value: string;
		options: { value: string; label: string; title?: string }[];
		onchange: (v: string) => void;
	} = $props();
</script>

<div class="field">
	{#if label}
		<div class="field-label"><span class="fname">{label}</span></div>
	{/if}
	<div class="seg">
		{#each options as o (o.value)}
			<button
				type="button"
				class="seg-btn"
				class:on={o.value === value}
				title={o.title}
				onclick={() => onchange(o.value)}>{o.label}</button
			>
		{/each}
	</div>
</div>
