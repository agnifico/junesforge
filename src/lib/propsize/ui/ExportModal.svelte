<script lang="ts">
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { generateThreeCode } from '$lib/propsize/core/emit-three';
	import { serializeProject } from '$lib/propsize/core/serialize';
	import { TOOLBAR_ICONS } from '$lib/propsize/core/icons';

	function safeName() {
		return editorStore.exportName.replace(/[^a-zA-Z0-9]/g, '') || 'MyProp';
	}

	let output = $derived(editorStore.exportTab === 'json' ? serializeProject() : generateThreeCode(safeName()));

	function close() {
		editorStore.exportOpen = false;
	}
	async function copy() {
		try {
			await navigator.clipboard.writeText(output);
			editorStore.toast('Copied to clipboard');
		} catch {
			editorStore.toast('Copy failed — select and copy manually');
		}
	}
	function download() {
		const isCode = editorStore.exportTab === 'code';
		const blob = new Blob([output], { type: isCode ? 'text/javascript' : 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = isCode ? `create${safeName()}.js` : `${safeName()}.propsize.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}
</script>

<div
	class="ps-modal-backdrop"
	class:show={editorStore.exportOpen}
	onclick={(e) => {
		if (e.target === e.currentTarget) close();
	}}
>
	<div class="ps-modal">
		<div class="ps-modal-head">
			<h2>Export</h2>
			<div class="ps-modal-tabs">
				<button
					type="button"
					class="ps-mtab"
					class:active={editorStore.exportTab === 'code'}
					onclick={() => (editorStore.exportTab = 'code')}>three.js</button
				>
				<button
					type="button"
					class="ps-mtab"
					class:active={editorStore.exportTab === 'json'}
					onclick={() => (editorStore.exportTab = 'json')}>json</button
				>
			</div>
			<button class="ps-modal-close" onclick={close} aria-label="Close">{@html TOOLBAR_ICONS.close}</button>
		</div>
		<div class="ps-modal-body">
			{#if editorStore.exportTab === 'code'}
				<input type="text" bind:value={editorStore.exportName} spellcheck="false" placeholder="MyProp" />
			{/if}
			<pre class="ps-code-out">{output}</pre>
		</div>
		<div class="ps-modal-foot">
			<button class="btn" onclick={copy}>Copy to clipboard</button>
			<button class="btn primary" onclick={download}>Download file</button>
		</div>
	</div>
</div>
