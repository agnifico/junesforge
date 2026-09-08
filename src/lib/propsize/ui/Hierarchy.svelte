<script lang="ts">
	import { tick } from 'svelte';
	import { docStore } from '$lib/propsize/core/document.svelte';
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { ICONS, TOOLBAR_ICONS } from '$lib/propsize/core/icons';
	import { GEO_DEFS } from '$lib/propsize/core/geometry';
	import { isGroup, isPrimitive } from '$lib/propsize/core/types';
	import type { SceneNode } from '$lib/propsize/core/types';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';

	let { engine }: { engine: SceneEngine } = $props();

	// Indent stops growing past this depth — a row nested 20+ groups deep
	// would otherwise push its own icon and name past the panel's right edge
	// (indentation eating the exact space the label needs to be readable in).
	// Beyond it every row lines up at the same indent; the ancestor-pins
	// stack above is what actually communicates "how deep are we" past this
	// point, not the staircase of padding.
	const MAX_INDENT_DEPTH = 12;
	function indentPx(depth: number) {
		return 6 + Math.min(depth, MAX_INDENT_DEPTH) * 14;
	}

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

	// ---- scroll-to-selection & ancestor breadcrumb ---------------------------
	// A click in the viewport (or anywhere else that changes the selection)
	// should bring the corresponding row into view here too, and — since a
	// group deep enough to fill the panel can put a selected child's parent
	// entirely out of frame — keep its containing groups legible by pinning
	// them to the top of the panel until scrolling reaches them for real.
	let treeEl = $state<HTMLDivElement | null>(null);
	let scrollTop = $state(0);
	/** Measured off the first rendered row rather than hard-coded, so a CSS
	 *  tweak to row padding/line-height can't quietly desync the scroll math. */
	let rowHeight = $state(27);

	function onTreeScroll() {
		scrollTop = treeEl?.scrollTop ?? 0;
	}

	function measureRowHeight(el: HTMLElement, isFirst: boolean) {
		if (isFirst) rowHeight = el.getBoundingClientRect().height || rowHeight;
		return {
			update(v: boolean) {
				if (v) rowHeight = el.getBoundingClientRect().height || rowHeight;
			}
		};
	}

	/** Root-first chain of ancestor nodes above `id` — empty for a top-level
	 *  node or when nothing's selected. */
	function ancestorChainOf(id: string | null): SceneNode[] {
		const chain: SceneNode[] = [];
		let cur = id ? (docStore.node(id)?.parentId ?? null) : null;
		while (cur) {
			const n = docStore.node(cur);
			if (!n) break;
			chain.unshift(n);
			cur = n.parentId;
		}
		return chain;
	}

	// The last row explicitly clicked (or, failing that, the first of whatever
	// selectedIds holds) stands in for "the" selection when there are several —
	// good enough for a breadcrumb, which can only ever point at one lineage.
	let primaryId = $derived(
		anchorId && docStore.selectedIds.includes(anchorId)
			? anchorId
			: (docStore.selectedIds[0] ?? null)
	);
	let ancestorChain = $derived(ancestorChainOf(primaryId));
	let ancestorIds = $derived(new Set(ancestorChain.map((n) => n.id)));
	let rowIndexOf = $derived.by(() => {
		const m = new Map<string, number>();
		rows.forEach((r, i) => m.set(r.node.id, i));
		return m;
	});
	// An ancestor only needs pinning once its own row has scrolled above the
	// visible area — and pre-order guarantees that's a prefix of the chain
	// starting at the root, so a plain filter is already in the right order.
	let pinnedAncestors = $derived(
		ancestorChain.filter((n) => (rowIndexOf.get(n.id) ?? -1) * rowHeight < scrollTop)
	);
	// Steel (--steel in theme.css) and the panel's own background, as plain
	// RGB triples so a pinned row's backdrop can be blended to a solid color
	// in JS — CSS alone can't do that without color-mix(), which is one more
	// browser-support question than this needs.
	const STEEL: [number, number, number] = [111, 147, 179];
	const PANEL_BG: [number, number, number] = [28, 30, 32]; // --bg-1

	/** Deeper ancestors (closer to the actual selection) read stronger than
	 *  the root — the immediate parent is the one you're most likely orienting
	 *  against, so it's the one that should stand out most. */
	function ancestorAlpha(node: SceneNode): number {
		const i = ancestorChain.findIndex((n) => n.id === node.id);
		return ancestorChain.length ? 0.08 + ((i + 1) / ancestorChain.length) * 0.14 : 0;
	}
	/** Translucent tint for an ancestor row still in its natural place in the
	 *  list — it sits over the panel's own background like any other row. */
	function ancestorTint(node: SceneNode): string {
		return `rgba(${STEEL[0]}, ${STEEL[1]}, ${STEEL[2]}, ${ancestorAlpha(node).toFixed(3)})`;
	}
	/** Same tint, pre-blended to an opaque color — a pinned duplicate has to
	 *  fully occlude the real row scrolling past underneath it, so it can't
	 *  use a translucent background the way the in-place version does. */
	function ancestorPinBg(node: SceneNode): string {
		const a = ancestorAlpha(node);
		const mix = (base: number, tint: number) => Math.round(base * (1 - a) + tint * a);
		return `rgb(${mix(PANEL_BG[0], STEEL[0])}, ${mix(PANEL_BG[1], STEEL[1])}, ${mix(PANEL_BG[2], STEEL[2])})`;
	}

	function scrollRowIntoView(id: string) {
		if (!treeEl) return;
		const idx = rowIndexOf.get(id);
		if (idx === undefined) return;
		// Worst case every ancestor ends up pinned once we've scrolled — reserve
		// that much headroom so the row we're revealing doesn't land right
		// underneath the pin stack it's about to grow.
		const topMargin = ancestorChainOf(id).length * rowHeight;
		const rowTop = idx * rowHeight;
		const rowBottom = rowTop + rowHeight;
		const viewTop = treeEl.scrollTop + topMargin;
		const viewBottom = treeEl.scrollTop + treeEl.clientHeight;
		if (rowTop < viewTop) treeEl.scrollTop = Math.max(0, rowTop - topMargin);
		else if (rowBottom > viewBottom) treeEl.scrollTop = rowBottom - treeEl.clientHeight;
	}

	// Runs after expandAncestors (above) has had a chance to open whatever was
	// collapsed, so `rows` already includes the row we're about to scroll to.
	$effect(() => {
		const id = primaryId;
		if (!id) return;
		tick().then(() => scrollRowIntoView(id));
	});

	function iconFor(node: SceneNode): string {
		if (isGroup(node)) return ICONS.group;
		if (isPrimitive(node)) return GEO_DEFS[node.type].icon;
		if (node.kind === 'mesh') return ICONS.mesh;
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
	function toggleLock(node: SceneNode) {
		docStore.mark(null);
		node.locked = !node.locked;
		engine.requestSync();
	}

	/** Collapsing a group that contains part of the selection would otherwise
	 *  leave those rows hidden with nothing to show for it — they'd stay
	 *  selected, but no longer reachable in the tree. Fold just the hidden
	 *  members up to the group being collapsed, leaving any other selected
	 *  object (one that isn't inside this group) untouched — collapsing
	 *  shouldn't be able to silently drop part of an unrelated selection. */
	function onToggleCollapse(node: SceneNode) {
		const collapsing = !editorStore.collapsed.has(node.id);
		const hidden = (id: string) => id === node.id || engine.isAncestorOf(node.id, id);
		if (collapsing && docStore.selectedIds.some(hidden)) {
			const kept = docStore.selectedIds.filter((id) => !hidden(id));
			engine.setSelection([...kept, node.id]);
		}
		editorStore.toggleCollapsed(node.id);
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
	// Copy needs exactly one shape to read from; paste needs something on the
	// clipboard and at least one shape to put it on. Both buttons say so by
	// being disabled rather than by toasting after the fact.
	let copySource = $derived.by(() => {
		if (docStore.selectedIds.length !== 1) return null;
		const n = docStore.node(docStore.selectedIds[0]);
		return n && (isPrimitive(n) || n.kind === 'mesh') ? n : null;
	});
	let pasteTargets = $derived(
		editorStore.materialClipboard ? docStore.selectionMeshes(true).filter((n) => isPrimitive(n) || n.kind === 'mesh').length : 0
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
		if (mode === 'into' ? insideDrag(node.id) : node.parentId !== null && insideDrag(node.parentId))
			return;
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
		// Dropping on the empty gutter below the last row (rather than on a
		// row itself) un-parents to root. That gutter belongs to #tree or its
		// direct .tree-rows wrapper — never a .node-row — so checking for
		// either id/class is more robust than assuming which one the browser
		// reports as e.target.
		const target = e.target as HTMLElement;
		const onEmptyGutter = target.id === 'tree' || target.classList.contains('tree-rows');
		if (!dragIds.length || !onEmptyGutter) return;
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
	<button class="btn icon-only danger" title="Delete (Del)" onclick={() => engine.deleteSelection()}
		>{@html TOOLBAR_ICONS.delBtn}</button
	>
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
	<div class="act-group">
		<span class="act-group-label">Duplicate</span>
		<button
			class="btn sm"
			disabled={!docStore.selectedIds.length}
			title="Copy (Ctrl/Cmd+D) — an exact but fully independent object. Nothing you do to it can reach the original."
			onclick={() => engine.duplicateSelection()}
		>
			Copy
		</button>
		<button
			class="btn sm"
			disabled={!docStore.selectedIds.length}
			title="Link (Alt+D) — shares shape and colour with the original. Editing either updates both; only position, rotation and scale are per-copy."
			onclick={() => engine.duplicateSelection(true)}
		>
			Link
		</button>
	</div>
</div>

<div
	id="tree"
	bind:this={treeEl}
	onscroll={onTreeScroll}
	ondragover={onTreeDragOver}
	ondrop={onTreeDrop}
>
	{#if !rows.length}
		<div class="tree-empty">
			No objects yet.<br />Use the shape tray above to add your first primitive.
		</div>
	{:else}
		<div class="tree-rows">
			{#if pinnedAncestors.length}
				<!-- Duplicates of whichever containing groups have scrolled out of
				     frame, pinned above the live rows so the selection never loses
				     its context — see the "scroll-to-selection & ancestor breadcrumb"
				     block in the script. Each disappears the moment its real row
				     scrolls into view, since it then drops out of pinnedAncestors. -->
				<div class="ancestor-pins" style="--pins-h:{pinnedAncestors.length * rowHeight}px">
					{#each pinnedAncestors as anc (anc.id)}
						<div
							class="node-row pinned"
							style="padding-left:{indentPx(
								rows.find((r) => r.node.id === anc.id)?.depth ?? 0
							)}px; --anc-pin-bg:{ancestorPinBg(anc)}"
							onclick={() => {
								engine.setSelection([anc.id]);
								anchorId = anc.id;
							}}
						>
							<span class="chev leaf">{@html TOOLBAR_ICONS.chev}</span>
							<span class="gicon">{@html iconFor(anc)}</span>
							<span class="nlabel">{anc.name}</span>
						</div>
					{/each}
				</div>
			{/if}
			{#each rows as row, i (row.node.id)}
				<div
					class="node-row"
					class:selected={docStore.selectedIds.includes(row.node.id)}
					class:ancestor={ancestorIds.has(row.node.id) &&
						!docStore.selectedIds.includes(row.node.id)}
					class:hidden={!row.node.visible}
					class:locked={row.node.locked}
					class:drop-into={dropTargetId === row.node.id && dropMode === 'into'}
					class:drop-before={dropTargetId === row.node.id && dropMode === 'before'}
					class:drop-after={dropTargetId === row.node.id && dropMode === 'after'}
					class:dragging={dragIds.includes(row.node.id)}
					style="padding-left:{indentPx(row.depth)}px; --anc-tint:{ancestorIds.has(row.node.id)
						? ancestorTint(row.node)
						: 'transparent'}"
					use:measureRowHeight={i === 0}
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
							onToggleCollapse(row.node);
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
					{#if row.node.dataLink}
						<span class="link-mark" title="Linked copy — shares shape and colour with its group">{@html TOOLBAR_ICONS.linkBtn}</span>
					{/if}
					<span
						class="lock"
						title={row.node.locked ? 'Unlock' : 'Lock'}
						onclick={(e) => {
							e.stopPropagation();
							toggleLock(row.node);
						}}
					>
						{@html row.node.locked ? TOOLBAR_ICONS.lock : TOOLBAR_ICONS.unlock}
					</span>
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
		</div>
	{/if}
</div>
