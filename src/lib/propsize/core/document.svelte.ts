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
	PrimitiveNode,
	PrimitiveType,
	PropsizeDoc,
	SceneNode,
	TextureSpec,
	Vec3
} from './types';
import { emptyDoc, isGroup, isMeshNode, isPrimitive } from './types';
import { GEO_DEFS, defaultGroundY } from './geometry';
import { defaultMaterial, defaultTexture, shadeColor } from './materials';
import { randomPaletteColor } from './palette';
import { defaultTransform, round3 } from './utils';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 900;

class DocumentStore {
	doc = $state<PropsizeDoc>(emptyDoc());
	selectedIds = $state<string[]>([]);

	// $state, not plain arrays: canUndo/canRedo below are getters that read
	// their .length, and only $state mutations (push/pop/length=0) notify
	// Svelte to re-evaluate expressions like the topbar's `disabled={...}`.
	#undo = $state<string[]>([]);
	#redo = $state<string[]>([]);
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

	selectionMeshes(includeChildren = true) {
		const seen = new Set<string>();
		const out: SceneNode[] = [];
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

	#snapshot() {
		return JSON.stringify({ doc: this.doc, selectedIds: this.selectedIds });
	}
	#restore(s: string) {
		const parsed = JSON.parse(s);
		this.doc = parsed.doc;
		this.selectedIds = parsed.selectedIds.filter((id: string) =>
			parsed.doc.nodes.some((n: SceneNode) => n.id === id)
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
	 * and the top-level clone is inserted directly below its original.
	 */
	duplicate(id: string, widthOf: (id: string) => number, snap = 0): string | null {
		const src = this.node(id);
		if (!src) return null;

		const cloneInto = (srcId: string, parentId: string | null, sibling: boolean): string => {
			const s = this.node(srcId)!;
			const clone: SceneNode = structuredClone($state.snapshot(s)) as SceneNode;
			clone.id = this.newId();
			clone.parentId = parentId;
			clone.name = `${s.name} copy`;
			if (parentId === s.parentId) {
				const w = Math.max(0.5, widthOf(srcId));
				const step = snap > 0 ? Math.max(snap, Math.round(w / snap) * snap) : w;
				clone.transform.position.x = round3(s.transform.position.x + step);
			}
			this.insertNode(clone, sibling ? srcId : undefined);
			for (const c of this.children(srcId)) cloneInto(c.id, clone.id, false);
			return clone.id;
		};

		return cloneInto(id, src.parentId, true);
	}

	remove(ids: string[]) {
		const doomed = new Set<string>();
		for (const id of ids) {
			doomed.add(id);
			for (const d of this.descendants(id)) doomed.add(d.id);
		}
		this.doc.nodes = this.doc.nodes.filter((n) => !doomed.has(n.id));
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
