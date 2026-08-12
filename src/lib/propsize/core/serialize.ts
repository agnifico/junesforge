/**
 * Session persistence: serialize the document to JSON, restore it, and a
 * thin localStorage wrapper for explicit save/load plus a debounced
 * autosave. Kept separate from document.svelte.ts so the store itself stays
 * free of storage/IO concerns.
 */
import { docStore } from './document.svelte';
import { emptyDoc } from './types';
import { normalizeDoc } from './normalize';
import { readLocal, writeLocal } from './storage';

export function serializeProject(): string {
	return JSON.stringify(docStore.doc, null, 2);
}

/**
 * What the last load had to repair, as a human-readable list. Read it right
 * after a successful `loadProjectFromJSON`/`loadSession` — a document that
 * needed patching is worth mentioning, since saving will rewrite it in full.
 */
let lastRepairs: string[] = [];
export function lastLoadRepairs(): string[] {
	return lastRepairs;
}

/** Parses and installs a document. Returns false (leaving state untouched)
 *  on anything that doesn't look like a Propsize document.
 *
 *  Incoming JSON is never trusted field-for-field: it may predate a schema
 *  change or have been written by hand, and the inspector reads deep paths off
 *  it. normalizeDoc() fills the gaps so a sparse file opens instead of
 *  crashing the editor mid-render. */
export function loadProjectFromJSON(json: string): boolean {
	try {
		const result = normalizeDoc(JSON.parse(json));
		if (!result) throw new Error('bad format');
		lastRepairs = result.repairs;
		if (result.repairs.length) {
			console.warn('Propsize: repaired document on load —', result.repairs.join('; '));
		}
		docStore.doc = result.doc;
		docStore.selectedIds = [];
		docStore.resetHistory();
		return true;
	} catch (e) {
		lastRepairs = [];
		console.error('Propsize: could not load project', e);
		return false;
	}
}

export function newProject() {
	docStore.doc = emptyDoc();
	docStore.selectedIds = [];
	docStore.resetHistory();
}

// ---- localStorage ---------------------------------------------------------
//
// Two separate branches on purpose. The autosave writes constantly and is
// there to catch a crash or a closed tab; the numbered slots are the user's
// own checkpoints. Autosaving into a slot the user saved deliberately would
// destroy the thing they were keeping, so the two never touch each other.
const LEGACY_SESSION_KEY = 'propsize:session';
const AUTOSAVE_KEY = 'propsize:auto';
export const SLOT_COUNT = 2;
const slotKey = (n: number) => `propsize:slot${n}`;

/** Saved payloads carry their timestamp, so the menu can say how old they are. */
type Envelope = { savedAt: number; project: unknown };

export type SlotInfo = { savedAt: number; nodes: number };

function readEnvelope(key: string): { savedAt: number; json: string } | null {
	const raw = readLocal(key);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		// Older saves were the bare project, with no envelope around it.
		if (parsed && Array.isArray(parsed.nodes)) return { savedAt: 0, json: raw };
		if (parsed && parsed.project) {
			return { savedAt: Number(parsed.savedAt) || 0, json: JSON.stringify(parsed.project) };
		}
	} catch {
		/* fall through */
	}
	return null;
}

function writeEnvelope(key: string): boolean {
	const env: Envelope = { savedAt: Date.now(), project: JSON.parse(serializeProject()) };
	return writeLocal(key, JSON.stringify(env));
}

function infoFor(key: string): SlotInfo | null {
	const env = readEnvelope(key);
	if (!env) return null;
	try {
		const nodes = JSON.parse(env.json).nodes?.length ?? 0;
		return { savedAt: env.savedAt, nodes };
	} catch {
		return null;
	}
}

export function saveSlot(n: number): boolean {
	return writeEnvelope(slotKey(n));
}

export function loadSlot(n: number): boolean {
	// Slot 1 doubles as the home of any pre-slots save, so nobody loses work.
	const env = readEnvelope(slotKey(n)) ?? (n === 1 ? readEnvelope(LEGACY_SESSION_KEY) : null);
	return env ? loadProjectFromJSON(env.json) : false;
}

export function slotInfo(n: number): SlotInfo | null {
	return infoFor(slotKey(n)) ?? (n === 1 ? infoFor(LEGACY_SESSION_KEY) : null);
}

export function autosaveInfo(): SlotInfo | null {
	return infoFor(AUTOSAVE_KEY);
}

export function loadAutosave(): boolean {
	const env = readEnvelope(AUTOSAVE_KEY);
	return env ? loadProjectFromJSON(env.json) : false;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleAutosave(delay = 1500) {
	if (autosaveTimer) clearTimeout(autosaveTimer);
	autosaveTimer = setTimeout(() => writeEnvelope(AUTOSAVE_KEY), delay);
}
