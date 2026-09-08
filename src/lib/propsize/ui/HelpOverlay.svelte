<script lang="ts">
	import { editorStore } from '$lib/propsize/core/editor.svelte';

	const SCENE_ROWS: [string, string][] = [
		['Click', 'Select object'],
		['Shift + click', 'Add to / remove from selection'],
		['Shift + drag', 'Box select'],
		['Ctrl/Cmd + click', 'Add to selection'],
		['1 / 2 / 3', 'Move / rotate / scale gizmo'],
		['Tab', 'Isolate the selection'],
		['Drag a ring', 'Rotate around that axis'],
		['Drag arrow or ring', 'Transform along that axis'],
		['Drag plane square', 'Move on that plane'],
		['Shift + drag a scale knob', 'Scale from the far edge'],
		['Shift + Cmd/Ctrl + drag a scale knob', 'Scale from the near edge'],
		['Together / Each', 'Rotate-scale as one, or each on its own centre'],
		['WASD', 'Pan the camera'],
		['Shift + WASD', 'Orbit the camera'],
		['Arrows / Shift+Arrows', 'Nudge selection on XZ / Y'],
		['X', 'Snapping on / off'],
		['G', 'Group selection'],
		['Ctrl/Cmd + D', 'Copy — fully independent'],
		['Alt + D', 'Linked copy — shares shape + colour'],
		['Ctrl/Cmd + Z', 'Undo'],
		['Ctrl/Cmd + Shift + Z', 'Redo'],
		['Ctrl/Cmd + A', 'Select all top-level'],
		['F / double-click', 'Frame selection'],
		['Del', 'Delete selection'],
		['Lock icon / inspector', 'Lock — gizmos skip it'],
		['Esc', 'Deselect'],
		['Shift + click (tree)', 'Select a range'],
		['Drag rows (tree)', 'Reparent or reorder'],
		['?', 'This panel']
	];

	const ISO_ROWS: [string, string][] = [
		['Esc', 'Clear selection, then return to the scene'],
		['Tab', 'Exit isolation'],
		['1 / 2 / 3', 'Vertex / edge / face (Model)'],
		['Click / Shift-click', 'Select / add components'],
		['Shift + drag', 'Box select components'],
		['Drag a component', 'Move it'],
		['G', 'Move selection'],
		['E', 'Extrude faces'],
		['I', 'Inset faces'],
		['C', 'Loop cut (one edge)'],
		['B', 'Bevel edges'],
		['M', 'Merge vertices'],
		['X / Del', 'Delete'],
		['Ctrl/Cmd + A', 'Select all (current mode)'],
		['O', 'Proportional editing'],
		['Model / Paint', 'Switch isolation tools'],
		['WASD', 'Pan the camera'],
		['Shift + WASD', 'Orbit the camera'],
		['F', 'Frame the isolated object'],
		['Ctrl/Cmd + Z', 'Undo'],
		['?', 'This panel']
	];

	let rows = $derived(editorStore.isolatedId ? ISO_ROWS : SCENE_ROWS);

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
		<h3>{editorStore.isolatedId ? 'Isolation' : 'Keyboard & mouse'}</h3>
		<div class="help-grid">
			{#each rows as [key, desc] (key)}
				<div class="help-row">
					<kbd>{key}</kbd>
					<span>{desc}</span>
				</div>
			{/each}
		</div>
		<button class="btn" onclick={close}>Close</button>
	</div>
</div>
