<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { docStore } from '$lib/propsize/core/document.svelte';
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { TOOLBAR_ICONS } from '$lib/propsize/core/icons';
	import { importFilesAsSiblings } from '$lib/propsize/import/local-import';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';
	import type { Asset } from '$lib/propsize/core/types';

	let { engine }: { engine: SceneEngine } = $props();

	let holderEl: HTMLDivElement;
	let dragDepth = $state(0); // nested dragenter/leave pairs, so the hint doesn't flicker
	let dropActive = $derived(dragDepth > 0);

	function onDragEnter(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		dragDepth++;
	}
	function onDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}
	function onDragLeave(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		dragDepth = Math.max(0, dragDepth - 1);
	}
	async function onDrop(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		dragDepth = 0;
		const files = Array.from(e.dataTransfer.files ?? []);
		if (!files.length) return;
		editorStore.toast(`Importing ${files.length > 1 ? files.length + ' files' : files[0].name}…`);
		try {
			const results = await importFilesAsSiblings(files);
			if (!results.length) {
				editorStore.toast('Drop a .glb, .gltf or .obj file');
				return;
			}
			for (const r of results) {
				engine.addImportedObject(r.object, {
					name: r.file.name.replace(/\.[^.]+$/, ''),
					format: (r.file.name.split('.').pop()?.toLowerCase() ?? 'glb') as Asset['format'],
					source: { type: 'embedded', dataUrl: r.dataUrl },
					stats: r.stats
				});
				if (r.warnings.length) editorStore.toast(r.warnings[0]);
			}
		} catch (err) {
			console.error(err);
			editorStore.toast('Import failed — see console for details');
		}
	}

	function isTyping() {
		const tag = document.activeElement?.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
	}
	function onBlur() {
		engine.heldKeys.clear();
	}
	function onKeyup(e: KeyboardEvent) {
		const k = e.key.toLowerCase();
		if (k === 'shift') engine.heldKeys.delete('shift');
		else engine.heldKeys.delete(k);
	}
	function onKeydown(e: KeyboardEvent) {
		if (isTyping()) return;
		const k = e.key.toLowerCase();
		const meta = e.ctrlKey || e.metaKey;

		if (k === 'shift') {
			engine.heldKeys.add('shift');
			return;
		}
		if (!meta && (k === 'w' || k === 'a' || k === 's' || k === 'd')) {
			engine.heldKeys.add(k);
			e.preventDefault();
			return;
		}

		if (meta && k === 'z') {
			e.preventDefault();
			if (e.shiftKey) engine.redo();
			else engine.undo();
		} else if (meta && k === 'y') {
			e.preventDefault();
			engine.redo();
		} else if (meta && k === 'a') {
			e.preventDefault();
			engine.selectAllTopLevel();
		} else if (meta && k === 'd') {
			e.preventDefault();
			engine.duplicateSelection();
		} else if (!meta && k === 'x') {
			editorStore.toggleSnap();
		} else if (!meta && k === '1') {
			engine.setGizmoMode('translate');
		} else if (!meta && k === '2') {
			engine.setGizmoMode('rotate');
		} else if (!meta && k === '3') {
			engine.setGizmoMode('scale');
		} else if (!meta && k === 'g' && docStore.selectedIds.length > 1) {
			engine.groupSelection();
		} else if (!meta && k === 'f') {
			engine.focusOnSelection();
		} else if (k === 'delete' || k === 'backspace') {
			engine.deleteSelection();
			e.preventDefault();
		} else if (k === 'escape') {
			engine.setSelection([]);
		} else if (k === '?' || (k === '/' && e.shiftKey)) {
			editorStore.helpOpen = !editorStore.helpOpen;
		} else if (e.key.indexOf('Arrow') === 0) {
			engine.nudgeByKey(e);
		}
	}

	onMount(() => {
		engine.mount(holderEl);
		engine.requestSync();
		window.addEventListener('keydown', onKeydown);
		window.addEventListener('keyup', onKeyup);
		window.addEventListener('blur', onBlur);
	});
	onDestroy(() => {
		window.removeEventListener('keydown', onKeydown);
		window.removeEventListener('keyup', onKeyup);
		window.removeEventListener('blur', onBlur);
		engine.dispose();
	});
</script>

<div
	id="view"
	role="application"
	aria-label="3D viewport"
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	<div id="canvas-holder" bind:this={holderEl}></div>
	{#if dropActive}
		<div class="drop-hint">Drop .glb / .gltf / .obj to add it to the scene</div>
	{/if}

	<div class="viewport-toolbar">
		<div
			class="vt-btn"
			class:active={editorStore.showGrid}
			title="Toggle grid"
			role="button"
			tabindex="0"
			onclick={() => engine.toggleGrid()}
			onkeydown={(e) => {
				if (e.key === 'Enter') engine.toggleGrid();
			}}
		>
			{@html TOOLBAR_ICONS.grid}
		</div>
		<div
			class="vt-btn"
			class:active={editorStore.wireAll}
			title="Toggle wireframe (all)"
			role="button"
			tabindex="0"
			onclick={() => engine.toggleWire()}
			onkeydown={(e) => {
				if (e.key === 'Enter') engine.toggleWire();
			}}
		>
			{@html TOOLBAR_ICONS.wire}
		</div>
		<div
			class="vt-btn"
			title="Focus selection (F)"
			role="button"
			tabindex="0"
			onclick={() => engine.focusOnSelection()}
			onkeydown={(e) => {
				if (e.key === 'Enter') engine.focusOnSelection();
			}}
		>
			{@html TOOLBAR_ICONS.focus}
		</div>
		<!-- The gizmo buttons only mean anything with something selected, so they
		     stay out of the way until there is. -->
		{#if docStore.selectedIds.length > 0}
		<div
			class="vt-btn"
			class:active={editorStore.gizmoMode === 'translate'}
			title="Move gizmo (1)"
			role="button"
			tabindex="0"
			onclick={() => engine.setGizmoMode('translate')}
			onkeydown={(e) => {
				if (e.key === 'Enter') engine.setGizmoMode('translate');
			}}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
				><path
					d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l2.5 2.5"
				/></svg
			>
		</div>
		<div
			class="vt-btn"
			class:active={editorStore.gizmoMode === 'rotate'}
			title="Rotate gizmo (2)"
			role="button"
			tabindex="0"
			onclick={() => engine.setGizmoMode('rotate')}
			onkeydown={(e) => {
				if (e.key === 'Enter') engine.setGizmoMode('rotate');
			}}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
				><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4h-4" /></svg
			>
		</div>
		<div
			class="vt-btn"
			class:active={editorStore.gizmoMode === 'scale'}
			title="Scale gizmo (3)"
			role="button"
			tabindex="0"
			onclick={() => engine.setGizmoMode('scale')}
			onkeydown={(e) => {
				if (e.key === 'Enter') engine.setGizmoMode('scale');
			}}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
				><path d="M5 19h6v-6" /><rect x="13" y="4" width="7" height="7" rx="1" /><path d="M11 13L19 5" /></svg
			>
		</div>
		{/if}
	</div>

	{#if engine.specPlate}
		<div class="specplate">
			<div class="sp-title">{engine.specPlate.title}</div>
			{#each engine.specPlate.rows as row (row[0])}
				<div class="sp-row"><span>{row[0]}</span><b>{row[1]}</b></div>
			{/each}
		</div>
	{/if}

	{#if editorStore.showShortcutStrip}
		<div class="viewport-hint">
			WASD: pan &middot; shift+WASD: orbit &middot; scroll: zoom &middot; <b>1</b>/<b>2</b>/<b>3</b>: move
			rotate scale &middot; <b>X</b>: snap &middot; <b>F</b>: frame &middot; <b>?</b> shortcuts
		</div>
	{/if}
</div>
