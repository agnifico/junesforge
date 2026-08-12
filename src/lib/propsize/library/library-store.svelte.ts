/**
 * Shared model-library state.
 *
 * Lives outside the Library panel component because two things need it: the
 * panel itself, and the restore-on-load path (a document saved with library
 * models needs the folder reconnected before those models can come back).
 *
 * The reconnect flow is deliberately two-stage. Chromium remembers the
 * directory handle in IndexedDB across sessions, but re-reading it may need a
 * fresh permission grant, and `requestPermission()` only works from a user
 * gesture. So on load we attempt a *silent* reconnect (succeeds when
 * permission is still granted), and if that isn't possible we surface a
 * prompt for the user to click.
 */
import { docStore } from '$lib/propsize/core/document.svelte';
import { editorStore } from '$lib/propsize/core/editor.svelte';
import { isImported } from '$lib/propsize/core/types';
import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';
import { importModel } from '$lib/propsize/import/loaders';
import { ModelLibrary, supportsFileSystemAccess, pickFolderFallback, type LibraryEntry } from './fs';

export type LibraryMode = 'persistent' | 'session' | 'unsupported';

class LibraryStore {
	library = new ModelLibrary();
	mode = $state<LibraryMode>('unsupported');
	entries = $state<LibraryEntry[]>([]);
	connected = $state(false);
	busy = $state<string | null>(null);

	/** Set when a document references library models we can't load yet, so the
	 *  UI can offer a reconnect instead of leaving silent placeholder boxes. */
	missingCount = $state(0);
	/** Names of assets that a reconnect genuinely failed to find, so the user
	 *  gets told *which* files are missing rather than a silent no-op. */
	unresolved = $state<string[]>([]);

	detectMode() {
		if (this.mode !== 'unsupported') return;
		this.mode = supportsFileSystemAccess() ? 'persistent' : 'session';
	}

	/** Library-sourced assets whose geometry isn't loaded in this session. */
	#missingLibraryAssets(engine: SceneEngine) {
		const out: { assetId: string; path: string; name: string }[] = [];
		const seen = new Set<string>();
		for (const node of docStore.doc.nodes) {
			if (!isImported(node) || seen.has(node.assetId)) continue;
			if (engine.hasAsset(node.assetId)) continue;
			const asset = docStore.doc.assets[node.assetId];
			if (!asset || asset.source.type !== 'library') continue;
			seen.add(node.assetId);
			out.push({ assetId: node.assetId, path: asset.source.path, name: asset.name });
		}
		return out;
	}

	refreshMissingCount(engine: SceneEngine) {
		this.missingCount = this.#missingLibraryAssets(engine).length;
	}

	/**
	 * Try to reconnect without prompting. Safe to call on page load: returns
	 * false (having done nothing visible) when a user gesture would be needed.
	 */
	async trySilentReconnect(): Promise<boolean> {
		this.detectMode();
		if (this.mode !== 'persistent') return false;
		try {
			const ok = await this.library.restore();
			if (ok) {
				this.entries = this.library.entries;
				this.connected = true;
			}
			return ok;
		} catch {
			return false;
		}
	}

	/** Prompt for a folder. Must be called from a click. */
	async pickFolder(): Promise<boolean> {
		this.detectMode();
		if (this.mode === 'persistent') {
			this.busy = 'Waiting for folder permission…';
			try {
				const ok = await this.library.pick();
				if (ok) {
					this.entries = this.library.entries;
					this.connected = true;
				}
				return ok;
			} finally {
				this.busy = null;
			}
		}
		this.busy = 'Waiting for folder selection…';
		try {
			const files = await pickFolderFallback();
			const models = this.library.useFallbackFiles(files);
			this.entries = models;
			this.connected = models.length > 0;
			return this.connected;
		} finally {
			this.busy = null;
		}
	}

	/**
	 * Re-import every library asset the document needs but doesn't have,
	 * matching by the path recorded at import time. Anything not found in the
	 * newly-connected folder is reported rather than silently skipped — the
	 * user may have picked the wrong folder, and a placeholder box with no
	 * explanation is exactly the confusing state this is meant to fix.
	 */
	async restoreMissing(engine: SceneEngine): Promise<{ restored: number; missing: string[] }> {
		const wanted = this.#missingLibraryAssets(engine);
		if (!wanted.length) {
			this.missingCount = 0;
			this.unresolved = [];
			return { restored: 0, missing: [] };
		}

		let restored = 0;
		const missing: string[] = [];
		this.busy = `Restoring ${wanted.length} model${wanted.length === 1 ? '' : 's'}…`;
		try {
			for (const want of wanted) {
				const entry = this.entries.find((e) => e.path === want.path);
				if (!entry) {
					missing.push(want.path);
					continue;
				}
				try {
					const file = await this.library.read(entry);
					const result = await importModel(file, this.library.siblingResolver(entry));
					engine.registerRestoredAsset(want.assetId, result.object);
					restored++;
				} catch (e) {
					console.error('Propsize: failed to restore', want.path, e);
					missing.push(want.path);
				}
			}
		} finally {
			this.busy = null;
		}

		this.unresolved = missing;
		this.refreshMissingCount(engine);
		return { restored, missing };
	}

	/** Reconnect + restore in one go, with user-facing messaging. */
	async reconnectAndRestore(engine: SceneEngine) {
		const ok = await this.pickFolder();
		if (!ok) return;
		const { restored, missing } = await this.restoreMissing(engine);
		if (restored && !missing.length) {
			editorStore.toast(`Restored ${restored} model${restored === 1 ? '' : 's'}`);
		} else if (restored && missing.length) {
			editorStore.toast(`Restored ${restored}, but ${missing.length} still missing from this folder`);
		} else if (missing.length) {
			editorStore.toast(`None of the ${missing.length} models are in that folder`);
		}
	}
}

export const libraryStore = new LibraryStore();
