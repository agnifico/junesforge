/**
 * Local model library.
 *
 * Uses the File System Access API: the user picks a folder once, we store the
 * directory handle in IndexedDB, and every later visit reconnects with a single
 * permission click. No server, no upload, no copy — the gallery reads the same
 * files that are sitting on disk, so re-exporting from Blender updates the
 * library with no further action.
 *
 * Constraints worth knowing:
 *  - Chromium only (Chrome, Edge, Opera). Firefox and Safari ship only OPFS,
 *    which is a sandboxed store, not the user's own folders.
 *  - Requires a secure context: https or localhost. It will NOT work from a
 *    file:// page, so the tool must be served (dev server or deployed site).
 *  - The picker must be called from a user gesture.
 *  - Non-Chromium falls back to a one-shot <input webkitdirectory> read: the
 *    gallery works for that session but doesn't persist.
 */

import { SUPPORTED_MODEL_EXTENSIONS } from '../import/loaders';

export type LibraryEntry = {
	/** Path relative to the library root, e.g. "props/barrels/barrel_a.glb" */
	path: string;
	name: string;
	format: string;
	size: number;
	handle?: FileSystemFileHandle;
	/** Present only in the fallback path, where handles don't exist. */
	file?: File;
};

const MODEL_FORMATS: string[] = [...SUPPORTED_MODEL_EXTENSIONS];
const DB_NAME = 'propsize';
const STORE = 'handles';
const KEY = 'libraryRoot';

export const supportsFileSystemAccess = () =>
	typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// ---- tiny IndexedDB wrapper (handles can't go in localStorage) -------------
function idb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
async function idbPut(key: string, value: unknown) {
	const db = await idb();
	return new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
async function idbGet<T>(key: string): Promise<T | null> {
	const db = await idb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).get(key);
		req.onsuccess = () => resolve((req.result as T) ?? null);
		req.onerror = () => reject(req.error);
	});
}

// ---- library --------------------------------------------------------------
export class ModelLibrary {
	root: FileSystemDirectoryHandle | null = null;
	entries: LibraryEntry[] = [];
	/** Every file in the tree, lowercased path -> handle. Textures and .mtl
	 *  files live here even though they never appear in the gallery. */
	allFiles = new Map<string, FileSystemFileHandle>();
	/** Lowercased filename -> the paths carrying it, for last-resort lookups. */
	byBasename = new Map<string, string[]>();
	/** Same index for the handle-less fallback picker. */
	fallbackFiles = new Map<string, File>();

	/** Prompt for a folder. Must be called from a click. */
	async pick(): Promise<boolean> {
		if (!supportsFileSystemAccess()) return false;
		try {
			// @ts-expect-error — not in older TS DOM lib
			this.root = await window.showDirectoryPicker({ id: 'propsize-models', mode: 'read' });
			await idbPut(KEY, this.root);
			await this.scan();
			return true;
		} catch {
			return false; // user cancelled
		}
	}

	/** Reconnect to the previously chosen folder. Returns false if permission
	 *  was revoked or nothing was ever picked; call pick() in that case. */
	async restore(): Promise<boolean> {
		if (!supportsFileSystemAccess()) return false;
		const handle = await idbGet<FileSystemDirectoryHandle>(KEY);
		if (!handle) return false;
		// @ts-expect-error — permission APIs are not in the standard DOM lib yet
		const state = await handle.queryPermission({ mode: 'read' });
		if (state !== 'granted') {
			// @ts-expect-error
			const asked = await handle.requestPermission({ mode: 'read' });
			if (asked !== 'granted') return false;
		}
		this.root = handle;
		await this.scan();
		return true;
	}

	/**
	 * Walk the folder tree. `entries` lists models for the gallery, but we index
	 * *every* file for sibling resolution — a model's textures usually live in a
	 * neighbouring folder (`Models/x.obj` + `Textures/colormap.png`), and those
	 * would be invisible if we only remembered model files.
	 */
	async scan(maxDepth = 6): Promise<LibraryEntry[]> {
		if (!this.root) return [];
		const found: LibraryEntry[] = [];
		this.allFiles.clear();
		this.byBasename.clear();

		const walk = async (dir: FileSystemDirectoryHandle, prefix: string, depth: number) => {
			if (depth > maxDepth) return;
			for await (const [name, handle] of dir.entries()) {
				if (name.startsWith('.')) continue;
				const path = prefix ? `${prefix}/${name}` : name;
				if (handle.kind === 'directory') {
					await walk(handle as FileSystemDirectoryHandle, path, depth + 1);
					continue;
				}
				const fileHandle = handle as FileSystemFileHandle;
				this.allFiles.set(path.toLowerCase(), fileHandle);
				const base = name.toLowerCase();
				this.byBasename.set(base, [...(this.byBasename.get(base) ?? []), path]);

				const format = name.split('.').pop()?.toLowerCase() ?? '';
				if (!MODEL_FORMATS.includes(format)) continue;
				const file = await fileHandle.getFile();
				found.push({ path, name, format, size: file.size, handle: fileHandle });
			}
		};

		await walk(this.root, '', 0);
		found.sort((a, b) => a.path.localeCompare(b.path));
		this.entries = found;
		return found;
	}

	/**
	 * Adopt a one-shot `<input webkitdirectory>` result (Firefox/Safari, where
	 * we get plain Files and no handles). Indexes every file so textures
	 * resolve, and surfaces only models in the gallery.
	 */
	useFallbackFiles(files: File[]): LibraryEntry[] {
		this.allFiles.clear();
		this.byBasename.clear();
		this.fallbackFiles.clear();

		const models: LibraryEntry[] = [];
		for (const f of files) {
			// webkitRelativePath starts with the chosen folder's own name; drop it
			// so paths line up with the handle-based scan.
			const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? f.name;
			const path = rel.split('/').slice(1).join('/') || f.name;
			this.fallbackFiles.set(path.toLowerCase(), f);
			const base = f.name.toLowerCase();
			this.byBasename.set(base, [...(this.byBasename.get(base) ?? []), path]);

			const format = f.name.split('.').pop()?.toLowerCase() ?? '';
			if (MODEL_FORMATS.includes(format)) {
				models.push({ path, name: f.name, format, size: f.size, file: f });
			}
		}
		models.sort((a, b) => a.path.localeCompare(b.path));
		this.entries = models;
		return models;
	}

	/** Read any indexed file by its library-relative path. */
	async #readPath(path: string): Promise<File | null> {
		const direct = this.fallbackFiles.get(path.toLowerCase());
		if (direct) return direct;
		const handle = this.allFiles.get(path.toLowerCase());
		if (handle) {
			try {
				return await handle.getFile();
			} catch {
				return null;
			}
		}
		// Fallback path for entries that came from the one-shot picker, and for
		// anything the scan missed (e.g. below maxDepth).
		const fallback = this.entries.find((e) => e.path.toLowerCase() === path.toLowerCase());
		if (fallback?.file) return fallback.file;
		if (!this.root) return null;
		try {
			let dirHandle = this.root;
			const parts = path.split('/');
			const filename = parts.pop()!;
			for (const part of parts) dirHandle = await dirHandle.getDirectoryHandle(part);
			const fh = await dirHandle.getFileHandle(filename);
			return await fh.getFile();
		} catch {
			return null;
		}
	}

	async read(entry: LibraryEntry): Promise<File> {
		if (entry.file) return entry.file;
		if (!entry.handle) throw new Error('No handle for ' + entry.path);
		return entry.handle.getFile();
	}

	/**
	 * Resolve a companion file (.mtl, textures) referenced by a model.
	 *
	 * Asset packs rarely keep textures beside the model — `Models/wall.obj`
	 * pointing at `Textures/colormap.png` (relative to the pack root, not to
	 * the .obj) is the common shape, and authoring tools also emit Windows
	 * separators and `../` prefixes. So rather than assuming one layout we try
	 * the plausible ones in order of confidence, ending with a unique-basename
	 * search across the library.
	 */
	siblingResolver(entry: LibraryEntry) {
		const dir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';
		return async (relative: string): Promise<File | null> => {
			const cleaned = relative.replace(/\\/g, '/').replace(/^\.\//, '').trim();
			if (!cleaned) return null;

			// "../Textures/x.png" resolved against the model's own directory.
			const upLevels = (cleaned.match(/^(\.\.\/)+/)?.[0].length ?? 0) / 3;
			const withoutUp = cleaned.replace(/^(\.\.\/)+/, '');
			const dirParts = dir ? dir.split('/') : [];
			const climbed = dirParts.slice(0, Math.max(0, dirParts.length - upLevels)).join('/');

			const candidates = [
				dir ? `${dir}/${cleaned}` : cleaned, // beside the model
				climbed ? `${climbed}/${withoutUp}` : withoutUp, // after ../ climbing
				withoutUp // relative to the library root
			];

			for (const candidate of candidates) {
				const file = await this.#readPath(candidate);
				if (file) return file;
			}

			// Last resort: the same filename anywhere in the library. Only trust
			// it when it's unambiguous, so we don't hand back the wrong texture.
			const base = withoutUp.split('/').pop()?.toLowerCase() ?? '';
			const matches = this.byBasename.get(base);
			if (matches?.length === 1) return this.#readPath(matches[0]);
			return null;
		};
	}

	/** Folder tree for the gallery sidebar, derived from entry paths. */
	folders(): string[] {
		const set = new Set<string>();
		for (const e of this.entries) {
			const parts = e.path.split('/');
			parts.pop();
			let acc = '';
			for (const part of parts) {
				acc = acc ? `${acc}/${part}` : part;
				set.add(acc);
			}
		}
		return [...set].sort();
	}
}

/**
 * Fallback for Firefox/Safari: one-shot folder read, no persistence. Returns
 * every file rather than just models, because textures and .mtl files still
 * need to be resolvable — see ModelLibrary.useFallbackFiles().
 */
export function pickFolderFallback(): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		input.setAttribute('webkitdirectory', '');
		input.onchange = () => resolve([...(input.files ?? [])]);
		input.click();
	});
}

/**
 * Drag a file or folder from the OS onto the canvas. In Chromium this yields
 * real handles, so a dropped folder can be added to the library permanently.
 */
export async function handlesFromDrop(ev: DragEvent): Promise<FileSystemHandle[]> {
	const items = [...(ev.dataTransfer?.items ?? [])];
	const out: FileSystemHandle[] = [];
	for (const item of items) {
		if (item.kind !== 'file') continue;
		// @ts-expect-error — Chromium only
		if (typeof item.getAsFileSystemHandle === 'function') {
			// @ts-expect-error
			const h = await item.getAsFileSystemHandle();
			if (h) out.push(h);
		}
	}
	return out;
}
