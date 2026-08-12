<script lang="ts">
	let {
		label = '',
		value,
		options,
		onchange
	}: {
		label?: string;
		value: string;
		options: { value: string; label: string }[];
		onchange: (v: string) => void;
	} = $props();
</script>

{#if label}
	<div class="field-label"><span class="fname">{label}</span></div>
{/if}
<select {value} onchange={(e) => onchange((e.currentTarget as HTMLSelectElement).value)}>
	{#each options as o (o.value)}
		<option value={o.value}>{o.label}</option>
	{/each}
</select>
