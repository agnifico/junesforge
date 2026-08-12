<script lang="ts">
	import { editorStore } from '$lib/propsize/core/editor.svelte';

	let {
		label,
		value,
		mixed = false,
		showRecents = true,
		onchange
	}: {
		label: string;
		value: string;
		mixed?: boolean;
		showRecents?: boolean;
		onchange: (v: string) => void;
	} = $props();

	function handleInput(e: Event) {
		onchange((e.currentTarget as HTMLInputElement).value);
	}
	function commit(e: Event) {
		editorStore.pushRecentColor((e.currentTarget as HTMLInputElement).value);
	}
	function pickRecent(c: string) {
		onchange(c);
		editorStore.pushRecentColor(c);
	}
</script>

<div class="color-row">
	<input type="color" value={mixed ? '#000000' : value} oninput={handleInput} onchange={commit} />
	<span class="fname">{label}</span>
	<span class="hex" class:mixed>{mixed ? 'mixed' : value}</span>
</div>
{#if showRecents && editorStore.recentColors.length}
	<div class="recent-strip">
		<span class="recent-label">recent</span>
		{#each editorStore.recentColors as c (c)}
			<div
				class="swatch sm"
				style="background:{c}"
				title={c}
				role="button"
				tabindex="0"
				onclick={() => pickRecent(c)}
				onkeydown={(e) => {
					if (e.key === 'Enter') pickRecent(c);
				}}
			></div>
		{/each}
	</div>
{/if}
