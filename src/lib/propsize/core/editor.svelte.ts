import type { MaterialSpec } from './types';
import { readLocal, writeLocal } from './storage';

export type GizmoMode = 'translate' | 'rotate' | 'scale';

class EditorStore {
	gizmoMode = $state<GizmoMode>('translate');
	showGrid = $state(true);
	wireAll = $state(false);
	bgColor = $state('#202325');

	// ---- snapping ----------------------------------------------------------
	// One toggle, two editable amounts. Cycling through a fixed list of steps
	// meant the amount you wanted was often not on the list; the step is now a
	// setting and the button just turns it on and off.
	snapEnabled = $state(false);
	snapStep = $state(0.5);
	snapAngle = $state(15);

	// ---- settings ----------------------------------------------------------
	settingsOpen = $state(false);
	sessionOpen = $state(false);
	/** The hint strip along the bottom of the viewport. */
	showShortcutStrip = $state(true);
	/** Import JSON is an authoring escape hatch, not something most users need. */
	showImportJson = $state(false);
	/** Which way "down" is for Drop to ground. */
	dropAxis = $state<'x' | 'y' | 'z'>('y');
	inspectorTab = $state<'shape' | 'surface'>('shape');
	batchIncludeChildren = $state(true);
	collapsed = $state<Set<string>>(new Set());
	exportOpen = $state(false);
	exportTab = $state<'code' | 'json' | 'r3f' | 'threlte'>('code');
	exportName = $state('MyProp');
	helpOpen = $state(false);
	libraryOpen = $state(false);
	leftPanelOpen = $state(true);
	rightPanelOpen = $state(true);
	leftTab = $state<'hierarchy' | 'library'>('hierarchy');
	toastMsg = $state('');
	materialClipboard = $state<MaterialSpec | null>(null);
	recentColors = $state<string[]>([]);

	snapVal(v: number) {
		return this.snapEnabled ? Math.round(v / this.snapStep) * this.snapStep : v;
	}

	toggleSnap() {
		this.snapEnabled = !this.snapEnabled;
		this.persistSettings();
		this.toast(
			this.snapEnabled
				? `Snapping on — ${this.snapStep} units, ${this.snapAngle}° on rotate`
				: 'Snapping off — free movement'
		);
	}

	toggleCollapsed(id: string) {
		const next = new Set(this.collapsed);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		this.collapsed = next;
	}

	expandAncestors(nodeId: string, parentOf: (id: string) => string | null) {
		// Only reassign `collapsed` (a $state Set) when something actually
		// changes. Callers run this from an $effect that reads `collapsed`
		// indirectly (via this method); writing unconditionally would
		// invalidate that effect's own dependency on every call, looping
		// forever (effect_update_depth_exceeded).
		const next = new Set(this.collapsed);
		let changed = false;
		let cur = parentOf(nodeId);
		while (cur) {
			if (next.delete(cur)) changed = true;
			cur = parentOf(cur);
		}
		if (changed) this.collapsed = next;
	}

	// ---- persistence -------------------------------------------------------
	// Preferences, not documents: they follow the person rather than the scene,
	// so they live apart from the session slots.
	static readonly SETTINGS_KEY = 'propsize:settings';

	persistSettings() {
		writeLocal(
			EditorStore.SETTINGS_KEY,
			JSON.stringify({
					bgColor: this.bgColor,
					snapEnabled: this.snapEnabled,
					snapStep: this.snapStep,
					snapAngle: this.snapAngle,
					showShortcutStrip: this.showShortcutStrip,
					showImportJson: this.showImportJson,
				dropAxis: this.dropAxis
			})
		);
	}

	loadSettings() {
		try {
			const raw = readLocal(EditorStore.SETTINGS_KEY);
			if (!raw) return;
			const s = JSON.parse(raw);
			if (typeof s.bgColor === 'string') this.bgColor = s.bgColor;
			if (typeof s.snapEnabled === 'boolean') this.snapEnabled = s.snapEnabled;
			if (Number.isFinite(s.snapStep) && s.snapStep > 0) this.snapStep = s.snapStep;
			if (Number.isFinite(s.snapAngle) && s.snapAngle > 0) this.snapAngle = s.snapAngle;
			if (typeof s.showShortcutStrip === 'boolean') this.showShortcutStrip = s.showShortcutStrip;
			if (typeof s.showImportJson === 'boolean') this.showImportJson = s.showImportJson;
			if (s.dropAxis === 'x' || s.dropAxis === 'y' || s.dropAxis === 'z') this.dropAxis = s.dropAxis;
		} catch {
			/* ignore */
		}
	}

	pushRecentColor(c: string) {
		this.recentColors = [c, ...this.recentColors.filter((x) => x !== c)].slice(0, 8);
		writeLocal('propsize:recentColors', JSON.stringify(this.recentColors));
	}

	loadRecentColors() {
		try {
			const raw = readLocal('propsize:recentColors');
			if (raw) this.recentColors = JSON.parse(raw);
		} catch {
			/* ignore */
		}
	}

	/** Optional button rendered inside the toast, for problems the user can
	 *  actually act on (e.g. "textures missing — Reconnect folder"). */
	toastAction = $state<{ label: string; run: () => void } | null>(null);

	#toastTimer: ReturnType<typeof setTimeout> | null = null;
	toast(msg: string, action: { label: string; run: () => void } | null = null) {
		this.toastMsg = msg;
		this.toastAction = action;
		if (this.#toastTimer) clearTimeout(this.#toastTimer);
		// Actionable toasts linger, since dismissing one before it's read makes
		// the action unreachable.
		this.#toastTimer = setTimeout(
			() => {
				this.toastMsg = '';
				this.toastAction = null;
			},
			action ? 9000 : 1800
		);
	}

	dismissToast() {
		if (this.#toastTimer) clearTimeout(this.#toastTimer);
		this.toastMsg = '';
		this.toastAction = null;
	}
}

export const editorStore = new EditorStore();
