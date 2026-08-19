<script lang="ts">
	import { editorStore } from '$lib/propsize/core/editor.svelte';

	const SHORTCUT_ROWS: [string, string][] = [
		['Click', 'Select object'],
		['Ctrl/Cmd + click', 'Add to selection'],
		['1 / 2 / 3', 'Move / rotate / scale gizmo'],
		['Drag a ring', 'Rotate around that axis'],
		['Drag arrow or ring', 'Transform along that axis'],
		['Drag plane square', 'Move on that plane'],
		['Shift + drag a scale knob', 'Scale from the far edge, not the centre'],
		['WASD', 'Pan the camera'],
		['Shift + WASD', 'Orbit the camera'],
		['Arrows / Shift+Arrows', 'Nudge selection on XZ / Y'],
		['X', 'Snapping on / off'],
		['G', 'Group selection'],
		['Ctrl/Cmd + D', 'Duplicate'],
		['Ctrl/Cmd + Z', 'Undo'],
		['Ctrl/Cmd + Shift + Z', 'Redo'],
		['Ctrl/Cmd + A', 'Select all top-level'],
		['F / double-click', 'Frame selection'],
		['Del', 'Delete selection'],
		['Esc', 'Deselect'],
		['Shift + click (tree)', 'Select a range'],
		['Drag rows (tree)', 'Reparent or reorder'],
		['?', 'This panel']
	];

	function close() {
		editorStore.helpOpen = false;
	}
</script>

<div
	class="help-overlay"
	class:show={editorStore.helpOpen}
	onclick={(e) => {
		if (e.target === e.currentTarget) close();
	}}
>
	<div class="help-card">
		<h3>Keyboard &amp; mouse</h3>
		<div class="help-grid">
			{#each SHORTCUT_ROWS as [key, desc] (key)}
				<kbd>{key}</kbd>
				<span>{desc}</span>
			{/each}
		</div>
		<button class="btn" onclick={close}>Close</button>
	</div>
</div>
