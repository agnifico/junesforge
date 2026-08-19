/**
 * Import-time UX decisions shared by every "add a model to the scene" call
 * site: an OBJ that can't find its .mtl gets a chance to locate it by hand,
 * and a model that bundles more than one named object gets a chance to come
 * in as separate, independently editable nodes instead of one opaque blob.
 * Both decisions go through the generic prompt popup (editorStore.prompt)
 * rather than each call site rolling its own dialog — see PromptModal.svelte.
 */
import { editorStore } from '../core/editor.svelte';
import {
	importModel,
	normalizeImport,
	listImportParts,
	type ImportResult,
	type ImportPart,
	type SiblingResolver
} from './loaders';

export type ImportDecision =
	| { split: false; result: ImportResult }
	| { split: true; result: ImportResult; parts: ImportPart[] };

/** A transient, invisible file input — the standard way to open a native file
 *  picker outside of a `<input>` already in the DOM. Resolves to [] both when
 *  the user cancels and (as a last-ditch fallback) if neither the `cancel`
 *  nor `change` event ever fires. */
function pickFiles(accept: string): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.multiple = true;
		input.style.display = 'none';
		const done = (files: File[]) => {
			input.remove();
			resolve(files);
		};
		input.addEventListener('change', () => done(Array.from(input.files ?? [])), { once: true });
		input.addEventListener('cancel', () => done([]), { once: true });
		document.body.appendChild(input);
		input.click();
	});
}

/** Wraps a base resolver, falling back to a hand-picked batch of files by
 *  exact name and then by basename — the same matching rule local-import.ts
 *  uses for a dropped/selected batch. */
function mergeResolver(base: SiblingResolver | undefined, extra: File[]): SiblingResolver {
	const byName = new Map(extra.map((f) => [f.name, f] as const));
	return async (relativePath: string) => {
		const direct = (await base?.(relativePath)) ?? null;
		if (direct) return direct;
		if (byName.has(relativePath)) return byName.get(relativePath)!;
		const basename = relativePath.split(/[\\/]/).pop();
		return (basename && byName.get(basename)) || null;
	};
}

function namesPreview(parts: ImportPart[], max = 4): string {
	const names = parts.map((p) => p.name);
	if (names.length <= max) return names.join(', ');
	return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

/**
 * Runs the missing-.mtl and multi-object prompts for one just-loaded model,
 * re-importing if the user locates a material file, and returns a
 * ready-to-place (already normalized) result plus the split decision.
 * Every "add this model" call site should route through here rather than
 * calling engine.addImportedObject(Split) directly off a raw ImportResult.
 */
export async function finalizeImport(
	result: ImportResult,
	file: File,
	resolveSibling?: SiblingResolver
): Promise<ImportDecision> {
	let current = result;

	if (current.missingMtl) {
		const choice = await editorStore.prompt({
			title: 'Missing material file',
			body: `"${file.name}" references ${current.missingMtl}, which wasn't found beside it. Locate it to bring in its colours, or import without them.`,
			choices: [
				{ label: 'Import without colours', value: 'skip' },
				{ label: 'Locate file…', value: 'locate', primary: true }
			]
		});
		if (choice === 'locate') {
			const picked = await pickFiles('.mtl,image/*');
			if (picked.length) current = await importModel(file, mergeResolver(resolveSibling, picked));
		}
	}

	const parts = listImportParts(current.object);
	let split = false;
	if (parts.length > 1) {
		const choice = await editorStore.prompt({
			title: `${parts.length} objects found`,
			body: `"${file.name}" contains ${parts.length} separate objects (${namesPreview(parts)}). Import them as one combined model, or keep them separate so each can be moved, hidden or recoloured on its own?`,
			choices: [
				{ label: 'Keep merged', value: 'merged' },
				{ label: `Split into ${parts.length}`, value: 'split', primary: true }
			]
		});
		split = choice === 'split';
	}

	// One normalization point for every call site — centering/grounding/scale
	// happens exactly once, here, rather than being duplicated (and easy to
	// double-apply) at each caller.
	normalizeImport(current.object);
	return split ? { split: true, result: current, parts } : { split: false, result: current };
}
