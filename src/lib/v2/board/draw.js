/* =============================================================
   BOARD DRAWING — paints board/layout.js on a 2D canvas, in an
   orthographic three-quarter view. A flat board with boxes on it
   needs nothing more than a projection and a back-to-front sort,
   so there is no WebGL here.
   Everything is in CSS pixels; the caller scales for the DPR.
   ============================================================= */

/* There is no board under the parts: they and their traces sit
   straight on the page, on whatever is behind the canvas. */

const TRACE = 'rgba(244, 244, 241, 0.2)';
const BED = 'rgba(0, 0, 0, 0.65)'; // the dark groove each trace is etched into
const PAD = 'rgba(244, 244, 241, 0.34)';
const PIN = 'rgba(184, 184, 176, 0.75)';
const MARK = 'rgba(244, 244, 241, 0.22)';
/* Materials, as [r, g, b]; every face is shaded from its own. */
const BODY = [29, 29, 28]; // packages
const CORE = [22, 22, 21]; // the processor's package, a shade deeper
const CELL = [40, 40, 39];
const MODULE = [46, 46, 45];
const CAP = [78, 78, 74];
const SLOT = [8, 8, 8];
const DIE = [24, 24, 23];
const SEAT = '#0b0c0b'; // the recess the die sits in
const RIM = 'rgba(255, 255, 255, 0.3)'; // where a top meets a side facing you
const BACK = 'rgba(255, 255, 255, 0.07)'; // the top's far edges
export const INK = 'rgba(4, 24, 15, 0.8)'; // lettering on the lit die

const A = [0, 0];
const O = [0, 0];
const U = [0, 0];
const N = [0, 0];
const LO = [[0, 0], [0, 0], [0, 0], [0, 0]];
const HI = [[0, 0], [0, 0], [0, 0], [0, 0]];
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // outward normals: N E S W

/* ---- view ---------------------------------------------------- */

/* az turns the board about the vertical, el tilts it toward the
   viewer (π/2 is straight down). (fx, fz) lands on (cx, cy). Every
   point except the processor's is drawn `pull` of the way from
   (px, pz) to where it really is: that is how the board folds. */
export function makeView(o) {
	return {
		ca: Math.cos(o.az),
		sa: Math.sin(o.az),
		se: Math.sin(o.el),
		ce: Math.cos(o.el),
		scale: o.scale,
		cx: o.cx,
		cy: o.cy,
		fx: o.fx,
		fz: o.fz,
		px: o.px,
		pz: o.pz,
		pull: o.pull
	};
}

/* Board point → screen. `k` is the pull: view.pull for everything
   but the processor, 1 for the processor itself. */
export function project(v, x, y, z, k, out) {
	if (k !== 1) {
		x = v.px + (x - v.px) * k;
		z = v.pz + (z - v.pz) * k;
	}
	const dx = x - v.fx;
	const dz = z - v.fz;
	out[0] = v.cx + v.scale * (dx * v.ca - dz * v.sa);
	out[1] = v.cy + v.scale * ((dx * v.sa + dz * v.ca) * v.se - y * v.ce);
	return out;
}

// Larger is nearer the viewer.
function depth(v, x, z) {
	return (x - v.fx) * v.sa + (z - v.fz) * v.ca;
}

/* Where to put the board so `b` (the whole of it unless given) fills
   W × H, and how far to zoom in when only the processor is left. */
export function fitBoard(m, az, el, W, H, b = m.bounds) {
	const fx = (b.x0 + b.x1) / 2;
	const fz = (b.z0 + b.z1) / 2;
	const v = makeView({ az, el, scale: 1, cx: 0, cy: 0, fx, fz, px: 0, pz: 0, pull: 1 });
	let x0 = Infinity;
	let x1 = -Infinity;
	let y0 = Infinity;
	let y1 = -Infinity;
	for (const x of [b.x0, b.x1]) {
		for (const z of [b.z0, b.z1]) {
			for (const y of [0, 4]) {
				project(v, x, y, z, 1, A);
				x0 = Math.min(x0, A[0]);
				x1 = Math.max(x1, A[0]);
				y0 = Math.min(y0, A[1]);
				y1 = Math.max(y1, A[1]);
			}
		}
	}
	const margin = Math.min(28, W * 0.04);
	const scale = Math.max(0.5, Math.min((W - 2 * margin) / (x1 - x0), (H - 2 * margin) / (y1 - y0)));
	return {
		scale,
		cx: W / 2 - (scale * (x0 + x1)) / 2,
		cy: H / 2 - (scale * (y0 + y1)) / 2,
		fx,
		fz,
		// the processor and its pins span about 26 units across in view
		coreScale: Math.max(scale * 1.2, (Math.min(W, H) * 0.58) / 26)
	};
}

/* ---- the opening --------------------------------------------- */

// 0 → 1 over `dur` seconds after `delay`, eased out; 1 once `intro`
// is Infinity (the opening is over).
function reveal(intro, delay, dur) {
	const t = (intro - delay) / dur;
	if (!(t < 1)) return 1;
	return t <= 0 ? 0 : 1 - (1 - t) ** 3;
}
// The board builds outward: the processor first, the radio last.
export const partIn = (intro, ring) => reveal(intro, 0.1 + 0.09 * ring, 0.45);
const laneIn = (intro, ring) => reveal(intro, 0.3 + 0.07 * ring, 0.5);

/* ---- the frame ----------------------------------------------- */

/* s = {
     alpha   every part and trace but the processor, 0–1; the
             pulses always run at full strength
     intro   seconds into the opening; Infinity once it is over
     pulses  [{ lane, p, dir, w }]: p runs 0–1 along the trace, dir
             +1 inner → outer and -1 outer → inner, w is brightness
     lit     { cell, lanes, cells } for the chip in focus, or null
     flash   per-chip glow from pulses arriving, 0–1
     glow    the processor's die, 0–1; it lights the parts round it
     fog     how much the parts furthest back fade, 0–1
     ping    0–1 through a ring spreading from the processor, or -1
     mark    { a, maker, name, part, logo }: lettering on the
             processor's lid, a is how strongly it shows, 0–1; with a
             logo (a canvas or image, already in the lid's ink) it is
             drawn in place of the lettering
     font    the family to letter it in
     em      the accent as [r, g, b]
     dpr
   } */
export function drawBoard(ctx, m, v, s) {
	const k = v.pull;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	if (s.alpha > 0.003) {
		ctx.globalAlpha = s.alpha;
		traces(ctx, v, m, s, k);
	}
	if (s.ping >= 0) ping(ctx, v, m, s);

	// the processor's light, on everything turned toward it
	const core = m.parts.find((p) => p.ring === 0);
	project(v, m.core.x, core.h, m.core.z, 1, A);
	const light = {
		x: m.core.x,
		z: m.core.z,
		g: s.glow * partIn(s.intro, 0),
		em: s.em,
		sx: A[0],
		sy: A[1],
		sr: v.scale * 30
	};

	const items = [];
	for (const p of m.parts) items.push({ d: depth(v, p.x, p.z), p });
	for (const c of m.caps) items.push({ d: depth(v, (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2), c });
	items.sort((a, b) => a.d - b.d);
	// the parts furthest back sink into the dark
	const near = items[items.length - 1].d;
	const far = items[0].d;
	const fog = (d) => 1 - (s.fog || 0) * 0.42 * (1 - (d - far) / (near - far || 1));
	for (const it of items) {
		if (it.p) part(ctx, v, m, it.p, s, light, fog(it.d));
		else if (s.alpha > 0.003) {
			ctx.globalAlpha = s.alpha * partIn(s.intro, 1) * fog(it.d);
			solid(ctx, v, it.c.x0, it.c.z0, it.c.x1, it.c.z1, 0, it.c.h, k, CAP, { light });
		}
	}
	bloom(ctx, light);

	if (s.lit && s.alpha > 0.003) {
		ctx.globalAlpha = s.alpha;
		bonds(ctx, v, m, s, k);
	}

	// the colour on the page: pulses over everything, however dim the rest
	if (s.pulses.length) {
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'lighter';
		ctx.lineCap = 'butt';
		const hot = mix(s.em, [255, 255, 255], 0.55);
		for (const q of s.pulses) pulse(ctx, v, m.lanes[q.lane], q, s.em, hot, k);
		ctx.lineCap = 'round';
		ctx.globalCompositeOperation = 'source-over';
	}
	ctx.globalAlpha = 1;
}

function traces(ctx, v, m, s, k) {
	// every trace (drawn out from its inner end as the board builds)
	ctx.beginPath();
	for (const L of m.lanes) {
		const r = laneIn(s.intro, L.ra);
		if (r > 0) along(ctx, v, L, k, 0, L.len * r);
	}
	const radio = partIn(s.intro, 5) > 0;
	if (radio) for (const t of m.antennas) poly(ctx, v, t.pts, k);
	ctx.strokeStyle = BED;
	ctx.lineWidth = 2.6;
	ctx.stroke();
	ctx.strokeStyle = TRACE;
	ctx.lineWidth = 0.9;
	ctx.stroke();

	// the pads they land on
	ctx.fillStyle = PAD;
	for (const L of m.lanes) {
		if (laneIn(s.intro, L.ra) < 1) continue;
		const n = L.pts.length;
		project(v, L.pts[0], 0, L.pts[1], k, A);
		ctx.fillRect(A[0] - 1, A[1] - 1, 2, 2);
		project(v, L.pts[n - 2], 0, L.pts[n - 1], k, A);
		ctx.fillRect(A[0] - 1, A[1] - 1, 2, 2);
	}
	if (radio) {
		for (const t of m.antennas) {
			const n = t.pts.length;
			disc(ctx, v, t.pts[n - 2], 0, t.pts[n - 1], 0.45, k);
			ctx.fill();
		}
	}

	// the chip in focus: its traces stay lit
	if (s.lit) {
		ctx.beginPath();
		for (const i of s.lit.lanes) along(ctx, v, m.lanes[i], k, 0, m.lanes[i].len);
		for (const t of m.antennas) if (t.cell === s.lit.cell) poly(ctx, v, t.pts, k);
		ctx.strokeStyle = rgba(s.em, 0.75);
		ctx.lineWidth = 1.5;
		ctx.stroke();
	}
}

/* A white-hot head with a tail fading behind it in three steps,
   each step a wide soft halo, a glow, and a hot core. */
function pulse(ctx, v, L, q, em, hot, k) {
	const tail = Math.min(14, L.len * 0.6);
	const head = q.dir > 0 ? L.len * q.p : L.len * (1 - q.p);
	const back = -q.dir;
	for (let j = 0; j < 3; j++) {
		const d0 = head + (back * tail * j) / 3;
		const d1 = head + (back * tail * (j + 1)) / 3;
		const lo = Math.max(0, Math.min(d0, d1));
		const hi = Math.min(L.len, Math.max(d0, d1));
		if (!(hi > lo)) continue;
		const w = q.w * (1 - j * 0.36);
		ctx.beginPath();
		along(ctx, v, L, k, lo, hi);
		ctx.strokeStyle = rgba(em, 0.1 * w);
		ctx.lineWidth = 9;
		ctx.stroke();
		ctx.strokeStyle = rgba(em, 0.4 * w);
		ctx.lineWidth = 3.2;
		ctx.stroke();
		ctx.strokeStyle = rgba(j ? em : hot, 0.95 * w);
		ctx.lineWidth = 1.4;
		ctx.stroke();
	}
	pointAt(L, head, A);
	project(v, A[0], 0, A[1], k, A);
	ctx.beginPath();
	ctx.arc(A[0], A[1], 7, 0, Math.PI * 2);
	ctx.fillStyle = rgba(em, 0.16 * q.w);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(A[0], A[1], 2.2, 0, Math.PI * 2);
	ctx.fillStyle = rgba(hot, q.w);
	ctx.fill();
}

// A square of light spreading out from the processor while it is alone.
function ping(ctx, v, m, s) {
	const r = 9 + s.ping * 26;
	const { x, z } = m.core;
	ctx.globalAlpha = (1 - s.ping) * 0.45;
	ctx.beginPath();
	project(v, x - r, 0, z - r, 1, A);
	ctx.moveTo(A[0], A[1]);
	project(v, x + r, 0, z - r, 1, A);
	ctx.lineTo(A[0], A[1]);
	project(v, x + r, 0, z + r, 1, A);
	ctx.lineTo(A[0], A[1]);
	project(v, x - r, 0, z + r, 1, A);
	ctx.lineTo(A[0], A[1]);
	ctx.closePath();
	ctx.strokeStyle = rgba(s.em, 1);
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.globalAlpha = 1;
}

function part(ctx, v, m, p, s, light, fog) {
	const core = p.ring === 0;
	const k = core ? 1 : v.pull;
	const r = partIn(s.intro, p.ring);
	const a = core ? r : s.alpha * r * fog;
	if (a <= 0.003) return;
	ctx.globalAlpha = a;

	const h = p.h * (0.15 + 0.85 * r); // rises as it appears
	const lift = h - p.h;
	shadow(ctx, v, p.x0, p.z0, p.x1, p.z1, k, s.dpr);
	if (p.kind === 'core' || p.kind === 'ctrl') pins(ctx, v, p, k);
	solid(ctx, v, p.x0, p.z0, p.x1, p.z1, 0, h, k, core ? CORE : BODY, { light: core ? null : light });

	if (p.kind === 'memory') {
		// modules stand in their slots; nearest drawn last
		const order = p.cells.slice().sort((x, y) => {
			const cx = m.cells[x];
			const cy = m.cells[y];
			return depth(v, cx.cx, cx.cz) - depth(v, cy.cx, cy.cz);
		});
		for (const i of order) {
			const c = m.cells[i];
			const t = tone(i, s);
			const top = h + (c.y1 - c.y0) * (0.15 + 0.85 * r);
			solid(ctx, v, c.x0, c.z0, c.x1, c.z1, h, top, k, mix(MODULE, s.em, t), {
				light,
				edge: t > 0.01 ? rgba(s.em, 0.5 + 0.5 * t) : null
			});
			module(ctx, v, c, h, top, k, t, s.em);
		}
		return;
	}

	ctx.fillStyle = MARK; // pin-one dot
	disc(ctx, v, p.x0 + 1.1, h, p.z0 + 1.1, 0.4, k);
	ctx.fill();
	for (const i of p.cells) {
		if (core) die(ctx, v, m.cells[i], s, lift);
		else chip(ctx, v, m.cells[i], s, k, lift, light);
	}
}

// A soft shadow pooled under a part, so it sits on the dark rather than floats.
function shadow(ctx, v, x0, z0, x1, z1, k, dpr) {
	ctx.save();
	flat(ctx, v, x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, 0, k);
	ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
	ctx.shadowBlur = v.scale * 2.4 * dpr;
	ctx.shadowOffsetY = v.scale * 0.7 * dpr;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
	ctx.fill();
	ctx.restore();
}

/* A chip set into a part's top: shaded back to front, bevelled (a
   lit back edge, a dark front one), and warmed by the processor's
   light. A port is a slot with a contact tongue in it. */
function chip(ctx, v, c, s, k, lift, light) {
	const t = tone(c.i, s);
	const y = c.y1 + lift;
	const mat = mix(CELL, s.em, t);
	flat(ctx, v, c.x0, c.z0, c.x1, c.z1, y, k);
	ctx.fillStyle = across(ctx, v, c.x0, c.z0, c.x1, c.z1, y, k, shade(mat, 1.3), shade(mat, 0.82));
	ctx.fill();
	spill(ctx, light);
	bevel(ctx, v, c.x0, c.z0, c.x1, c.z1, y, k, 'rgba(255, 255, 255, 0.16)', 'rgba(0, 0, 0, 0.6)');
	if (t > 0.01) {
		flat(ctx, v, c.x0, c.z0, c.x1, c.z1, y, k);
		ctx.strokeStyle = rgba(s.em, 0.4 + 0.6 * t);
		ctx.lineWidth = 1;
		ctx.stroke();
	}
	if (c.kind === 'ports') {
		flat(ctx, v, c.x0 + 0.4, c.z0 + 0.9, c.x1 - 0.4, c.z1 - 0.9, y, k);
		ctx.fillStyle = rgb(mix(SLOT, s.em, t * 0.6));
		ctx.fill();
		bevel(ctx, v, c.x0 + 0.4, c.z0 + 0.9, c.x1 - 0.4, c.z1 - 0.9, y, k, 'rgba(0, 0, 0, 0.7)', 'rgba(255, 255, 255, 0.12)');
		const mx = (c.x0 + c.x1) / 2;
		flat(ctx, v, mx - 0.25, c.z0 + 1.6, mx + 0.25, c.z1 - 1.6, y, k);
		ctx.fillStyle = t > 0.01 ? rgba(s.em, 0.5 + 0.5 * t) : 'rgba(150, 150, 142, 0.55)';
		ctx.fill();
	}
}

/* On the face of a memory module you can see: three chips, and its
   contacts along the slot in the accent. */
function module(ctx, v, c, y0, y1, k, t, em) {
	if (Math.abs(v.sa) < 0.08 || y1 - y0 < 1) return;
	const x = v.sa < 0 ? c.x0 : c.x1;
	const span = c.z1 - c.z0;
	const face = (za, zb, ya, yb) => {
		ctx.beginPath();
		project(v, x, ya, za, k, A);
		ctx.moveTo(A[0], A[1]);
		project(v, x, ya, zb, k, A);
		ctx.lineTo(A[0], A[1]);
		project(v, x, yb, zb, k, A);
		ctx.lineTo(A[0], A[1]);
		project(v, x, yb, za, k, A);
		ctx.lineTo(A[0], A[1]);
		ctx.closePath();
	};
	for (let j = 0; j < 3; j++) {
		const za = c.z0 + 0.9 + (j * (span - 1.8)) / 3;
		face(za + 0.25, za + (span - 1.8) / 3 - 0.25, y0 + 0.75, y1 - 0.45);
		ctx.fillStyle = '#0d0d0c';
		ctx.fill();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
		ctx.lineWidth = 0.8;
		ctx.stroke();
	}
	face(c.z0 + 0.6, c.z1 - 0.6, y0 + 0.08, y0 + 0.32);
	ctx.fillStyle = rgba(em, 0.3 + 0.6 * t);
	ctx.fill();
}

/* The processor's die, sat in a dark recess in its lid: lit from
   within, brightest at the centre, tiled like silicon, with a sheen
   across it. */
function die(ctx, v, c, s, lift) {
	const y = c.y1 + lift;
	const g = Math.max(s.glow, tone(c.i, s));
	flat(ctx, v, c.x0 - 1.1, c.z0 - 1.1, c.x1 + 1.1, c.z1 + 1.1, y - 0.02, 1);
	ctx.fillStyle = SEAT;
	ctx.fill();
	bevel(ctx, v, c.x0 - 1.1, c.z0 - 1.1, c.x1 + 1.1, c.z1 + 1.1, y - 0.02, 1, 'rgba(0, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.18)');

	const lit = mix(DIE, s.em, 0.12 + 0.88 * g);
	project(v, c.cx, y, c.cz, 1, O);
	project(v, c.x0, y, c.z0, 1, U);
	const reach = Math.hypot(U[0] - O[0], U[1] - O[1]);
	const fill = ctx.createRadialGradient(O[0], O[1], 0, O[0], O[1], reach);
	fill.addColorStop(0, rgb(mix(lit, [255, 255, 255], 0.28 * g)));
	fill.addColorStop(1, rgb(mix(DIE, s.em, 0.12 + 0.66 * g)));
	flat(ctx, v, c.x0, c.z0, c.x1, c.z1, y, 1);
	ctx.save();
	ctx.shadowColor = rgba(s.em, 0.6 * g);
	ctx.shadowBlur = 34 * g * s.dpr;
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.restore();

	ctx.save();
	ctx.clip();
	ctx.beginPath();
	for (let j = 1; j < 4; j++) {
		const x = c.x0 + ((c.x1 - c.x0) * j) / 4;
		const z = c.z0 + ((c.z1 - c.z0) * j) / 4;
		project(v, x, y, c.z0, 1, A);
		ctx.moveTo(A[0], A[1]);
		project(v, x, y, c.z1, 1, A);
		ctx.lineTo(A[0], A[1]);
		project(v, c.x0, y, z, 1, A);
		ctx.moveTo(A[0], A[1]);
		project(v, c.x1, y, z, 1, A);
		ctx.lineTo(A[0], A[1]);
	}
	const lettered = s.mark ? s.mark.a : 0;
	ctx.strokeStyle = `rgba(0, 0, 0, ${0.22 * (1 - 0.8 * lettered)})`; // tiles give way to the lettering
	ctx.lineWidth = 1;
	ctx.stroke();
	// a band of sheen corner to corner
	project(v, c.x1, y, c.z1, 1, N);
	const sheen = ctx.createLinearGradient(U[0], U[1], N[0], N[1]);
	sheen.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
	sheen.addColorStop(0.44, 'rgba(255, 255, 255, 0.13)');
	sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
	sheen.addColorStop(0.62, 'rgba(255, 255, 255, 0)');
	ctx.fillStyle = sheen;
	ctx.fillRect(Math.min(U[0], N[0]) - reach, Math.min(U[1], N[1]) - reach, 4 * reach, 4 * reach);
	ctx.restore();

	flat(ctx, v, c.x0, c.z0, c.x1, c.z1, y, 1);
	ctx.strokeStyle = rgba(mix(s.em, [255, 255, 255], 0.4), 0.55 * g);
	ctx.lineWidth = 1;
	ctx.stroke();
	if (lettered > 0.01) etch(ctx, v, c, y, s);
}

// The processor's light, spread over the space round it.
function bloom(ctx, L) {
	if (L.g < 0.01) return;
	ctx.save();
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'lighter';
	const g = ctx.createRadialGradient(L.sx, L.sy, 0, L.sx, L.sy, L.sr * 0.6);
	g.addColorStop(0, rgba(L.em, 0.16 * L.g));
	g.addColorStop(0.4, rgba(L.em, 0.05 * L.g));
	g.addColorStop(1, rgba(L.em, 0));
	ctx.fillStyle = g;
	ctx.fillRect(L.sx - L.sr, L.sy - L.sr, 2 * L.sr, 2 * L.sr);
	ctx.restore();
}

/* Lettered on the lid like a real part, in the die's own plane so
   it tilts and turns with the board: the maker and part number
   small, the name large, each shrunk to fit the die if it has to. */
function etch(ctx, v, c, y, s) {
	project(v, c.cx, y, c.cz, 1, O);
	project(v, c.cx + 1, y, c.cz, 1, U);
	project(v, c.cx, y, c.cz + 1, 1, N);
	const ux = U[0] - O[0];
	const uy = U[1] - O[1];
	const nx = N[0] - O[0];
	const ny = N[1] - O[1];
	const room = (c.x1 - c.x0) * 0.82; // the widest a line may run, in board units
	// `size` and `at` (how far south of the die's centre) in board units
	const line = (text, weight, size, at) => {
		ctx.font = `${weight} 100px ${s.font}`;
		const fit = Math.min(size, (room * 100) / Math.max(1, ctx.measureText(text).width));
		const k = (fit / 100) * s.dpr;
		ctx.setTransform(ux * k, uy * k, nx * k, ny * k, (O[0] + nx * at) * s.dpr, (O[1] + ny * at) * s.dpr);
		ctx.fillText(text, 0, 0);
	};
	ctx.save();
	ctx.globalAlpha *= s.mark.a;
	if (s.mark.logo) {
		// square on the die, most of its width
		const img = s.mark.logo;
		const size = (c.x1 - c.x0) * 0.62;
		const k = s.dpr / Math.max(img.width, img.height);
		ctx.setTransform(ux * k * size, uy * k * size, nx * k * size, ny * k * size, O[0] * s.dpr, O[1] * s.dpr);
		ctx.drawImage(img, -img.width / 2, -img.height / 2);
		ctx.restore();
		return;
	}
	ctx.fillStyle = INK;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	if (s.mark.maker) line(s.mark.maker.toUpperCase(), 600, 0.7, -3.1);
	line(s.mark.name.toUpperCase(), 800, 1.9, -0.2);
	if (s.mark.part) line(s.mark.part, 600, 0.65, 2.9);
	ctx.restore();
}

// Gull-wing pins along all four sides.
function pins(ctx, v, p, k) {
	const step = 1.3;
	const out = 0.9;
	const w = 0.2;
	const y = 0.12;
	ctx.beginPath();
	for (let x = p.x0 + 1.2; x <= p.x1 - 1.2 + 1e-6; x += step) {
		rect(ctx, v, x - w, p.z0 - out, x + w, p.z0, y, k);
		rect(ctx, v, x - w, p.z1, x + w, p.z1 + out, y, k);
	}
	for (let z = p.z0 + 1.2; z <= p.z1 - 1.2 + 1e-6; z += step) {
		rect(ctx, v, p.x0 - out, z - w, p.x0, z + w, y, k);
		rect(ctx, v, p.x1, z - w, p.x1 + out, z + w, y, k);
	}
	ctx.fillStyle = PIN;
	ctx.fill();
}

// From each lit trace's pad, up the package side, onto its chip.
function bonds(ctx, v, m, s, k) {
	ctx.beginPath();
	const end = (x, z, c) => {
		project(v, x, c.y0, z, k, A);
		ctx.moveTo(A[0], A[1]);
		project(v, c.cx, c.y1, c.cz, c.ring === 0 ? 1 : k, A);
		ctx.lineTo(A[0], A[1]);
	};
	for (const i of s.lit.lanes) {
		const L = m.lanes[i];
		const n = L.pts.length;
		end(L.pts[0], L.pts[1], m.cells[L.inner]);
		end(L.pts[n - 2], L.pts[n - 1], m.cells[L.outer]);
	}
	ctx.strokeStyle = rgba(s.em, 0.9);
	ctx.lineWidth = 1.2;
	ctx.stroke();
}

function tone(i, s) {
	let t = s.flash[i] || 0;
	if (s.lit) {
		if (s.lit.cell === i) t = 1;
		else if (s.lit.cells.has(i)) t = Math.max(t, 0.4);
	}
	return t;
}

/* ---- hit testing --------------------------------------------- */

// The chip under (mx, my), nearest first; -1 for none.
export function hitCell(m, v, mx, my) {
	let best = -1;
	let near = -Infinity;
	for (const c of m.cells) {
		if (!c) continue;
		const k = c.ring === 0 ? 1 : v.pull;
		const g = c.kind === 'ports' ? 0.25 : 0; // small targets get a little slack
		const pts = [];
		for (const x of [c.x0 - g, c.x1 + g]) {
			for (const z of [c.z0 - g, c.z1 + g]) {
				for (const y of [c.y0, c.y1]) pts.push(project(v, x, y, z, k, [0, 0]));
			}
		}
		if (!inside(hull(pts), mx, my)) continue;
		const d = depth(v, c.cx, c.cz) + c.y1;
		if (d > near) {
			near = d;
			best = c.i;
		}
	}
	return best;
}

// Whether (mx, my) is over a part, pins included.
export function hitPart(m, v, ring, mx, my) {
	const p = m.parts.find((q) => q.ring === ring);
	if (!p) return false;
	const k = ring === 0 ? 1 : v.pull;
	const pts = [];
	for (const x of [p.x0 - 1, p.x1 + 1]) {
		for (const z of [p.z0 - 1, p.z1 + 1]) {
			for (const y of [0, p.h]) pts.push(project(v, x, y, z, k, [0, 0]));
		}
	}
	return inside(hull(pts), mx, my);
}

// Whether (mx, my) is over the board itself.
export function onBoard(m, v, mx, my) {
	const b = m.bounds;
	const pts = [];
	for (const x of [b.x0, b.x1]) {
		for (const z of [b.z0, b.z1]) pts.push(project(v, x, 0, z, v.pull, [0, 0]));
	}
	return inside(hull(pts), mx, my);
}

function hull(p) {
	p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const lower = [];
	for (const q of p) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
		lower.push(q);
	}
	const upper = [];
	for (let i = p.length - 1; i >= 0; i--) {
		const q = p[i];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
		upper.push(q);
	}
	lower.pop();
	upper.pop();
	return lower.concat(upper);
}

function cross(o, a, b) {
	return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function inside(poly, x, y) {
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i];
		const b = poly[(i + 1) % poly.length];
		if (cross(a, b, [x, y]) < 0) return false;
	}
	return poly.length > 2;
}

/* ---- shapes -------------------------------------------------- */

/* A box standing on the board: the sides that face the viewer,
   shaded top to bottom (the one facing most squarely the lighter),
   then the top, shaded back to front, with a bright rim where it
   meets a side you can see. `o.light` is the processor's light: it
   warms the sides turned to it and spills over the top. `o.edge`
   outlines the top in place of the rim. */
function solid(ctx, v, x0, z0, x1, z1, y0, y1, k, mat, o = {}) {
	const xs = [x0, x1, x1, x0];
	const zs = [z0, z0, z1, z1];
	for (let i = 0; i < 4; i++) {
		project(v, xs[i], y0, zs[i], k, LO[i]);
		project(v, xs[i], y1, zs[i], k, HI[i]);
	}
	const seen = [];
	if (y1 - y0 > 0.001) {
		for (let i = 0; i < 4; i++) {
			const f = SIDES[i][0] * v.sa + SIDES[i][1] * v.ca;
			if (f > 0.001) seen.push([f, i]);
		}
		seen.sort((a, b) => a[0] - b[0]);
		for (const [f, i] of seen) {
			const j = (i + 1) % 4;
			const lit = 0.5 + 0.5 * f;
			const g = ctx.createLinearGradient(
				(HI[i][0] + HI[j][0]) / 2,
				(HI[i][1] + HI[j][1]) / 2,
				(LO[i][0] + LO[j][0]) / 2,
				(LO[i][1] + LO[j][1]) / 2
			);
			g.addColorStop(0, rgb(shade(mat, lit * 1.2)));
			g.addColorStop(1, rgb(shade(mat, lit * 0.55)));
			quad(ctx, LO[i], LO[j], HI[j], HI[i]);
			ctx.fillStyle = g;
			ctx.fill();
			const w = o.light ? toward(o.light, (x0 + x1) / 2, (z0 + z1) / 2, SIDES[i]) : 0;
			if (w > 0.005) {
				ctx.fillStyle = rgba(o.light.em, w);
				ctx.fill();
			}
		}
	}
	let b = 0;
	let n = 0;
	for (let i = 1; i < 4; i++) {
		if (depth(v, xs[i], zs[i]) < depth(v, xs[b], zs[b])) b = i;
		if (depth(v, xs[i], zs[i]) > depth(v, xs[n], zs[n])) n = i;
	}
	const g = ctx.createLinearGradient(HI[b][0], HI[b][1], HI[n][0], HI[n][1]);
	g.addColorStop(0, rgb(shade(mat, 1.35)));
	g.addColorStop(1, rgb(shade(mat, 0.88)));
	quad(ctx, HI[0], HI[1], HI[2], HI[3]);
	ctx.fillStyle = g;
	ctx.fill();
	if (o.light) spill(ctx, o.light);
	if (o.edge) {
		ctx.strokeStyle = o.edge;
		ctx.lineWidth = 1;
		ctx.stroke();
		return;
	}
	ctx.lineWidth = 1;
	ctx.beginPath();
	for (let i = 0; i < 4; i++) {
		if (seen.some((q) => q[1] === i)) continue;
		ctx.moveTo(HI[i][0], HI[i][1]);
		ctx.lineTo(HI[(i + 1) % 4][0], HI[(i + 1) % 4][1]);
	}
	ctx.strokeStyle = BACK;
	ctx.stroke();
	ctx.beginPath();
	for (const [, i] of seen) {
		ctx.moveTo(HI[i][0], HI[i][1]);
		ctx.lineTo(HI[(i + 1) % 4][0], HI[(i + 1) % 4][1]);
	}
	ctx.strokeStyle = RIM;
	ctx.stroke();
}

// How strongly the processor lights a side with outward normal `nrm`.
function toward(L, x, z, nrm) {
	const dx = L.x - x;
	const dz = L.z - z;
	const d = Math.hypot(dx, dz) || 1;
	const dot = (nrm[0] * dx + nrm[1] * dz) / d;
	const fall = Math.max(0, 1 - d / 48);
	return dot > 0 ? 0.32 * L.g * dot * fall * fall : 0;
}

// The processor's light over the current path, falling off with distance.
function spill(ctx, L) {
	if (!L || L.g < 0.01) return;
	const g = ctx.createRadialGradient(L.sx, L.sy, 0, L.sx, L.sy, L.sr);
	g.addColorStop(0, rgba(L.em, 0.2 * L.g));
	g.addColorStop(1, rgba(L.em, 0));
	ctx.fillStyle = g;
	ctx.fill();
}

// A flat rectangle shaded from its far corner to its near one.
function across(ctx, v, x0, z0, x1, z1, y, k, back, front) {
	const xs = [x0, x1, x1, x0];
	const zs = [z0, z0, z1, z1];
	let b = 0;
	let n = 0;
	for (let i = 1; i < 4; i++) {
		if (depth(v, xs[i], zs[i]) < depth(v, xs[b], zs[b])) b = i;
		if (depth(v, xs[i], zs[i]) > depth(v, xs[n], zs[n])) n = i;
	}
	project(v, xs[b], y, zs[b], k, U);
	project(v, xs[n], y, zs[n], k, N);
	const g = ctx.createLinearGradient(U[0], U[1], N[0], N[1]);
	g.addColorStop(0, rgb(back));
	g.addColorStop(1, rgb(front));
	return g;
}

/* A flat rectangle's edges in two tones: the two meeting at its far
   corner in `back`, the two at its near corner in `front`. Light
   behind and dark in front reads as raised; the other way, sunk. */
function bevel(ctx, v, x0, z0, x1, z1, y, k, back, front) {
	const xs = [x0, x1, x1, x0];
	const zs = [z0, z0, z1, z1];
	let b = 0;
	for (let i = 1; i < 4; i++) if (depth(v, xs[i], zs[i]) < depth(v, xs[b], zs[b])) b = i;
	const P = [0, 1, 2, 3].map((i) => project(v, xs[(b + i) % 4], y, zs[(b + i) % 4], k, [0, 0]));
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(P[3][0], P[3][1]);
	ctx.lineTo(P[0][0], P[0][1]);
	ctx.lineTo(P[1][0], P[1][1]);
	ctx.strokeStyle = back;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(P[1][0], P[1][1]);
	ctx.lineTo(P[2][0], P[2][1]);
	ctx.lineTo(P[3][0], P[3][1]);
	ctx.strokeStyle = front;
	ctx.stroke();
}

function quad(ctx, a, b, c, d) {
	ctx.beginPath();
	ctx.moveTo(a[0], a[1]);
	ctx.lineTo(b[0], b[1]);
	ctx.lineTo(c[0], c[1]);
	ctx.lineTo(d[0], d[1]);
	ctx.closePath();
}

// A flat rectangle at height y, as a fresh path.
function flat(ctx, v, x0, z0, x1, z1, y, k) {
	ctx.beginPath();
	rect(ctx, v, x0, z0, x1, z1, y, k);
}

// A flat rectangle at height y, added to the current path.
function rect(ctx, v, x0, z0, x1, z1, y, k) {
	project(v, x0, y, z0, k, A);
	ctx.moveTo(A[0], A[1]);
	project(v, x1, y, z0, k, A);
	ctx.lineTo(A[0], A[1]);
	project(v, x1, y, z1, k, A);
	ctx.lineTo(A[0], A[1]);
	project(v, x0, y, z1, k, A);
	ctx.lineTo(A[0], A[1]);
	ctx.closePath();
}

// A circle lying on the board at height y, as a fresh path.
function disc(ctx, v, x, y, z, r, k) {
	ctx.beginPath();
	for (let i = 0; i <= 20; i++) {
		const t = (i / 20) * Math.PI * 2;
		project(v, x + Math.cos(t) * r, y, z + Math.sin(t) * r, k, A);
		if (i) ctx.lineTo(A[0], A[1]);
		else ctx.moveTo(A[0], A[1]);
	}
	ctx.closePath();
}

// A flat [x, z, x, z, …] polyline, added to the current path.
function poly(ctx, v, pts, k) {
	for (let i = 0; i < pts.length; i += 2) {
		project(v, pts[i], 0, pts[i + 1], k, A);
		if (i) ctx.lineTo(A[0], A[1]);
		else ctx.moveTo(A[0], A[1]);
	}
}

// The stretch of a trace from distance a to b, added to the current path.
function along(ctx, v, L, k, a, b) {
	const c = L.cum;
	const p = L.pts;
	const n = c.length;
	if (!(b > a)) return;
	let i = 0;
	while (i < n - 2 && c[i + 1] < a) i++;
	let t = (a - c[i]) / (c[i + 1] - c[i] || 1);
	project(v, p[2 * i] + (p[2 * i + 2] - p[2 * i]) * t, 0, p[2 * i + 1] + (p[2 * i + 3] - p[2 * i + 1]) * t, k, A);
	ctx.moveTo(A[0], A[1]);
	while (i < n - 1 && c[i + 1] <= b) {
		i++;
		project(v, p[2 * i], 0, p[2 * i + 1], k, A);
		ctx.lineTo(A[0], A[1]);
	}
	if (i < n - 1) {
		t = (b - c[i]) / (c[i + 1] - c[i] || 1);
		project(v, p[2 * i] + (p[2 * i + 2] - p[2 * i]) * t, 0, p[2 * i + 1] + (p[2 * i + 3] - p[2 * i + 1]) * t, k, A);
		ctx.lineTo(A[0], A[1]);
	}
}

// The board (x, z) at distance d along a trace, into out.
function pointAt(L, d, out) {
	const c = L.cum;
	const p = L.pts;
	let i = 0;
	while (i < c.length - 2 && c[i + 1] < d) i++;
	const t = Math.max(0, Math.min(1, (d - c[i]) / (c[i + 1] - c[i] || 1)));
	out[0] = p[2 * i] + (p[2 * i + 2] - p[2 * i]) * t;
	out[1] = p[2 * i + 1] + (p[2 * i + 3] - p[2 * i + 1]) * t;
	return out;
}

/* ---- colour -------------------------------------------------- */

function shade(c, t) {
	return [Math.min(255, c[0] * t), Math.min(255, c[1] * t), Math.min(255, c[2] * t)];
}
function mix(a, b, t) {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function rgb(c) {
	return `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})`;
}
function rgba(c, a) {
	return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}
