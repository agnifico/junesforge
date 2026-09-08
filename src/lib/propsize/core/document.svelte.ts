/**
 * Document store + undo history.
 *
 * A note on history, since I argued for a command pattern earlier and am
 * revising that: because binary assets live outside the document, a full
 * snapshot is just a few KB of JSON even for a large scene. Snapshots are
 * simpler, impossible to get subtly wrong (a command with a buggy revert
 * corrupts state silently), and already proven in the prototype. Commands only
 * start to pay off in the thousands of nodes. Snapshot until measurement says
 * otherwise.
 */

import type {
	Asset,
	GroupNode,
	ImportedNode,
	MaterialSpec,
	MeshNode,
	PrimitiveNode,
	PrimitiveType,
	PropsizeDoc,
	SceneNode,
	TextureSpec,
	Vec3
} from './types';
import { emptyDoc, isAuthoredMesh, isGroup, isImported, isMeshNode, isPrimitive } from './types';
import { GEO_DEFS, defaultGroundY } from './geometry';
import { defaultMaterial, defaultTexture, shadeColor } from './materials';
import { randomPaletteColor } from './palette';
import { defaultTransform, round3 } from './utils';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 900;

/** One undo step. See `DocumentStore.#snapshot` for why assets are held apart
 *  from the JSON rather than serialised into it. */
type Snapshot = { json: string; assets: Record<string, Asset> };

/**
 * Names the original/copy pair for a top-level duplicate.
 *
 * "Object" duplicated for the first time promotes the original to "Object 1"
 * and names the copy "Object 2" — the number only shows up once there's
 * something to distinguish. Duplicating an already-numbered "Object 2" just
 * increments to "Object 3"; the original keeps its name. Either way, if the
 * natural next name is already taken by some unrelated object, fall back to
 * "<base> <num> - <k>" rather than silently skipping ahead to a number that
 * would misleadingly suggest it was derived from that unrelated object.
 */
function duplicateNames(sourceName: string, isTaken: (name: string) => boolean) {
	const m = sourceName.match(/^(.*) (\d+)$/);
	if (m) {
		const base = m[1];
		const num = parseInt(m[2], 10);
		const plain = `${base} ${num + 1}`;
		if (!isTaken(plain)) return { renameOriginal: null as string | null, copyName: plain };
		let k = num + 1;
		let alt = `${base} ${num} - ${k}`;
		while (isTaken(alt)) alt = `${base} ${num} - ${++k}`;
		return { renameOriginal: null as string | null, copyName: alt };
	}
	const base = sourceName;
	const origCandidate = `${base} 1`;
	const copyCandidate = `${base} 2`;
	if (!isTaken(origCandidate) && !isTaken(copyCandidate)) {
		return { renameOriginal: origCandidate, copyName: copyCandidate };
	}
	let k = 2;
	let alt = `${base} 1 - ${k}`;
	while (isTaken(alt)) alt = `${base} 1 - ${++k}`;
	return { renameOriginal: isTaken(origCandidate) ? null : origCandidate, copyName: alt };
}

class DocumentStore {
	doc = $state<PropsizeDoc>(emptyDoc());
	selectedIds = $state<string[]>([]);

	// $state, not plain arrays: canUndo/canRedo below are getters that read
	// their .length, and only $state mutations (push/pop/length=0) notify
	// Svelte to re-evaluate expressions like the topbar's `disabled={...}`.
	#undo = $state<Snapshot[]>([]);
	#redo = $state<Snapshot[]>([]);
	#lastKey: string | null = null;
	#lastAt = 0;

	/** O(1) lookups. The prototype used nodes.find() inside loops — O(n²). */
	#index = $derived.by(() => {
		const m = new Map<string, SceneNode>();
		for (const n of this.doc.nodes) m.set(n.id, n);
		return m;
	});

	#childrenOf = $derived.by(() => {
		const m = new Map<string | null, SceneNode[]>();
		for (const n of this.doc.nodes) {
			const list = m.get(n.parentId) ?? [];
			list.push(n);
			m.set(n.parentId, list);
		}
		return m;
	});

	node(id: string): SceneNode | undefined {
		return this.#index.get(id);
	}
	children(id: string | null): SceneNode[] {
		return this.#childrenOf.get(id) ?? [];
	}
	descendants(id: string): SceneNode[] {
		const out: SceneNode[] = [];
		const walk = (pid: string) => {
			for (const c of this.children(pid)) {
				out.push(c);
				walk(c.id);
			}
		};
		walk(id);
		return out;
	}

	/** Selected nodes with no selected ancestor — the correct targets for transforms. */
	selectionRoots(): SceneNode[] {
		return this.rootsOf(this.selectedIds);
	}

	selectionMeshes(includeChildren = true): (PrimitiveNode | ImportedNode | MeshNode)[] {
		const seen = new Set<string>();
		const out: (PrimitiveNode | ImportedNode | MeshNode)[] = [];
		for (const id of this.selectedIds) {
			const n = this.node(id);
			if (!n) continue;
			const list = includeChildren ? [n, ...this.descendants(id)] : [n];
			for (const x of list) {
				if (isMeshNode(x) && !seen.has(x.id)) {
					seen.add(x.id);
					out.push(x);
				}
			}
		}
		return out;
	}

	// ---- history ----------------------------------------------------------
	/**
	 * Call BEFORE mutating. `key` coalesces rapid edits of one control into a
	 * single undo step, so dragging a slider doesn't produce 200 entries.
	 */
	mark(key: string | null = null) {
		const now = Date.now();
		if (key && key === this.#lastKey && now - this.#lastAt < COALESCE_MS) {
			this.#lastAt = now;
			return;
		}
		this.#lastKey = key;
		this.#lastAt = now;
		this.#undo.push(this.#snapshot());
		if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
		this.#redo.length = 0;
	}

	/**
	 * A history entry.
	 *
	 * The scene graph is small and gets a plain JSON round-trip. Assets are the
	 * opposite: `source.dataUrl` holds base64 model bytes, baked mesh payloads
	 * and embedded images, and serialising *those* into all hundred entries
	 * turned every `mark()` — every slider grab, every gizmo drag — into a
	 * multi-megabyte stringify, and the history itself into hundreds of
	 * megabytes of near-identical copies.
	 *
	 * So assets are stored structurally instead: each entry gets its own map
	 * (cheap — a few hundred bytes) whose values are the *same* `source`
	 * objects the document holds. That's safe precisely because nothing
	 * mutates a `source` in place; anything that changes an asset's bytes
	 * replaces the object wholesale (see `#commitMesh`), so an older entry
	 * keeps pointing at the older bytes. Copy-on-write, with no copying.
	 */
	#snapshot(): Snapshot {
		const assets: Record<string, Asset> = {};
		for (const id of Object.keys(this.doc.assets)) {
			const a = this.doc.assets[id];
			// Shallow copy: scalars by value, `source` deliberately by reference.
			assets[id] = { id: a.id, name: a.name, kind: a.kind, format: a.format, source: a.source, thumbnail: a.thumbnail };
		}
		return {
			json: JSON.stringify({
				version: this.doc.version,
				nodes: this.doc.nodes,
				materials: this.doc.materials,
				nextId: this.doc.nextId,
				selectedIds: this.selectedIds
			}),
			assets
		};
	}

	#restore(s: Snapshot) {
		const parsed = JSON.parse(s.json);
		this.doc = {
			version: parsed.version,
			nodes: parsed.nodes,
			materials: parsed.materials,
			nextId: parsed.nextId,
			assets: { ...s.assets }
		};
		this.selectedIds = parsed.selectedIds.filter((id: string) =>
			parsed.nodes.some((n: SceneNode) => n.id === id)
		);
	}

	get canUndo() { return this.#undo.length > 0; }
	get canRedo() { return this.#redo.length > 0; }

	undo() {
		const s = this.#undo.pop();
		if (!s) return;
		this.#redo.push(this.#snapshot());
		this.#restore(s);
		this.#lastKey = null;
	}
	redo() {
		const s = this.#redo.pop();
		if (!s) return;
		this.#undo.push(this.#snapshot());
		this.#restore(s);
		this.#lastKey = null;
	}
	resetHistory() {
		this.#undo = [];
		this.#redo = [];
		this.#lastKey = null;
	}

	// ---- mutations --------------------------------------------------------
	newId(prefix = 'n') {
		return `${prefix}${this.doc.nextId++}`;
	}

	/** Insert a node directly after `afterId` so it appears as an adjacent sibling. */
	insertNode(node: SceneNode, afterId?: string) {
		const i = afterId ? this.doc.nodes.findIndex((n) => n.id === afterId) : -1;
		if (i < 0) this.doc.nodes.push(node);
		else this.doc.nodes.splice(i + 1, 0, node);
	}

	/**
	 * Duplicate a subtree. The copy keeps two of three coordinates — only X is
	 * offset, by the source's own width so it lands beside rather than inside —
	 * and the top-level clone is inserted directly below its original. See
	 * `duplicateNames` for how the original and the copy get named.
	 *
	 * The two modes are deliberately absolute, with nothing shared halfway:
	 *
	 *  - **Copy** (`linked: false`) is a fully independent object. Geometry,
	 *    material and mesh data are all cloned, so nothing you do to either
	 *    copy can ever reach the other.
	 *  - **Link** (`linked: true`) shares *everything that describes the
	 *    object* — its shape and its paint — with every other member of the
	 *    same link group. Only the transform (position, rotation, scale) is
	 *    per-copy, because otherwise the copies would sit on top of each other
	 *    and there'd be no point to them.
	 *
	 * Link membership is symmetric: there is no "original". Editing any member
	 * updates the whole group, which is why breaking a link (see
	 * `DocumentStore.unlink`) has to be an explicit act rather than something
	 * an edit does behind your back.
	 */
	duplicate(id: string, widthOf: (id: string) => number, snap = 0, linked = false): string | null {
		const src = this.node(id);
		if (!src) return null;
		const isTaken = (name: string) => this.doc.nodes.some((n) => n.id !== id && n.name === name);
		const { renameOriginal, copyName } = duplicateNames(src.name, isTaken);

		const cloneInto = (srcId: string, parentId: string | null, sibling: boolean): string => {
			const s = this.node(srcId)!;
			const clone: SceneNode = structuredClone($state.snapshot(s)) as SceneNode;
			clone.id = this.newId();
			clone.parentId = parentId;
			clone.name = srcId === id ? copyName : `${s.name} copy`;
			if (linked) {
				// Join (or open) the source's link group. `clone` is a structural
				// copy of `s`, so it already points at the same materialId and
				// the same mesh/model assetId — which is exactly what shared
				// paint and shared shape mean. Nothing to clone, nothing to
				// re-point: leaving those references alone *is* the link.
				if (!s.dataLink) s.dataLink = this.newId('link');
				clone.dataLink = s.dataLink;
			} else {
				// A plain copy owes nothing to its source. Everything the node
				// points at gets its own instance, so the two can diverge
				// completely from this moment on.
				clone.dataLink = null;
				if (isAuthoredMesh(clone) && isAuthoredMesh(s)) {
					clone.assetId = this.cloneMeshAsset(s.assetId) ?? clone.assetId;
				}
				if (isPrimitive(clone) || isAuthoredMesh(clone)) {
					clone.materialId = this.#cloneMaterial(clone.materialId);
				} else if (isImported(clone) && clone.materialOverride) {
					clone.materialOverride = this.#cloneMaterial(clone.materialOverride);
				}
			}
			if (parentId === s.parentId) {
				const w = Math.max(0.5, widthOf(srcId));
				const step = snap > 0 ? Math.max(snap, Math.round(w / snap) * snap) : w;
				clone.transform.position.x = round3(s.transform.position.x + step);
			}
			this.insertNode(clone, sibling ? srcId : undefined);
			for (const c of this.children(srcId)) cloneInto(c.id, clone.id, false);
			return clone.id;
		};

		if (renameOriginal) src.name = renameOriginal;
		return cloneInto(id, src.parentId, true);
	}

	/** Every node in `link`, in document order. A group of one is a leftover
	 *  and gets cleaned up by `tidyLinks()`. */
	linkGroup(link: string | null): SceneNode[] {
		if (!link) return [];
		return this.doc.nodes.filter((n) => n.dataLink === link);
	}

	/** How many *other* nodes an edit to this one would also change. */
	linkedSiblingCount(node: SceneNode): number {
		if (!node.dataLink) return 0;
		return Math.max(0, this.linkGroup(node.dataLink).length - 1);
	}

	/**
	 * Take one node out of its link group, handing it private copies of
	 * everything the group was sharing so it keeps exactly the look it has
	 * right now and simply stops following the others.
	 */
	unlink(node: SceneNode): number {
		const link = node.dataLink;
		if (!link) return 0;
		const others = this.linkGroup(link).filter((n) => n.id !== node.id).length;
		if (isAuthoredMesh(node)) {
			node.assetId = this.cloneMeshAsset(node.assetId) ?? node.assetId;
		}
		if (isPrimitive(node) || isAuthoredMesh(node)) {
			node.materialId = this.#cloneMaterial(node.materialId);
		} else if (isImported(node) && node.materialOverride) {
			node.materialOverride = this.#cloneMaterial(node.materialOverride);
		}
		node.dataLink = null;
		this.tidyLinks();
		return others;
	}

	/** A link group with only one member left says "linked" in the UI and
	 *  propagates to nobody, which is just a lie. Drop those. */
	tidyLinks() {
		const counts = new Map<string, number>();
		for (const n of this.doc.nodes) {
			if (n.dataLink) counts.set(n.dataLink, (counts.get(n.dataLink) ?? 0) + 1);
		}
		for (const n of this.doc.nodes) {
			if (n.dataLink && (counts.get(n.dataLink) ?? 0) < 2) n.dataLink = null;
		}
	}

	/** Deep-copy a mesh asset (geometry payload included) and return the new
	 *  id, or null when there was nothing to copy. */
	cloneMeshAsset(id: string): string | null {
		const src = this.doc.assets[id];
		if (!src) return null;
		const nid = this.newId('mesh');
		const copy = structuredClone($state.snapshot(src)) as Asset;
		copy.id = nid;
		this.doc.assets[nid] = copy;
		return nid;
	}

	#cloneMaterial(id: string): string {
		const src = this.doc.materials[id];
		const nid = this.newId('m');
		this.doc.materials[nid] = src
			? (structuredClone($state.snapshot(src)) as MaterialSpec)
			: defaultMaterial();
		return nid;
	}

	remove(ids: string[]) {
		const doomed = new Set<string>();
		for (const id of ids) {
			doomed.add(id);
			for (const d of this.descendants(id)) doomed.add(d.id);
		}
		this.doc.nodes = this.doc.nodes.filter((n) => !doomed.has(n.id));
		// Deleting copies can leave a link group with a single member.
		this.tidyLinks();
		this.selectedIds = this.selectedIds.filter((id) => !doomed.has(id));
	}

	/**
	 * Move a node's slot in the flat array so it lands directly before
	 * `beforeId` (or last, when that's null). Sibling order is read off this
	 * array, so this is what "drop between these two rows" comes down to.
	 *
	 * Descendants aren't touched: they're located by parentId and keep their
	 * relative order, so the subtree travels with its root regardless of where
	 * the root's own slot ends up.
	 */
	moveInOrder(id: string, beforeId: string | null) {
		const from = this.doc.nodes.findIndex((n) => n.id === id);
		if (from < 0) return;
		const [node] = this.doc.nodes.splice(from, 1);
		const to = beforeId ? this.doc.nodes.findIndex((n) => n.id === beforeId) : -1;
		if (to < 0) this.doc.nodes.push(node);
		else this.doc.nodes.splice(to, 0, node);
	}

	/** The members of `ids` that have no ancestor also in `ids`, in document
	 *  order — the set a drag should actually move. */
	rootsOf(ids: string[]): SceneNode[] {
		const set = new Set(ids);
		return this.doc.nodes.filter((n) => {
			if (!set.has(n.id)) return false;
			let cur = n.parentId ? this.node(n.parentId) : undefined;
			while (cur) {
				if (set.has(cur.id)) return false;
				cur = cur.parentId ? this.node(cur.parentId) : undefined;
			}
			return true;
		});
	}

	/** True when this node, or any ancestor, is locked. */
	isLocked(id: string): boolean {
		let cur = this.node(id);
		while (cur) {
			if (cur.locked) return true;
			cur = cur.parentId ? this.node(cur.parentId) : undefined;
		}
		return false;
	}

	/** Reparent while preserving world position. `toLocal` is supplied by the
	 *  three.js layer, which owns the matrices. */
	reparent(id: string, newParentId: string | null, toLocal: (id: string, parentId: string | null) => Vec3 | null) {
		const n = this.node(id);
		if (!n || n.parentId === newParentId) return;
		n.parentId = newParentId;
		const local = toLocal(id, newParentId);
		if (local) n.transform.position = local;
	}
}

export const docStore = new DocumentStore();
