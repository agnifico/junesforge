<script lang="ts">
	/**
	 * Preferences that belong to the person rather than the scene: what the
	 * viewport looks like, how much of the chrome is showing, and the amounts
	 * behind the snap toggle. All of it persists to localStorage, separately
	 * from any saved session.
	 */
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import FieldToggle from './fields/FieldToggle.svelte';
	import FieldSegmented from './fields/FieldSegmented.svelte';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';

	let { engine }: { engine: SceneEngine } = $props();

	function set<K extends keyof typeof editorStore>(key: K, value: (typeof editorStore)[K]) {
		editorStore[key] = value;
		editorStore.persistSettings();
	}

	function num(e: Event, min: number, apply: (v: number) => void) {
		const v = parseFloat((e.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(v) || v < min) return;
		apply(v);
		editorStore.persistSettings();
	}
</script>

<div class="ps-pop settings-pop">
	<div class="pop-sec">
		<div class="pop-head"><span>Viewport</span></div>
		<div class="pop-row">
			<span class="pop-label">Background</span>
			<input
				class="pop-color"
				type="color"
				value={editorStore.bgColor}
				oninput={(e) => {
					engine.setBgColor((e.currentTarget as HTMLInputElement).value);
					editorStore.persistSettings();
				}}
			/>
			<span class="pop-meta mono">{editorStore.bgColor}</span>
		</div>
	</div>

	<div class="pop-sec">
		<div class="pop-head"><span>Lighting</span></div>
		<div class="pop-row">
			<span class="pop-label">Key light</span>
			<input
				class="pop-color"
				type="color"
				value={editorStore.lightColor}
				oninput={(e) => {
					engine.setLightColor((e.currentTarget as HTMLInputElement).value);
					editorStore.persistSettings();
				}}
			/>
			<input
				class="pop-num"
				type="number"
				step="0.05"
				min="0"
				max="5"
				value={editorStore.lightIntensity}
				oninput={(e) => num(e, 0, (v) => engine.setLightIntensity(v))}
			/>
		</div>
		<div class="pop-row">
			<span class="pop-label">Ambient</span>
			<input
				class="pop-num"
				type="number"
				step="0.05"
				min="0"
				max="5"
				value={editorStore.ambientIntensity}
				oninput={(e) => num(e, 0, (v) => engine.setAmbientIntensity(v))}
			/>
		</div>
		<div class="pop-row">
			<span class="pop-label">Azimuth</span>
			<input
				class="pop-num"
				type="number"
				step="1"
				value={editorStore.lightAzimuth}
				oninput={(e) => num(e, -Infinity, (v) => engine.setLightAngle(v, editorStore.lightElevation))}
			/>
			<span class="pop-unit">°</span>
		</div>
		<div class="pop-row">
			<span class="pop-label">Elevation</span>
			<input
				class="pop-num"
				type="number"
				step="1"
				min="1"
				max="89"
				value={editorStore.lightElevation}
				oninput={(e) => num(e, 1, (v) => engine.setLightAngle(editorStore.lightAzimuth, Math.min(89, v)))}
			/>
			<span class="pop-unit">°</span>
		</div>
		<div class="pop-note">Key light direction and brightness, plus the ambient fill that keeps shadows from going pure black.</div>
	</div>

	<div class="pop-sec">
		<div class="pop-head"><span>Navigation</span></div>
		<FieldToggle
			label="Orbit around selection"
			value={editorStore.orbitAroundSelection}
			onchange={(v) => set('orbitAroundSelection', v)}
		/>
		<div class="pop-note">
			Selecting something re-centres orbit/pan on it, like Blender's setting of the same name. Off, the pivot
			stays put until you pan or hit <b>F</b> to focus.
		</div>
	</div>

	<div class="pop-sec">
		<div class="pop-head"><span>Snapping</span></div>
		<div class="pop-note">
			Amounts used when snapping is on. Toggle it from the topbar or with <b>X</b>.
		</div>
		<div class="pop-row">
			<span class="pop-label">Distance</span>
			<input
				class="pop-num"
				type="number"
				step="0.05"
				min="0.01"
				value={editorStore.snapStep}
				oninput={(e) => num(e, 0.01, (v) => (editorStore.snapStep = v))}
			/>
			<span class="pop-unit">units</span>
		</div>
		<div class="pop-row">
			<span class="pop-label">Rotation</span>
			<input
				class="pop-num"
				type="number"
				step="1"
				min="1"
				value={editorStore.snapAngle}
				oninput={(e) => num(e, 1, (v) => (editorStore.snapAngle = v))}
			/>
			<span class="pop-unit">degrees</span>
		</div>
	</div>

	<div class="pop-sec">
		<div class="pop-head"><span>Drop to ground</span></div>
		<FieldSegmented
			label="Down is"
			value={editorStore.dropAxis}
			options={[
				{ value: 'y', label: 'Y' },
				{ value: 'x', label: 'X' },
				{ value: 'z', label: 'Z' }
			]}
			onchange={(v) => set('dropAxis', v as 'x' | 'y' | 'z')}
		/>
		<div class="pop-note">Which axis Drop to ground pushes along. Y is the usual one.</div>
	</div>

	<div class="pop-sec">
		<div class="pop-head"><span>Interface</span></div>
		<FieldToggle
			label="Keyboard shortcut strip"
			value={editorStore.showShortcutStrip}
			onchange={(v) => set('showShortcutStrip', v)}
		/>
		<FieldToggle
			label="Import JSON button"
			value={editorStore.showImportJson}
			onchange={(v) => set('showImportJson', v)}
		/>
		<div class="pop-note">
			Import JSON loads a raw Propsize document — an authoring escape hatch, off by default.
		</div>
	</div>
</div>
