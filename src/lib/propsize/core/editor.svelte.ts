import type { MaterialSpec } from './types';
import { readLocal, writeLocal } from './storage';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type EditSelectMode = 'vertex' | 'edge' | 'face';
export type Axis = 'x' | 'y' | 'z';
export type TransformStyle = 'together' | 'each';

export type PromptChoice = { label: string; value: string; primary?: boolean; danger?: boolean };
export type PromptOptions = { title: string; body?: string; choices?: PromptChoice[] };

class EditorStore {
	gizmoMode = $state<GizmoMode>('translate');
	showGrid = $state(true);
	wireAll = $state(false);
	bgColor = $state('#202325');

	// ---- lighting ------------------------------------------------------------
	lightIntensity = $state(1.15);
	lightColor = $state('#fff2df');
	ambientIntensity = $state(0.85);
	/** Key light position, in degrees — 0° azimuth is +X, elevation is height
	 *  above the horizon. Matches the studio's original fixed light angle. */
	lightAzimuth = $state(34);
	lightElevation = $state(51);

	// ---- snapping ----------------------------------------------------------
	// One toggle, two editable amounts. Cycling through a fixed list of steps
	// meant the amount you wanted was often not on the list; the step is now a
	// setting and the button just turns it on and off.
	snapEnabled = $state(false);
	snapStep = $state(0.5);
	snapAngle = $state(15);

	// ---- navigation ----------------------------------------------------------
	/** Off by default, matching the traditional fixed-pivot orbit most 3D tools
	 *  ship with: selecting something doesn't itself move the view. On, the
	 *  pivot re-centres on whatever's selected (Blender's "Orbit Around
	 *  Selection") — see `#recenterOrbitOnSelection` in the scene engine. */
	orbitAroundSelection = $state(false);

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
	/** Multi-object rotate/scale: one pivot vs each object's own origin. */
	transformStyle = $state<TransformStyle>('together');
	/** Axes in the link group. Two or more on → those axes scale together. */
	scaleLink = $state({ x: false, y: false, z: false });
	/** Screen-space box select overlay, in viewport-local CSS pixels. */
	marquee = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	collapsed = $state<Set<string>>(new Set());
	exportOpen = $state(false);
	exportTab = $state<'code' | 'json' | 'r3f' | 'threlte'>('code');
	exportName = $state('MyProp');
	helpOpen = $state(false);
	libraryOpen = $state(false);
	leftPanelOpen = $state(true);
	rightPanelOpen = $state(true);
	leftTab = $state<'hierarchy' | 'library'>('hierarchy');
	/** Isolation is a view on one node, not a second document. Null = scene. */
	isolatedId = $state<string | null>(null);
	isolationTool = $state<'model' | 'paint'>('model');
	editSelectMode = $state<EditSelectMode>('vertex');
	modelProportional = $state(false);
	modelPropRadius = $state(1);
	toastMsg = $state('');
	materialClipboard = $state<MaterialSpec | null>(null);
	/** Dimensions copied off one object, ready to paste onto others. Same shape
	 *  as the material clipboard above, and deliberately the same interaction:
	 *  read a size off the thing that already fits, put it on the thing that
	 *  has to fit beside it. */
	dimensionClipboard = $state<{ x: number; y: number; z: number; from: string } | null>(null);
	recentColors = $state<string[]>([]);

	snapVal(v: number) {
		return this.snapEnabled ? Math.round(v / this.snapStep) * this.snapStep : v;
	}

	linkedScaleAxes(driver: Axis): Axis[] {
		const on = (['x', 'y', 'z'] as const).filter((a) => this.scaleLink[a]);
		if (on.length >= 2 && this.scaleLink[driver]) return [...on];
		return [driver];
	}

	toggleScaleLink(axis: Axis) {
		this.scaleLink = { ...this.scaleLink, [axis]: !this.scaleLink[axis] };
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
					orbitAroundSelection: this.orbitAroundSelection,
				dropAxis: this.dropAxis,
				lightIntensity: this.lightIntensity,
				lightColor: this.lightColor,
				ambientIntensity: this.ambientIntensity,
				lightAzimuth: this.lightAzimuth,
				lightElevation: this.lightElevation
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
			if (typeof s.orbitAroundSelection === 'boolean') this.orbitAroundSelection = s.orbitAroundSelection;
			if (s.dropAxis === 'x' || s.dropAxis === 'y' || s.dropAxis === 'z') this.dropAxis = s.dropAxis;
			if (Number.isFinite(s.lightIntensity) && s.lightIntensity >= 0) this.lightIntensity = s.lightIntensity;
			if (typeof s.lightColor === 'string') this.lightColor = s.lightColor;
			if (Number.isFinite(s.ambientIntensity) && s.ambientIntensity >= 0)
				this.ambientIntensity = s.ambientIntensity;
			if (Number.isFinite(s.lightAzimuth)) this.lightAzimuth = s.lightAzimuth;
			if (Number.isFinite(s.lightElevation)) this.lightElevation = s.lightElevation;
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

	/** A small generic popup for prompting/confirming/notifying — the one
	 *  dialog shape the rest of Propsize should reach for instead of rolling
	 *  its own modal. Resolves to the chosen button's `value`, or `null` if
	 *  dismissed (Escape / backdrop click); callers should treat `null` as
	 *  the safe, non-destructive default. */
	activePrompt = $state<{
		title: string;
		body: string;
		choices: PromptChoice[];
		resolve: (v: string | null) => void;
	} | null>(null);

	prompt(opts: PromptOptions): Promise<string | null> {
		return new Promise((resolve) => {
			this.activePrompt = {
				title: opts.title,
				body: opts.body ?? '',
				choices: opts.choices?.length ? opts.choices : [{ label: 'OK', value: 'ok', primary: true }],
				resolve
			};
		});
	}

	resolvePrompt(value: string | null) {
		const p = this.activePrompt;
		if (!p) return;
		this.activePrompt = null; // clear before resolving, in case the caller opens another prompt synchronously
		p.resolve(value);
	}
}

export const editorStore = new EditorStore();
