<script lang="ts">
	import { docStore } from '$lib/propsize/core/document.svelte';
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { ICONS, TOOLBAR_ICONS } from '$lib/propsize/core/icons';
	import { GEO_DEFS } from '$lib/propsize/core/geometry';
	import { isGroup, isPrimitive } from '$lib/propsize/core/types';
	import type { SceneNode } from '$lib/propsize/core/types';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';

	let { engine }: { engine: SceneEngine } = $props();

	type Row = { node: SceneNode; depth: number; hasChildren: boolean };

	let rows = $derived.by((): Row[] => {
		const out: Row[] = [];
		function walk(list: SceneNode[], depth: number) {
			for (const node of list) {
				const children = docStore.children(node.id);
				out.push({ node, depth, hasChildren: children.length > 0 });
				if (children.length && !editorStore.collapsed.has(node.id)) walk(children, depth + 1);
			}
		}
		walk(docStore.children(null), 0);
		return out;
	});

	// Keep the selection reachable: open every collapsed ancestor.
	$effect(() => {
		for (const id of docStore.selectedIds) {
			editorStore.expandAncestors(id, (nid) => docStore.node(nid)?.parentId ?? null);
		}
	});

	let editingId = $state<string | null>(null);
	let editingValue = $state('');
	/** Everything the current drag is carrying — the whole selection when the
	 *  grabbed row is part of it, otherwise just that row. */
	let dragIds = $state<string[]>([]);
	let dropTargetId = $state<string | null>(null);
	/** 'into' drops inside a group; 'before'/'after' drop between rows as a
	 *  sibling, which is the only way to reach the root level once the tree is
	 *  tall enough that there's no empty space left to drop on. */
	let dropMode = $state<'into' | 'before' | 'after' | null>(null);
	/** Anchor for shift-click ranges, as in any file explorer. */
	let anchorId = $state<string | null>(null);

	function iconFor(node: SceneNode): string {
		if (isGroup(node)) return ICONS.group;
		if (isPrimitive(node)) return GEO_DEFS[node.type].icon;
		return ICONS.imported;
	}

	function focusSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function startRename(node: SceneNode) {
		editingId = node.id;
		editingValue = node.name;
	}
	function commitRename(node: SceneNode) {
		if (editingId !== node.id) return;
		docStore.mark('rename:' + node.id);
		node.name = editingValue.trim() || node.name;
		editingId = null;
		engine.requestSync();
	}
	function cancelRename() {
		editingId = null;
	}

	function toggleVisible(node: SceneNode) {
		docStore.mark(null);
		node.visible = !node.visible;
		engine.requestSync();
	}

	function onRowClick(e: MouseEvent, node: SceneNode) {
		const visible = rows.map((r) => r.node.id);

		// Shift extends from the anchor over the rows as displayed; adding
		// Ctrl/Cmd unions that range with what's already selected instead of
		// replacing it. The anchor deliberately stays put so repeated
		// shift-clicks grow and shrink the same range.
		if (e.shiftKey && anchorId && visible.includes(anchorId) && visible.includes(node.id)) {
			const a = visible.indexOf(anchorId);
			const b = visible.indexOf(node.id);
			const range = visible.slice(Math.min(a, b), Math.max(a, b) + 1);
			engine.setSelection(
				e.ctrlKey || e.metaKey ? [...new Set([...docStore.selectedIds, ...range])] : range
			);
			return;
		}

		if (e.ctrlKey || e.metaKey) engine.toggleSelection(node.id);
		else engine.setSelection([node.id]);
		anchorId = node.id;
	}

	// Recomputed as the document changes, so the tooltip always states the real
	// number the button is about to act on.
	let sharedMats = $derived(engine.sharedMaterialCount());
	let unshareTitle = $derived(
		sharedMats > 0
			? `Give every object its own material.\n\n${sharedMats} object${sharedMats === 1 ? '' : 's'} currently ` +
				`share a material with another object, so recolouring one repaints them all — common in models ` +
				`imported from a single file. This hands each part its own copy, making it paintable on its own.\n\n` +
				`Objects that already had a material to themselves are left alone. Undoable with Ctrl/Cmd+Z.`
			: 'Every object already has its own material — nothing to unshare.'
	);

	function unshareMats() {
		const n = engine.unshareAllMaterials();
		editorStore.toast(
			n
				? `${n} object${n === 1 ? '' : 's'} given their own material`
				: 'Every object already has its own material'
		);
	}

	// Copy needs exactly one shape to read from; paste needs something on the
	// clipboard and at least one shape to put it on. Both buttons say so by
	// being disabled rather than by toasting after the fact.
	let copySource = $derived.by(() => {
		if (docStore.selectedIds.length !== 1) return null;
		const n = docStore.node(docStore.selectedIds[0]);
		return n && isPrimitive(n) ? n : null;
	});
	let pasteTargets = $derived(
		editorStore.materialClipboard ? docStore.selectionMeshes(true).filter(isPrimitive).length : 0
	);

	function copyMat() {
		if (copySource) engine.copyMaterialFrom(copySource);
	}

	function onDragStart(e: DragEvent, node: SceneNode) {
		// Grabbing a row that's already selected drags the whole selection;
		// grabbing anything else selects it first, so what you drag is always
		// what's highlighted.
		if (docStore.selectedIds.includes(node.id)) {
			dragIds = [...docStore.selectedIds];
		} else {
			engine.setSelection([node.id]);
			anchorId = node.id;
			dragIds = [node.id];
		}
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			try {
				e.dataTransfer.setData('text/plain', dragIds.join(','));
			} catch {
				/* ignore */
			}
		}
	}
	function onDragEnd() {
		dragIds = [];
		dropTargetId = null;
		dropMode = null;
	}

	/** A row is off-limits when it's being dragged or lives inside something
	 *  that is — you can't drop a subtree into itself. */
	function insideDrag(id: string) {
		return dragIds.some((d) => d === id || engine.isAncestorOf(d, id));
	}

	function modeFor(e: DragEvent, node: SceneNode): 'into' | 'before' | 'after' {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const frac = (e.clientY - rect.top) / rect.height;
		// Only groups can be dropped into, so a leaf row gives its full height
		// to before/after — the same split file explorers use.
		if (isGroup(node) && frac > 0.3 && frac < 0.7) return 'into';
		return frac < 0.5 ? 'before' : 'after';
	}

	function onDragOver(e: DragEvent, node: SceneNode) {
		if (!dragIds.length) return;
		const mode = modeFor(e, node);
		// 'into' targets the row itself; 'before'/'after' target its parent, so
		// a row inside the dragged subtree can still be a valid sibling anchor.
		if (mode === 'into' ? insideDrag(node.id) : node.parentId !== null && insideDrag(node.parentId)) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dropTargetId = node.id;
		dropMode = mode;
	}
	function onDragLeave(node: SceneNode) {
		if (dropTargetId === node.id) {
			dropTargetId = null;
			dropMode = null;
		}
	}
	function onDrop(e: DragEvent, node: SceneNode) {
		e.preventDefault();
		e.stopPropagation();
		const mode = dropMode;
		const ids = dragIds;
		onDragEnd();
		if (!ids.length || !mode) return;

		if (mode === 'into') {
			engine.moveNodes(ids, node.id);
			return;
		}
		// Landing between rows: same parent as the row we're anchored to, and
		// slotted either directly before it or before whatever follows it.
		const siblings = docStore.children(node.parentId);
		const i = siblings.findIndex((s) => s.id === node.id);
		const beforeId = mode === 'before' ? node.id : (siblings[i + 1]?.id ?? null);
		engine.moveNodes(ids, node.parentId, beforeId);
	}

	function onTreeDragOver(e: DragEvent) {
		if (dragIds.length) e.preventDefault();
	}
	function onTreeDrop(e: DragEvent) {
		if (!dragIds.length || (e.target as HTMLElement).id !== 'tree') return;
		e.preventDefault();
		const ids = dragIds;
		onDragEnd();
		engine.moveNodes(ids, null);
	}
</script>

<div class="panel-head">
	<span>{docStore.doc.nodes.length} object{docStore.doc.nodes.length === 1 ? '' : 's'}</span>
</div>

<div class="act-bar">
		<button class="btn icon-only" title="Group selected (G)" onclick={() => engine.groupSelection()}
			>{@html TOOLBAR_ICONS.groupBtn}</button
		>
		<button class="btn icon-only" title="Ungroup" onclick={() => engine.ungroupSelection()}
			>{@html TOOLBAR_ICONS.ungroupBtn}</button
		>
		<button class="btn icon-only" title="Duplicate (Ctrl/Cmd+D)" onclick={() => engine.duplicateSelection()}
			>{@html TOOLBAR_ICONS.dupBtn}</button
		>
		<button class="btn icon-only danger" title="Delete (Del)" onclick={() => engine.deleteSelection()}
			>{@html TOOLBAR_ICONS.delBtn}</button
		>
	</div>
	<div class="act-bar">
		<button class="btn sm" title="Sit the selection on the grid" onclick={() => engine.dropToGround()}>
			Drop to ground
		</button>
	</div>
	<div class="act-bar">
		<div class="act-group">
			<span class="act-group-label">Material</span>
			<button
				class="btn sm"
				disabled={!copySource}
				title={copySource
					? `Copy the material off ${copySource.name}`
					: 'Select a single shape to copy its material'}
				onclick={copyMat}
			>
				Copy
			</button>
			<button
				class="btn sm"
				disabled={pasteTargets === 0}
				title={!editorStore.materialClipboard
					? 'Copy a material first'
					: pasteTargets === 0
						? 'Select the shapes to paste onto'
						: `Paste onto ${pasteTargets} shape${pasteTargets === 1 ? '' : 's'}`}
				onclick={() => engine.pasteMaterialToSelection()}
			>
				Paste
			</button>
		</div>
	</div>
	<div class="act-bar">
		<button class="btn sm" title={unshareTitle} disabled={sharedMats === 0} onclick={unshareMats}>
			Unshare materials{sharedMats > 0 ? ` (${sharedMats})` : ''}
		</button>
	</div>

	<div id="tree" ondragover={onTreeDragOver} ondrop={onTreeDrop}>
		{#if !rows.length}
			<div class="tree-empty">No objects yet.<br />Use the shape tray above to add your first primitive.</div>
		{:else}
			{#each rows as row (row.node.id)}
				<div
					class="node-row"
					class:selected={docStore.selectedIds.includes(row.node.id)}
					class:hidden={!row.node.visible}
					class:drop-into={dropTargetId === row.node.id && dropMode === 'into'}
					class:drop-before={dropTargetId === row.node.id && dropMode === 'before'}
					class:drop-after={dropTargetId === row.node.id && dropMode === 'after'}
					class:dragging={dragIds.includes(row.node.id)}
					style="padding-left:{6 + row.depth * 14}px"
					draggable="true"
					onclick={(e) => onRowClick(e, row.node)}
					ondragstart={(e) => onDragStart(e, row.node)}
					ondragend={onDragEnd}
					ondragover={(e) => onDragOver(e, row.node)}
					ondragleave={() => onDragLeave(row.node)}
					ondrop={(e) => onDrop(e, row.node)}
				>
					<span
						class="chev"
						class:leaf={!row.hasChildren}
						style="transform:rotate({editorStore.collapsed.has(row.node.id) ? 0 : 90}deg)"
						onclick={(e) => {
							e.stopPropagation();
							editorStore.toggleCollapsed(row.node.id);
						}}
					>
						{@html TOOLBAR_ICONS.chev}
					</span>
					<span class="gicon">{@html iconFor(row.node)}</span>
					{#if editingId === row.node.id}
						<span class="nlabel editing">
							<input
								value={editingValue}
								use:focusSelect
								oninput={(e) => (editingValue = (e.currentTarget as HTMLInputElement).value)}
								onblur={() => commitRename(row.node)}
								onkeydown={(e) => {
									if (e.key === 'Enter') commitRename(row.node);
									if (e.key === 'Escape') cancelRename();
								}}
								onclick={(e) => e.stopPropagation()}
							/>
						</span>
					{:else}
						<span
							class="nlabel"
							ondblclick={(e) => {
								e.stopPropagation();
								startRename(row.node);
							}}>{row.node.name}</span
						>
					{/if}
					<span
						class="eye"
						onclick={(e) => {
							e.stopPropagation();
							toggleVisible(row.node);
						}}
					>
						{@html row.node.visible ? TOOLBAR_ICONS.eye : TOOLBAR_ICONS.eyeOff}
					</span>
				</div>
			{/each}
		{/if}
	</div>
