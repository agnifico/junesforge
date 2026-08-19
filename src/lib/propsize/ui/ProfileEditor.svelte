<script lang="ts">
	/**
	 * The 2D outline editor behind the lathe (and, later, shape and extrude —
	 * they read the same profile).
	 *
	 * SVG rather than canvas: hit-testing, hover states and focus rings come for
	 * free, and the whole thing stays inspectable in devtools.
	 *
	 * The view auto-fits the outline but rounds its bounds to a quarter unit, so
	 * dragging a point nudges the shape without the whole canvas rescaling
	 * underneath your cursor.
	 */
	import { editorStore } from '$lib/propsize/core/editor.svelte';
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
		PROFILE_PRESETS
	} from '$lib/propsize/core/profile';
	import type { Profile, Vec2 } from '$lib/propsize/core/types';

	let {
		profile,
		onchange
	}: {
		profile: Profile;
		/** `key` coalesces a drag into one undo entry; null starts a fresh one. */
		onchange: (next: Profile, key: string | null) => void;
	} = $props();

	const W = 260;
	const H = 210;
	const PAD = 14;

	let selected = $state(0);
	let dragging = $state<number | null>(null);
	let svgEl = $state<SVGSVGElement | null>(null);

	let pts = $derived(anchors(profile));
	let flat = $derived(profileToPoints(profile, 16));
	let ends = $derived(openEnds(profile));

	// Rounded-out bounds keep the view still while points move inside it.
	let view = $derived.by(() => {
		const b = profileBounds(profile);
		const up = (v: number) => Math.ceil(v / 0.25) * 0.25;
		const down = (v: number) => Math.floor(v / 0.25) * 0.25;
		return {
			maxX: Math.max(0.25, up(b.maxX)),
			minY: Math.min(0, down(b.minY)),
			maxY: Math.max(Math.min(0, down(b.minY)) + 0.25, up(b.maxY))
		};
	});

	// Profile space -> SVG space. y is flipped so up is up, and the axis sits in
	// the middle rather than against the left edge — that's what makes room for
	// the mirrored ghost, and seeing both halves is most of what makes a
	// silhouette read as the object it will become.
	let scale = $derived(
		Math.min((W / 2 - PAD) / Math.max(view.maxX, 0.01), (H - PAD * 2) / Math.max(view.maxY - view.minY, 0.01))
	);
	const sx = (x: number) => W / 2 + x * scale;
	const sy = (y: number) => H - PAD - (y - view.minY) * scale;
	const ux = (px: number) => (px - W / 2) / scale;
	const uy = (py: number) => (H - PAD - py) / scale + view.minY;

	let outline = $derived(flat.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.x)} ${sy(p.y)}`).join(' '));
	/** Mirrored across the axis — a preview of what revolving will produce. */
	let mirrored = $derived(flat.map((p, i) => `${i ? 'L' : 'M'} ${sx(-p.x)} ${sy(p.y)}`).join(' '));

	function toProfileSpace(e: PointerEvent): Vec2 {
		const rect = svgEl!.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * W;
		const py = ((e.clientY - rect.top) / rect.height) * H;
		// The 3D viewport's snap amount (often 0.5 units) is coarse next to a
		// profile that's typically under 1 unit across — applying it here made
		// dragging a point feel like it was fighting you, jumping between the
		// two nearest multiples rather than landing where the cursor was. This
		// editor has its own precise way to land exactly on the axis: the "To
		// axis" buttons below.
		let x = ux(px);
		let y = uy(py);
		// x is a radius; letting it go negative folds the surface inside out.
		return v2(Math.max(0, x), y);
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

	/** Click the outline to drop a point into the segment nearest the cursor. */
	function onOutlineClick(e: PointerEvent) {
		const at = toProfileSpace(e);
		let best = 0;
		let bestDist = Infinity;
		for (let i = 0; i < pts.length - 1; i++) {
			const d = distanceToSegment(at, pts[i], pts[i + 1]);
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
	/** Places the selected point exactly on one axis — X onto the axis of
	 *  revolution (radius 0, closing the surface), Y onto the ground line
	 *  (height 0) — precision a free-hand drag can't reliably hit. */
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
		Draw one side of the object; it's spun around the dashed axis. <b>Drag</b> a point to move it,
		<b>click the outline</b> to add one.
	</div>

	<svg
		class="prof-svg"
		bind:this={svgEl}
		viewBox="0 0 {W} {H}"
		role="application"
		tabindex="0"
		aria-label="Lathe profile editor"
		onkeydown={onKeyDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
	>
		<!-- ground line and axis of revolution — inset by PAD like everything
		     else drawn here, so the origin they cross sits with some room
		     around it instead of running the guides flush to the panel's
		     rounded corners. -->
		<line class="prof-ground" x1={PAD} y1={sy(0)} x2={W - PAD} y2={sy(0)} />
		<line class="prof-axis" x1={sx(0)} y1={PAD} x2={sx(0)} y2={H - PAD} />

		<path class="prof-mirror" d={mirrored} />
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

	{#if ends.bottom || ends.top}
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
			<span class="act-group-label">To axis</span>
			<button class="btn sm" onclick={() => snapToAxis('x')} title="Move this point onto the axis of revolution (radius 0)">
				X
			</button>
			<button class="btn sm" onclick={() => snapToAxis('y')} title="Move this point onto the ground line (height 0)">
				Y
			</button>
		</div>
	</div>

	<div class="field-label" style="margin-top:8px;"><span class="fname">Point {selected + 1} of {pts.length}</span></div>
	<div class="row3">
		{#each [['x', 'Radius'], ['y', 'Height']] as const as [axis, label] (axis)}
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
						onchange(
							moveAnchor(profile, selected, axis === 'x' ? v2(Math.max(0, v), cur.y) : v2(cur.x, v)),
							`profile:${axis}`
						);
					}}
				/>
			</div>
		{/each}
	</div>

	<div class="field-label" style="margin-top:10px;"><span class="fname">Start from</span></div>
	<div class="prof-presets">
		{#each PROFILE_PRESETS as preset (preset.id)}
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
