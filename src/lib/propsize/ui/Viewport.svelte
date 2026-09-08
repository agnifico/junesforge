<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { docStore } from '$lib/propsize/core/document.svelte';
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { TOOLBAR_ICONS } from '$lib/propsize/core/icons';
	import { importFilesAsSiblings, buildSiblingResolver } from '$lib/propsize/import/local-import';
	import { SUPPORTED_MODEL_LABEL } from '$lib/propsize/import/loaders';
	import { finalizeImport } from '$lib/propsize/import/import-flow';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';
	import type { Asset } from '$lib/propsize/core/types';

	let { engine }: { engine: SceneEngine } = $props();

	let holderEl: HTMLDivElement;
	let sharedMats = $derived(engine.sharedMaterialCount());
	let hasGroup = $derived(docStore.selectedIds.some((id) => {
		const n = docStore.node(id);
		return n && n.kind === 'group';
	}));
	function unshareMats() {
		const n = engine.unshareAllMaterials();
		editorStore.toast(
			n
				? `${n} object${n === 1 ? '' : 's'} given their own material. Shape instances were not unlinked.`
				: 'Every object already has its own material'
		);
	}
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
		if (editorStore.isolatedId) {
			editorStore.toast('Exit isolation (Esc) to import a model');
			return;
		}
		const files = Array.from(e.dataTransfer.files ?? []);
		if (!files.length) return;
		editorStore.toast(`Importing ${files.length > 1 ? files.length + ' files' : files[0].name}…`);
		try {
			const resolver = buildSiblingResolver(files);
			const results = await importFilesAsSiblings(files);
			if (!results.length) {
				editorStore.toast(`Drop a model file (${SUPPORTED_MODEL_LABEL})`);
				return;
			}
			for (const r of results) {
				const decision = await finalizeImport(r, r.file, resolver);
				const meta = {
					name: r.file.name.replace(/\.[^.]+$/, ''),
					format: (r.file.name.split('.').pop()?.toLowerCase() ?? 'glb') as Asset['format'],
					source: { type: 'embedded', dataUrl: r.dataUrl } as const
				};
				if (decision.split) {
					engine.addImportedObjectSplit(decision.result.object, decision.parts, { ...meta, stats: decision.result.stats });
				} else {
					engine.addImportedObject(decision.result.object, { ...meta, stats: decision.result.stats });
				}
				if (decision.result.warnings.length) editorStore.toast(decision.result.warnings[0]);
			}
		} catch (err) {
			console.error(err);
			// loaders.ts turns three's internal failures into something
			// actionable; show that rather than "see console".
			editorStore.toast(err instanceof Error ? err.message : 'Import failed');
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
		if (!meta && !e.altKey && (k === 'w' || k === 'a' || k === 's' || k === 'd')) {
			engine.heldKeys.add(k);
			e.preventDefault();
			return;
		}

		const isolated = !!editorStore.isolatedId;

		if (k === 'tab') {
			e.preventDefault();
			void engine.isolateSelection();
			return;
		}

		if (isolated) {
			if (k === 'escape') {
				e.preventDefault();
				if (editorStore.isolationTool === 'model' && engine.hasModelSelection()) {
					engine.clearModelSelection();
				} else {
					engine.exitIsolation();
				}
				return;
			}
			if (meta && k === 'z') {
				e.preventDefault();
				if (e.shiftKey) engine.redo();
				else engine.undo();
				return;
			}
			if (meta && k === 'y') {
				e.preventDefault();
				engine.redo();
				return;
			}
			if (!meta && k === 'f') {
				engine.focusOnSelection();
				return;
			}
			if (k === '?' || (k === '/' && e.shiftKey)) {
				editorStore.helpOpen = !editorStore.helpOpen;
				return;
			}
			if (editorStore.isolationTool === 'model') {
				if (!meta && k === '1') {
					engine.setEditSelectMode('vertex');
					return;
				}
				if (!meta && k === '2') {
					engine.setEditSelectMode('edge');
					return;
				}
				if (!meta && k === '3') {
					engine.setEditSelectMode('face');
					return;
				}
					// NOT bare "A": W/A/S/D are claimed for camera panning above and
					// return before ever reaching here, so a bare-A binding was dead
					// code. Cmd/Ctrl+A is the same chord the scene uses for select-all
					// and is free while isolated.
					if (meta && k === 'a') {
						e.preventDefault();
						engine.selectAllModel();
						return;
					}
				if (!meta && k === 'g') {
					e.preventDefault();
					engine.startModelGrab();
					return;
				}
				if (!meta && k === 'e') {
					e.preventDefault();
					engine.modelExtrude();
					return;
				}
				if (!meta && k === 'i') {
					e.preventDefault();
					engine.modelInset();
					return;
				}
				if (!meta && k === 'c') {
					e.preventDefault();
					engine.modelLoopCut();
					return;
				}
				if (!meta && k === 'b') {
					e.preventDefault();
					engine.modelBevel();
					return;
				}
				if (!meta && k === 'm') {
					e.preventDefault();
					engine.modelMerge();
					return;
				}
				if (!meta && k === 'o') {
					editorStore.modelProportional = !editorStore.modelProportional;
					editorStore.toast(
						editorStore.modelProportional ? 'Proportional editing on' : 'Proportional editing off'
					);
					return;
				}
				if (k === 'delete' || k === 'backspace' || (!meta && k === 'x')) {
					e.preventDefault();
					engine.modelDelete();
					return;
				}
			}
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
		} else if (e.altKey && k === 'd') {
			e.preventDefault();
			engine.duplicateSelection(true);
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
		<div class="drop-hint">Drop a model ({SUPPORTED_MODEL_LABEL}) to add it to the scene</div>
	{/if}

	<div class="mode-bar">
		<button
			type="button"
			class="mode-btn"
			class:active={!editorStore.isolatedId}
			onclick={() => engine.exitIsolation()}
		>
			Scene
		</button>
		{#if editorStore.isolatedId}
			<button
				type="button"
				class="mode-btn"
				class:active={editorStore.isolationTool === 'model'}
				onclick={() => (editorStore.isolationTool = 'model')}
			>
				Model
			</button>
			<button
				type="button"
				class="mode-btn"
				class:active={editorStore.isolationTool === 'paint'}
				onclick={() => (editorStore.isolationTool = 'paint')}
			>
				Paint
			</button>
		{:else}
			<button
				type="button"
				class="mode-btn"
				title="Isolate one object to model or paint it (Tab)"
				onclick={() => void engine.isolateSelection()}
			>
				Isolate
			</button>
		{/if}
	</div>

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
		<div
			class="vt-btn"
			class:disabled={sharedMats === 0}
			title={sharedMats > 0
				? `Unshare materials (${sharedMats}) — for imported files that point many parts at one material. Linked copies are left alone; use Unlink in the inspector for those.`
				: 'Every object already has its own material'}
			role="button"
			tabindex="0"
			onclick={unshareMats}
			onkeydown={(e) => {
				if (e.key === 'Enter') unshareMats();
			}}
		>
			{@html TOOLBAR_ICONS.unshare}
		</div>
		<!-- The gizmo buttons only mean anything with something selected, so they
		     stay out of the way until there is. -->
		{#if docStore.selectedIds.length > 0 && !editorStore.isolatedId}
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

	{#if !editorStore.isolatedId && docStore.selectedIds.length}
		<div class="tool-strip">
			<div
				class="vt-btn lbl"
				class:active={editorStore.transformStyle === 'together'}
				title="Rotate and scale the whole selection as one, around its shared centre"
				role="button"
				tabindex="0"
				onclick={() => (editorStore.transformStyle = 'together')}
			>
				Together
			</div>
			<div
				class="vt-btn lbl"
				class:active={editorStore.transformStyle === 'each'}
				title="Rotate and scale each object around its own centre, in place"
				role="button"
				tabindex="0"
				onclick={() => (editorStore.transformStyle = 'each')}
			>
				Each
			</div>
			<div
				class="vt-btn"
				title="Copy (Ctrl/Cmd+D) — an exact but fully independent object"
				role="button"
				tabindex="0"
				onclick={() => engine.duplicateSelection()}
				onkeydown={(e) => {
					if (e.key === 'Enter') engine.duplicateSelection();
				}}
			>
				{@html TOOLBAR_ICONS.dupBtn}
			</div>
			<div
				class="vt-btn"
				title="Linked copy (Alt+D) — shares shape and colour with the original; edit either and both change"
				role="button"
				tabindex="0"
				onclick={() => engine.duplicateSelection(true)}
				onkeydown={(e) => {
					if (e.key === 'Enter') engine.duplicateSelection(true);
				}}
			>
				{@html TOOLBAR_ICONS.linkBtn}
			</div>
			<div
				class="vt-btn"
				title="Drop to ground"
				role="button"
				tabindex="0"
				onclick={() => engine.dropToGround()}
				onkeydown={(e) => {
					if (e.key === 'Enter') engine.dropToGround();
				}}
			>
				{@html TOOLBAR_ICONS.dropBtn}
			</div>
			{#if hasGroup}
				<div
					class="vt-btn"
					title="Select everything inside the selected group(s)"
					role="button"
					tabindex="0"
					onclick={() => engine.selectGroupContents()}
					onkeydown={(e) => {
						if (e.key === 'Enter') engine.selectGroupContents();
					}}
				>
					{@html TOOLBAR_ICONS.children}
				</div>
			{/if}
		</div>
	{/if}

	{#if editorStore.isolatedId && editorStore.isolationTool === 'model'}
		<div class="tool-strip">
			<div
				class="vt-btn lbl"
				class:active={editorStore.editSelectMode === 'vertex'}
				title="Vertex (1)"
				role="button"
				tabindex="0"
				onclick={() => engine.setEditSelectMode('vertex')}
			>
				1
			</div>
			<div
				class="vt-btn lbl"
				class:active={editorStore.editSelectMode === 'edge'}
				title="Edge (2)"
				role="button"
				tabindex="0"
				onclick={() => engine.setEditSelectMode('edge')}
			>
				2
			</div>
			<div
				class="vt-btn lbl"
				class:active={editorStore.editSelectMode === 'face'}
				title="Face (3)"
				role="button"
				tabindex="0"
				onclick={() => engine.setEditSelectMode('face')}
			>
				3
			</div>
			<div class="vt-btn lbl" title="Extrude faces (E)" role="button" tabindex="0" onclick={() => engine.modelExtrude()}>
				Ex
			</div>
			<div class="vt-btn lbl" title="Inset faces (I)" role="button" tabindex="0" onclick={() => engine.modelInset()}>
				In
			</div>
			<div class="vt-btn lbl" title="Loop cut (C)" role="button" tabindex="0" onclick={() => engine.modelLoopCut()}>
				Cut
			</div>
			<div class="vt-btn lbl" title="Bevel (B)" role="button" tabindex="0" onclick={() => engine.modelBevel()}>
				Bv
			</div>
		</div>
	{/if}

	{#if editorStore.marquee}
		<div
			class="marquee"
			style="left:{editorStore.marquee.x}px;top:{editorStore.marquee.y}px;width:{editorStore.marquee.w}px;height:{editorStore.marquee.h}px"
		></div>
	{/if}

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
			{#if editorStore.isolatedId}
				Isolating <b>{docStore.node(editorStore.isolatedId)?.name ?? 'object'}</b>
				{#if editorStore.isolationTool === 'model'}
					&middot; <b>1</b>/<b>2</b>/<b>3</b> vertex edge face &middot; <b>E</b> extrude &middot; <b>G</b> move
					&middot; <b>Esc</b> back
				{:else}
					&middot; WASD: pan &middot; <b>Esc</b> / Scene: back &middot; paint tools come next
				{/if}
			{:else}
				WASD: pan &middot; shift+WASD: orbit &middot; scroll: zoom &middot; <b>1</b>/<b>2</b>/<b>3</b>: move
				rotate scale &middot; <b>Tab</b>: isolate &middot; <b>X</b>: snap &middot; <b>F</b>: frame &middot;
				<b>?</b> shortcuts
			{/if}
		</div>
	{/if}
</div>
