<script lang="ts">
	import { docStore } from '$lib/propsize/core/document.svelte';
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { PRIMITIVE_TYPES, GEO_DEFS } from '$lib/propsize/core/geometry';
	import { ICONS, TOOLBAR_ICONS } from '$lib/propsize/core/icons';
	import { loadProjectFromJSON, lastLoadRepairs } from '$lib/propsize/core/serialize';
	import SessionMenu from './SessionMenu.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';

	let { engine }: { engine: SceneEngine } = $props();

	let fileInputEl: HTMLInputElement;

	// ---- shape tray ---------------------------------------------------------
	// Only the first few shapes sit in the bar; the rest live in a panel that
	// opens on hover. It opens at full size rather than growing into place —
	// an expanding strip means the thing you're aiming at keeps moving, which
	// is what makes hover menus feel flickery. A short grace period on the way
	// out covers the diagonal path from the button to the panel.
	const QUICK_SHAPES = 6;
	let quickTypes = $derived(PRIMITIVE_TYPES.slice(0, QUICK_SHAPES));

	let shapesOpen = $state(false);
	let shapesPinned = $state(false);
	let shapesPos = $state({ top: 0, left: 0 });
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	function cancelClose() {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = null;
	}
	function openShapes(e: MouseEvent) {
		// Anchored to the tray, not the button inside it, so the panel's left
		// edge lines up with the tray — and so with the left panel below.
		const el = e.currentTarget as HTMLElement;
		const r = (el.closest('.tray') ?? el).getBoundingClientRect();
		// Sits flush against the tray; the panel's own padding forms the gap,
		// so there's no dead strip in between to fall through.
		shapesPos = { top: r.bottom, left: Math.min(r.left, window.innerWidth - 480) };
		cancelClose();
		shapesOpen = true;
	}
	function scheduleClose() {
		if (shapesPinned) return;
		cancelClose();
		closeTimer = setTimeout(() => (shapesOpen = false), 180);
	}
	function closeShapes() {
		cancelClose();
		shapesOpen = false;
		shapesPinned = false;
	}
	function onShapesClick(e: MouseEvent) {
		if (shapesPinned) {
			closeShapes();
			return;
		}
		openShapes(e);
		shapesPinned = true;
	}
	/** One click places the shape and dismisses the panel. */
	function pickShape(type: (typeof PRIMITIVE_TYPES)[number]) {
		engine.addPrimitive(type);
		closeShapes();
	}

	// The popovers can't live inside .tbar-actions — that strip scrolls
	// horizontally, which would clip them. They're rendered outside it and
	// pinned to the button they belong to instead.
	let popPos = $state({ top: 0, right: 0 });

	/** Only one popover at a time, and clicking outside closes it. */
	function toggle(which: 'session' | 'settings', e: MouseEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		popPos = { top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) };
		const opening = which === 'session' ? !editorStore.sessionOpen : !editorStore.settingsOpen;
		editorStore.sessionOpen = which === 'session' && opening;
		editorStore.settingsOpen = which === 'settings' && opening;
	}
	function closePopovers() {
		editorStore.sessionOpen = false;
		editorStore.settingsOpen = false;
	}

	function onImportChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			if (loadProjectFromJSON(String(reader.result))) {
				engine.resetSceneObjects();
				const repairs = lastLoadRepairs();
				editorStore.toast(
					repairs.length ? `Project imported — ${repairs.join(', ')}` : 'Project imported'
				);
			} else {
				editorStore.toast('Could not read that file');
			}
		};
		reader.readAsText(file);
	}
</script>

<div id="topbar">
	<div class="brand">
		<svg class="mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
			<path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
			<path d="M3 7 L12 12 L21 7 M12 12 L12 22" />
		</svg>
		<span class="brand-text">
			<a href="/propsize" class="brand-name">PROPSIZE</a>
			<small>3D Fundamentals</small>
		</span>
	</div>

	<div class="tray">
		{#each quickTypes as type (type)}
			<div
				class="tray-btn"
				title={'Add ' + GEO_DEFS[type].label}
				role="button"
				tabindex="0"
				onclick={() => engine.addPrimitive(type)}
				onkeydown={(e) => {
					if (e.key === 'Enter') engine.addPrimitive(type);
				}}
			>
				{@html GEO_DEFS[type].icon}
			</div>
		{/each}
		<div
			class="tray-btn tray-more"
			class:active={shapesOpen}
			title="All shapes"
			role="button"
			tabindex="0"
			onmouseenter={openShapes}
			onmouseleave={scheduleClose}
			onclick={onShapesClick}
			onkeydown={(e) => {
				if (e.key === 'Enter') onShapesClick(e as unknown as MouseEvent);
			}}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
				<rect x="3" y="3" width="7" height="7" rx="1.5" />
				<rect x="14" y="3" width="7" height="7" rx="1.5" />
				<rect x="3" y="14" width="7" height="7" rx="1.5" />
				<path d="M14 17.5h7M17.5 14v7" />
			</svg>
		</div>
		<div class="sep"></div>
		<div
			class="tray-btn"
			title="Add empty group"
			role="button"
			tabindex="0"
			onclick={() => engine.addGroup()}
			onkeydown={(e) => {
				if (e.key === 'Enter') engine.addGroup();
			}}
		>
			{@html ICONS.group}
		</div>
	</div>

	<div class="tbar-actions">
		<button
			class="btn icon-only"
			title="Undo (Ctrl/Cmd+Z)"
			disabled={!docStore.canUndo}
			onclick={() => engine.undo()}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
				><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-2.5" /></svg
			>
		</button>
		<button
			class="btn icon-only"
			title="Redo (Ctrl/Cmd+Shift+Z)"
			disabled={!docStore.canRedo}
			onclick={() => engine.redo()}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
				><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h2.5" /></svg
			>
		</button>
		<!-- The amount is always shown; only the styling says whether it's on, so
		     you can see what you'd be turning on before you turn it on. -->
		<button
			class="btn snap-btn"
			class:active={editorStore.snapEnabled}
			title={`Rounds every move to a fixed grid. ${editorStore.snapStep} units, ${editorStore.snapAngle}° on rotate — change the amounts in Settings. (X)`}
			onclick={() => editorStore.toggleSnap()}
		>
			Snap {editorStore.snapStep}
		</button>
		<button class="btn icon-only" title="Shortcuts (?)" onclick={() => (editorStore.helpOpen = !editorStore.helpOpen)}
			>?</button
		>
		<div class="sep"></div>
		<button
			class="btn icon-only"
			class:active={editorStore.leftPanelOpen}
			title="Toggle the hierarchy / library panel"
			onclick={() => (editorStore.leftPanelOpen = !editorStore.leftPanelOpen)}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
				><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg
			>
		</button>
		<button
			class="btn icon-only"
			class:active={editorStore.rightPanelOpen}
			title="Toggle the inspector panel"
			onclick={() => (editorStore.rightPanelOpen = !editorStore.rightPanelOpen)}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
				><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg
			>
		</button>
		<!-- <button
			class="btn"
			class:active={editorStore.leftTab === 'library' && editorStore.leftPanelOpen}
			onclick={() => {
				editorStore.leftTab = 'library';
				editorStore.leftPanelOpen = true;
			}}>Library</button
		> -->
		<button
			class="btn icon-only"
			class:active={editorStore.sessionOpen}
			title="Save & load sessions"
			onclick={(e) => toggle('session', e)}
		>
			{@html TOOLBAR_ICONS.session}
		</button>
		<button
			class="btn icon-only"
			class:active={editorStore.settingsOpen}
			title="Settings"
			onclick={(e) => toggle('settings', e)}
		>
			{@html TOOLBAR_ICONS.settings}
		</button>

		{#if editorStore.showImportJson}
			<button class="btn" onclick={() => fileInputEl.click()}>Import JSON</button>
		{/if}
		<input
			type="file"
			accept="application/json"
			bind:this={fileInputEl}
			onchange={onImportChange}
			style="display:none;"
		/>
		<button class="btn primary" onclick={() => (editorStore.exportOpen = true)}>Export</button>
	</div>
</div>

{#if shapesOpen}
	<!-- Rendered outside the topbar so neither strip can clip it. -->
	<div
		class="shape-layer"
		style="top:{shapesPos.top}px; left:{shapesPos.left}px;"
		role="presentation"
		onmouseenter={cancelClose}
		onmouseleave={scheduleClose}
	>
		<div class="shape-panel">
			<div class="shape-grid">
				{#each PRIMITIVE_TYPES as type (type)}
					<button class="shape-cell" onclick={() => pickShape(type)}>
						{@html GEO_DEFS[type].icon}
						<span>{GEO_DEFS[type].label}</span>
					</button>
				{/each}
				<button
					class="shape-cell"
					onclick={() => {
						engine.addGroup();
						closeShapes();
					}}
				>
					{@html ICONS.group}
					<span>Group</span>
				</button>
			</div>
		</div>
	</div>
	{#if shapesPinned}
		<div class="pop-scrim" role="presentation" onclick={closeShapes}></div>
	{/if}
{/if}

{#if editorStore.sessionOpen || editorStore.settingsOpen}
	<!-- Catches the next click anywhere else, the way any menu does. -->
	<div class="pop-scrim" role="presentation" onclick={closePopovers}></div>
	<div class="pop-layer" style="top:{popPos.top}px; right:{popPos.right}px;">
		{#if editorStore.sessionOpen}
			<SessionMenu {engine} />
		{:else}
			<SettingsPanel {engine} />
		{/if}
	</div>
{/if}
