<script lang="ts">
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import Hierarchy from './Hierarchy.svelte';
	import LibraryPanel from './LibraryPanel.svelte';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';

	let { engine }: { engine: SceneEngine } = $props();
</script>

<div id="hier">
	<div class="panel-tabs">
		<button
			class="ptab"
			class:active={editorStore.leftTab === 'hierarchy'}
			onclick={() => (editorStore.leftTab = 'hierarchy')}>Hierarchy</button
		>
		<button
			class="ptab"
			class:active={editorStore.leftTab === 'library'}
			onclick={() => (editorStore.leftTab = 'library')}>Library</button
		>
		<button class="panel-collapse" title="Collapse panel" onclick={() => (editorStore.leftPanelOpen = false)}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6 L9 12 L15 18" /></svg>
		</button>
	</div>

	{#if editorStore.leftTab === 'hierarchy'}
		<Hierarchy {engine} />
	{:else}
		<LibraryPanel {engine} />
	{/if}

	<!-- Pinned to the bottom of the panel, outside whatever is scrolling above. -->
	<div class="panel-footer">
		by <a href="/" class="brand-link">Junesforge</a>
	</div>
</div>
