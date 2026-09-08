<script lang="ts">
	/**
	 * 2D outline editor for lathe silhouettes and extrude shapes. Same
	 * Profile type; the kind changes clamping, mirroring, and presets.
	 */
	import {
		anchors,
		insertAnchor,
		isAnchorSmooth,
		moveAnchor,
		openEnds,
		profileBounds,
		profileToPoints,
		removeAnchor,
		setAnchorSmooth,
		v2,
		PROFILE_PRESETS,
		SHAPE_PRESETS
	} from '$lib/propsize/core/profile';
	import type { Profile, Vec2 } from '$lib/propsize/core/types';

	let {
		profile,
		kind = 'lathe',
		onchange
	}: {
		profile: Profile;
		kind?: 'lathe' | 'shape';
		/** `key` coalesces a drag into one undo entry; null starts a fresh one. */
		onchange: (next: Profile, key: string | null) => void;
	} = $props();

	const W = 260;
	const H = 210;
	const PAD = 14;
	const isLathe = $derived(kind === 'lathe');
	const presets = $derived(isLathe ? PROFILE_PRESETS : SHAPE_PRESETS);
	const axisFields = $derived<[keyof Vec2, string][]>(
		isLathe
			? [
					['x', 'Radius'],
					['y', 'Height']
				]
			: [
					['x', 'X'],
					['y', 'Y']
				]
	);

	let selected = $state(0);
	let dragging = $state<number | null>(null);
	let svgEl = $state<SVGSVGElement | null>(null);

	let pts = $derived(anchors(profile));
	let flat = $derived(profileToPoints(profile, 16));
	let ends = $derived(openEnds(profile));
	let closedOutline = $derived(
		profile.closed !== false && flat.length > 2
			? [...flat, flat[0]]
			: flat
	);

	let view = $derived.by(() => {
		const b = profileBounds(profile);
		const up = (v: number) => Math.ceil(v / 0.25) * 0.25;
		const down = (v: number) => Math.floor(v / 0.25) * 0.25;
		if (isLathe) {
			return {
				minX: 0,
				maxX: Math.max(0.25, up(b.maxX)),
				minY: Math.min(0, down(b.minY)),
				maxY: Math.max(Math.min(0, down(b.minY)) + 0.25, up(b.maxY))
			};
		}
		const minX = down(Math.min(b.minX, 0));
		const maxX = up(Math.max(b.maxX, 0));
		const minY = down(Math.min(b.minY, 0));
		const maxY = up(Math.max(b.maxY, 0.25));
		return { minX, maxX, minY, maxY };
	});

	let scale = $derived(
		isLathe
			? Math.min(
					(W / 2 - PAD) / Math.max(view.maxX, 0.01),
					(H - PAD * 2) / Math.max(view.maxY - view.minY, 0.01)
				)
			: Math.min(
					(W - PAD * 2) / Math.max(view.maxX - view.minX, 0.01),
					(H - PAD * 2) / Math.max(view.maxY - view.minY, 0.01)
				)
	);
	const sx = (x: number) =>
		isLathe ? W / 2 + x * scale : PAD + (x - view.minX) * scale;
	const sy = (y: number) => H - PAD - (y - view.minY) * scale;
	const ux = (px: number) =>
		isLathe ? (px - W / 2) / scale : (px - PAD) / scale + view.minX;
	const uy = (py: number) => (H - PAD - py) / scale + view.minY;

	let outline = $derived(closedOutline.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.x)} ${sy(p.y)}`).join(' '));
	let mirrored = $derived(flat.map((p, i) => `${i ? 'L' : 'M'} ${sx(-p.x)} ${sy(p.y)}`).join(' '));

	function toProfileSpace(e: PointerEvent): Vec2 {
		const rect = svgEl!.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * W;
		const py = ((e.clientY - rect.top) / rect.height) * H;
		let x = ux(px);
		let y = uy(py);
		if (isLathe) x = Math.max(0, x);
		return v2(x, y);
	}

	function onPointerDown(e: PointerEvent, i: number) {
		e.stopPropagation();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		selected = i;
		dragging = i;
	}
	function onPointerMove(e: PointerEvent) {
		if (dragging === null) return;
		onchange(moveAnchor(profile, dragging, toProfileSpace(e)), `profile:${dragging}`);
	}
	function onPointerUp(e: PointerEvent) {
		if (dragging !== null && (e.currentTarget as Element).hasPointerCapture?.(e.pointerId)) {
			(e.currentTarget as Element).releasePointerCapture(e.pointerId);
		}
		dragging = null;
	}

	function onOutlineClick(e: PointerEvent) {
		const at = toProfileSpace(e);
		let best = 0;
		let bestDist = Infinity;
		const segs = pts.length - 1 + (profile.closed ? 1 : 0);
		for (let i = 0; i < segs; i++) {
			const a = pts[i];
			const b = pts[(i + 1) % pts.length];
			const d = distanceToSegment(at, a, b);
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		}
		onchange(insertAnchor(profile, best, at), null);
		selected = best + 1;
	}

	function distanceToSegment(p: Vec2, a: Vec2, b: Vec2) {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = dx * dx + dy * dy;
		const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
		return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
	}

	function deleteSelected() {
		if (pts.length <= 2) return;
		onchange(removeAnchor(profile, selected), null);
		selected = Math.max(0, selected - 1);
	}
	function toggleSmooth() {
		onchange(setAnchorSmooth(profile, selected, !isAnchorSmooth(profile, selected)), null);
	}
	function snapToAxis(axis: 'x' | 'y') {
		const p = pts[selected];
		onchange(moveAnchor(profile, selected, axis === 'x' ? v2(0, p.y) : v2(p.x, 0)), null);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			deleteSelected();
		}
	}
</script>

<div class="section">
	<div class="section-title">Profile</div>
	<div class="prof-note">
		{#if isLathe}
			Draw one side of the object; it's spun around the dashed axis. <b>Drag</b> a point to move it,
			<b>click the outline</b> to add one.
		{:else}
			Draw a closed outline in the XY plane; it's extruded along Z. <b>Drag</b> a point to move it,
			<b>click the outline</b> to add one.
		{/if}
	</div>

	<svg
		class="prof-svg"
		bind:this={svgEl}
		viewBox="0 0 {W} {H}"
		role="application"
		tabindex="0"
		aria-label={isLathe ? 'Lathe profile editor' : 'Extrude profile editor'}
		onkeydown={onKeyDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
	>
		<line class="prof-ground" x1={PAD} y1={sy(0)} x2={W - PAD} y2={sy(0)} />
		<line class="prof-axis" x1={sx(0)} y1={PAD} x2={sx(0)} y2={H - PAD} />

		{#if isLathe}
			<path class="prof-mirror" d={mirrored} />
		{/if}
		<path class="prof-hit" d={outline} onpointerdown={onOutlineClick} role="presentation" />
		<path class="prof-line" d={outline} />

		{#each pts as p, i (i)}
			<circle
				class="prof-pt"
				class:selected={selected === i}
				class:smooth={isAnchorSmooth(profile, i)}
				cx={sx(p.x)}
				cy={sy(p.y)}
				r="5"
				role="button"
				tabindex="-1"
				aria-label="Point {i + 1}"
				onpointerdown={(e) => onPointerDown(e, i)}
			/>
		{/each}
	</svg>

	{#if isLathe && (ends.bottom || ends.top)}
		<div class="prof-warn">
			Open at the {ends.bottom && ends.top ? 'bottom and top' : ends.bottom ? 'bottom' : 'top'} — revolving
			this leaves a hollow shell you can see into. Move the end point onto the axis to close it.
		</div>
	{/if}

	<div class="prof-actions">
		<button class="btn sm" onclick={toggleSmooth}>
			{isAnchorSmooth(profile, selected) ? 'Make corner' : 'Make smooth'}
		</button>
		<button class="btn sm danger" onclick={deleteSelected} disabled={pts.length <= 2}>Delete</button>
	</div>
	<div class="prof-actions">
		<div class="act-group">
			<span class="act-group-label">{isLathe ? 'To axis' : 'Snap to 0'}</span>
			<button class="btn sm" onclick={() => snapToAxis('x')} title={isLathe ? 'Move this point onto the axis of revolution (radius 0)' : 'Set X to 0'}>
				X
			</button>
			<button class="btn sm" onclick={() => snapToAxis('y')} title="Move this point onto the ground line (Y = 0)">
				Y
			</button>
		</div>
	</div>

	<div class="field-label" style="margin-top:8px;"><span class="fname">Point {selected + 1} of {pts.length}</span></div>
	<div class="row3">
		{#each axisFields as [axis, label] (axis)}
			<div class="minifield">
				<label for="prof-{axis}">{label}</label>
				<input
					id="prof-{axis}"
					type="number"
					step="0.01"
					value={pts[selected]?.[axis] ?? 0}
					oninput={(e) => {
						const v = parseFloat((e.currentTarget as HTMLInputElement).value);
						if (!Number.isFinite(v)) return;
						const cur = pts[selected];
						const x = axis === 'x' ? (isLathe ? Math.max(0, v) : v) : cur.x;
						const y = axis === 'y' ? v : cur.y;
						onchange(moveAnchor(profile, selected, v2(x, y)), `profile:${axis}`);
					}}
				/>
			</div>
		{/each}
	</div>

	<div class="field-label" style="margin-top:10px;"><span class="fname">Start from</span></div>
	<div class="prof-presets">
		{#each presets as preset (preset.id)}
			<button
				class="btn sm"
				onclick={() => {
					onchange(preset.make(), null);
					selected = 0;
				}}
			>
				{preset.label}
			</button>
		{/each}
	</div>
</div>
