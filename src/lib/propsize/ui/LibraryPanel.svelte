<script lang="ts">
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { libraryStore } from '$lib/propsize/library/library-store.svelte';
	import type { LibraryEntry } from '$lib/propsize/library/fs';
	import { importModel, normalizeImport } from '$lib/propsize/import/loaders';
	import { importFilesAsSiblings } from '$lib/propsize/import/local-import';
	import LibraryPreview from './LibraryPreview.svelte';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';
	import type { Asset } from '$lib/propsize/core/types';

	let { engine }: { engine: SceneEngine } = $props();

	let fileInputEl: HTMLInputElement;
	let selectedPath = $state<string | null>(null);
	let selectedEntry = $derived(libraryStore.entries.find((e) => e.path === selectedPath) ?? null);

	libraryStore.detectMode();

	/** A model that came in without its textures is almost always a folder
	 *  problem, so offer the fix rather than just reporting the symptom. */
	function reportImportIssues(warnings: string[], untextured: boolean) {
		if (warnings.length) {
			editorStore.toast(warnings[0], {
				label: 'Reconnect folder',
				run: () => libraryStore.reconnectAndRestore(engine)
			});
		} else if (untextured) {
			editorStore.toast('Imported without materials — use Override material to paint it');
		}
	}

	async function pickFolder() {
		const ok = await libraryStore.pickFolder();
		if (!ok) return;
		selectedPath = null;
		if (libraryStore.missingCount > 0) await libraryStore.restoreMissing(engine);
	}

	async function addEntry(entry: LibraryEntry) {
		libraryStore.busy = `Importing ${entry.name}…`;
		try {
			const file = await libraryStore.library.read(entry);
			const result = await importModel(file, libraryStore.library.siblingResolver(entry));
			normalizeImport(result.object);
			engine.addImportedObject(result.object, {
				name: entry.name.replace(/\.[^.]+$/, ''),
				format: entry.format as Asset['format'],
				source: { type: 'library', path: entry.path },
				stats: result.stats
			});
			reportImportIssues(result.warnings, result.untextured);
		} catch (e) {
			console.error(e);
			editorStore.toast(
				e instanceof Error && e.message.startsWith('Unsupported format')
					? `${entry.format.toUpperCase()} isn't supported yet — use GLB, glTF or OBJ`
					: `Could not import ${entry.name}`
			);
		} finally {
			libraryStore.busy = null;
		}
	}

	async function onFilesPicked(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (!files.length) return;
		libraryStore.busy = `Importing ${files.length > 1 ? files.length + ' files' : files[0].name}…`;
		try {
			const results = await importFilesAsSiblings(files);
			if (!results.length) {
				editorStore.toast('No .glb / .gltf / .obj files in that selection');
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
				else if (r.untextured) editorStore.toast('Imported without materials — use Override material to paint it');
			}
		} catch (err) {
			console.error(err);
			editorStore.toast('Import failed — see console for details');
		} finally {
			libraryStore.busy = null;
		}
	}
</script>

<div class="panel-head">
	<span>{libraryStore.entries.length} model{libraryStore.entries.length === 1 ? '' : 's'}</span>
</div>

<!-- Pinned: folder controls and the live preview stay put while the list scrolls. -->
<div class="lib-fixed">
	{#if libraryStore.missingCount > 0}
		{@const one = libraryStore.missingCount === 1}
		<div class="lib-warning">
			<b>{libraryStore.missingCount} model{one ? '' : 's'} {one ? "isn't" : "aren't"} loaded.</b>
			{one ? 'It came' : 'They came'} from a folder on your computer, which browsers can't reopen without your
			permission — so {one ? "it's showing as a pink box" : "they're showing as pink boxes"}. Positions and sizes
			are safe either way.
			<div class="btn-row" style="margin-top:8px;">
				<button class="btn primary sm" onclick={() => libraryStore.reconnectAndRestore(engine)}>
					Reconnect folder
				</button>
			</div>
			{#if libraryStore.unresolved.length}
				<div class="lib-unresolved">
					Not in that folder:
					{#each libraryStore.unresolved as path (path)}<div>{path}</div>{/each}
				</div>
			{/if}
		</div>
	{/if}

	<div class="act-bar">
		<button class="btn sm" onclick={pickFolder}>{libraryStore.connected ? 'Change folder' : 'Choose folder'}</button>
		<button class="btn sm" onclick={() => fileInputEl.click()}>Import files…</button>
		<input type="file" multiple bind:this={fileInputEl} onchange={onFilesPicked} style="display:none;" />
	</div>

	{#if libraryStore.busy}
		<div class="lib-busy">{libraryStore.busy}</div>
	{/if}

	{#if selectedEntry}
		<LibraryPreview entry={selectedEntry} />
		<div class="act-bar">
			<button class="btn primary sm" onclick={() => addEntry(selectedEntry)}>Add to scene</button>
			<button class="btn sm" onclick={() => (selectedPath = null)}>Close</button>
		</div>
	{/if}
</div>

<div class="lib-scroll">
	{#if libraryStore.entries.length}
		<div class="lib-list">
			{#each libraryStore.entries as entry (entry.path)}
				<div
					class="lib-item"
					class:selected={selectedPath === entry.path}
					role="button"
					tabindex="0"
					title={entry.path}
					onclick={() => (selectedPath = selectedPath === entry.path ? null : entry.path)}
					ondblclick={() => addEntry(entry)}
					onkeydown={(e) => {
						if (e.key === 'Enter') addEntry(entry);
					}}
				>
					<span class="lib-name">{entry.name}</span>
					<span class="lib-fmt">{entry.format.toUpperCase()}</span>
				</div>
			{/each}
		</div>
		<div class="lib-hint">Click to preview · double-click to add</div>
	{:else}
		<div class="lib-empty">
			No folder connected. <b>Choose folder</b> to browse models here, or <b>Import files…</b> for a one-off — for
			an .obj, select its .mtl and textures too. You can also drag models onto the viewport.
		</div>
	{/if}
</div>
