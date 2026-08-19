/**
 * Import a batch of files picked/dropped together (not via the folder
 * library) — e.g. an .obj plus its .mtl and textures selected in one go.
 * Builds an in-memory sibling resolver over the batch by filename, so
 * importModel() can find an OBJ's materials without a persisted folder.
 */
import { importModel, type ImportResult, type SiblingResolver } from './loaders';

const MODEL_EXTENSIONS = ['glb', 'gltf', 'obj'];

export type LocalImportResult = ImportResult & { file: File; dataUrl: string };

function readAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

/** Inverse of readAsDataUrl() — reconstructs a File from an embedded asset's
 *  data URL so it can be re-run through importModel() (e.g. after a page
 *  reload, when doc.assets is restored from JSON but the in-memory
 *  THREE.Object3D template it referenced is gone). */
export function dataUrlToFile(dataUrl: string, name: string, format: string): File {
	const [header, base64] = dataUrl.split(',');
	const mime = header.match(/data:(.*);base64/)?.[1] ?? 'application/octet-stream';
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const filename = name.includes('.') ? name : `${name}.${format}`;
	return new File([bytes], filename, { type: mime });
}

/** OBJ/MTL directives sometimes carry a leading "./" or a subfolder the flat
 *  file-picker batch doesn't preserve — fall back to a basename match. */
export function buildSiblingResolver(files: File[]): SiblingResolver {
	const byName = new Map<string, File>();
	for (const f of files) byName.set(f.name, f);

	return async (relativePath: string) => {
		const direct = byName.get(relativePath);
		if (direct) return direct;
		const base = relativePath.split(/[\\/]/).pop();
		return (base && byName.get(base)) || null;
	};
}

export async function importFilesAsSiblings(files: File[]): Promise<LocalImportResult[]> {
	const resolveSibling = buildSiblingResolver(files);
	const modelFiles = files.filter((f) => MODEL_EXTENSIONS.includes(f.name.split('.').pop()?.toLowerCase() ?? ''));
	const results: LocalImportResult[] = [];
	for (const file of modelFiles) {
		const result = await importModel(file, resolveSibling);
		// Picked one-off (no persisted folder to re-read from later), so the
		// only durable reference we can save/export is the file's own bytes.
		// Normalization now happens once, in import-flow.ts's finalizeImport(),
		// after any missing-material prompt has had a chance to re-import —
		// applying it here too would double the centering/scale offset.
		const dataUrl = await readAsDataUrl(file);
		results.push({ ...result, file, dataUrl });
	}
	return results;
}
