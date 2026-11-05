/* =============================================================
   EXPLODED VIEW — the home screen's circuit taken apart where it
   stands, as a line drawing (after the Technics SL-1200 poster).
   Every part lifts straight up off the board, each to its own
   height, with dashed lines dropping to the outline of where it
   sat; the traces stay on the ground as a plan. Same model
   (layout.js) and projection (draw.js) as the board, so the one
   can turn into the other. `p` runs from 0 (every part on the
   board) to 1 (fully apart).
   ============================================================= */

import { project } from './draw.js';

// How high each part rises when fully apart, by ring, in board units.
// Uneven on purpose: no two neighbours float at the same height.
export const LIFT = [9, 18, 14, 11, 4, 7];
const CAP_LIFT = 4.5; // the processor's capacitors, under it

const BG = '#0e0e0e';
/* With `fills` on, the faces take three flat greys in place of the
   ground, so a part reads as solid without any lighting: tops the
   lightest, the side facing you most a shade down, the other side
   darkest. Chips sit in a top in the middle grey; slots and the
   chips on a memory module are cut through to the ground. */
const TOP = '#1a1a1a';
const FRONT = '#111111';
const FLANK = '#0a0a0a';
const LINE = [244, 244, 241];
const INK = 'rgba(4, 24, 15, 0.85)'; // lettering on the lit die
export const LETTER = 'rgba(244, 244, 241, 0.62)'; // lettering on the die while it is off

/* Line weights, heaviest first: a part's top outline, its sides, the
   chips on it, fine detail (pins, slots, module chips), and the plan
   on the ground. Each with how strongly it shows. */
const EDGE = [1.6, 0.95];
const SIDE = [1, 0.7];
const CHIP = [0.8, 0.55];
const FINE = [0.5, 0.42];
const PLAN = [0.6, 0.2];

const A = [0, 0];
const O = [0, 0];
const U = [0, 0];
const N = [0, 0];
const LO = [[0, 0], [0, 0], [0, 0], [0, 0]];
const HI = [[0, 0], [0, 0], [0, 0], [0, 0]];
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // outward normals: N E S W

/* The corners of everything at its full lift, for fitting the
   drawing to a box: [x, y, z] in board units. */
export function extents(m) {
	const pts = [];
	for (const p of m.parts) {
		const top = LIFT[p.ring] + p.h + (p.kind === 'memory' ? p.rise : 0);
		for (const x of [p.x0 - 1, p.x1 + 1]) {
			for (const z of [p.z0 - 1, p.z1 + 1]) pts.push([x, 0, z], [x, top, z]);
		}
	}
	for (const t of m.antennas) pts.push([t.pts[t.pts.length - 2], 0, t.pts[t.pts.length - 1]]);
	return pts;
}

/* s = {
     p       0 on the board → 1 fully apart
     guides  the dashed drops and the label leaders, 0–1
     lit     { cell, lanes, cells } for the chip in focus, or null:
             its traces and the chips it is wired to show in the accent
     power   0 the board is off (the die drawn like everything else)
             → 1 the die lit in the accent
     glow    a soft round light (a canvas, drawn once) stamped over
             the die while it is lit, or null
     wired   0–1: the traces out of the processor in the accent
     fills   faces in three flat greys in place of the ground, and the
             finest detail as fills and the accent in place of lines
     mark    { name, maker, part, logo, shown } lettered on the
             processor's die; with a logo (a canvas, already in the
             lid's ink) it is drawn in place of the lettering. `shown`
             (0–1, default 1) fades the name alone
     out     an object, or null: where the name sits goes back in
             out.named, { x, y, ux, uy, nx, ny, span } (its middle on
             screen, the die's two axes in px per unit, its length in
             units)
     font, em ([r, g, b]), dpr
     bg      the ground the faces are filled with, so what is behind
             a part is hidden (the page's own, by default)
   }
   Returns where each part's label goes, by ring: the end of a
   leader rising from the top of the part. */
export function drawExploded(ctx, v, m, s) {
	const ground = s.bg || BG;
	s.faces = s.fills
		? { top: TOP, front: FRONT, side: FLANK, chip: FRONT, cut: ground }
		: { top: ground, front: ground, side: ground, chip: null, cut: null };
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	plan(ctx, v, m, s);

	const items = [];
	for (const p of m.parts) items.push({ d: depth(v, p.x, p.z), p });
	for (const c of m.caps) items.push({ d: depth(v, (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2), c });
	items.sort((a, b) => a.d - b.d);

	const tops = [];
	for (const it of items) {
		if (it.c) {
			const y = CAP_LIFT * s.p;
			drops(ctx, v, it.c.x0, it.c.z0, it.c.x1, it.c.z1, y, s);
			solid(ctx, v, it.c.x0, it.c.z0, it.c.x1, it.c.z1, y, y + it.c.h, CHIP, FINE, s.faces);
			continue;
		}
		const p = it.p;
		const y = LIFT[p.ring] * s.p;
		drops(ctx, v, p.x0, p.z0, p.x1, p.z1, y, s);
		part(ctx, v, m, p, y, s);
		tops[p.ring] = top(v, p, y + p.h + (p.kind === 'memory' ? p.rise : 0));
	}

	const anchors = [];
	for (const p of m.parts) {
		const at = tops[p.ring];
		anchors.push({ ring: p.ring, ...leader(ctx, at, s) });
	}
	return anchors;
}

/* ---- the ground ---------------------------------------------- */

// The traces and the outline of every part's seat, flat on the board.
function plan(ctx, v, m, s) {
	ctx.beginPath();
	for (const L of m.lanes) poly(ctx, v, L.pts, 0);
	for (const t of m.antennas) poly(ctx, v, t.pts, 0);
	stroke(ctx, PLAN);

	ctx.fillStyle = rgba(LINE, 0.3);
	for (const L of m.lanes) {
		const n = L.pts.length;
		project(v, L.pts[0], 0, L.pts[1], 1, A);
		ctx.fillRect(A[0] - 0.8, A[1] - 0.8, 1.6, 1.6);
		project(v, L.pts[n - 2], 0, L.pts[n - 1], 1, A);
		ctx.fillRect(A[0] - 0.8, A[1] - 0.8, 1.6, 1.6);
	}

	// the processor's own traces, wired in the accent, and their pads
	if (s.wired > 0) {
		ctx.beginPath();
		for (const L of m.lanes) if (L.ra === 0) poly(ctx, v, L.pts, 0);
		ctx.strokeStyle = rgba(s.em, 0.5 * s.wired);
		ctx.lineWidth = 0.8;
		ctx.stroke();
		ctx.fillStyle = rgba(s.em, 0.8 * s.wired);
		for (const L of m.lanes) {
			if (L.ra !== 0) continue;
			const n = L.pts.length;
			project(v, L.pts[n - 2], 0, L.pts[n - 1], 1, A);
			ctx.fillRect(A[0] - 1, A[1] - 1, 2, 2);
		}
	}

	// the chip in focus: its traces in the accent
	if (s.lit) {
		ctx.beginPath();
		for (const k of s.lit.lanes) poly(ctx, v, m.lanes[k].pts, 0);
		for (const t of m.antennas) if (t.cell === s.lit.cell) poly(ctx, v, t.pts, 0);
		ctx.strokeStyle = rgba(s.em, 0.8);
		ctx.lineWidth = 1.2;
		ctx.stroke();
	}

	if (s.p < 0.02) return;
	ctx.save();
	ctx.setLineDash([2, 3]);
	ctx.beginPath();
	for (const p of m.parts) rect(ctx, v, p.x0, p.z0, p.x1, p.z1, 0);
	for (const c of m.caps) rect(ctx, v, c.x0, c.z0, c.x1, c.z1, 0);
	ctx.strokeStyle = rgba(LINE, 0.32 * s.guides);
	ctx.lineWidth = PLAN[0];
	ctx.stroke();
	ctx.restore();
}

// Dashed lines down each corner, from a part to where it sat.
function drops(ctx, v, x0, z0, x1, z1, y, s) {
	if (y < 0.4 || s.guides <= 0) return;
	ctx.save();
	ctx.setLineDash([3, 4]);
	ctx.beginPath();
	for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
		project(v, x, 0, z, 1, A);
		ctx.moveTo(A[0], A[1]);
		project(v, x, y, z, 1, A);
		ctx.lineTo(A[0], A[1]);
	}
	ctx.strokeStyle = rgba(LINE, 0.3 * s.guides);
	ctx.lineWidth = FINE[0];
	ctx.stroke();
	ctx.restore();
}

/* ---- the parts ----------------------------------------------- */

function part(ctx, v, m, p, y, s) {
	if (p.kind === 'core' || p.kind === 'ctrl') pins(ctx, v, p, y);
	solid(ctx, v, p.x0, p.z0, p.x1, p.z1, y, y + p.h, EDGE, SIDE, s.faces);
	const top = y + p.h;

	if (p.kind === 'memory') {
		// the modules stand in their slots, nearest drawn last
		const order = p.cells.slice().sort((a, b) => {
			const ca = m.cells[a];
			const cb = m.cells[b];
			return depth(v, ca.cx, ca.cz) - depth(v, cb.cx, cb.cz);
		});
		for (const i of order) {
			const c = m.cells[i];
			solid(ctx, v, c.x0, c.z0, c.x1, c.z1, top, top + p.rise, CHIP, FINE, s.faces);
			accent(ctx, i, s); // its top, still the current path
			module(ctx, v, c, top, top + p.rise, s);
		}
		return;
	}

	ctx.beginPath();
	circle(ctx, v, p.x0 + 1.1, top, p.z0 + 1.1, 0.4); // pin-one mark
	stroke(ctx, FINE);

	const lid = top + p.rise;
	if (p.kind === 'core') {
		for (const i of p.cells) die(ctx, v, m.cells[i], lid, s);
		return;
	}
	ctx.beginPath();
	for (const i of p.cells) {
		const c = m.cells[i];
		rect(ctx, v, c.x0, c.z0, c.x1, c.z1, lid);
	}
	if (s.faces.chip) {
		ctx.fillStyle = s.faces.chip;
		ctx.fill();
	}
	stroke(ctx, CHIP);
	if (s.lit) {
		for (const i of p.cells) {
			const c = m.cells[i];
			ctx.beginPath();
			rect(ctx, v, c.x0, c.z0, c.x1, c.z1, lid);
			accent(ctx, i, s);
		}
	}

	// filled, a port is its outline, a slot cut through it and a
	// contact tongue in the accent: two lines and a colour, not three lines
	if (p.kind === 'ports' && s.faces.cut) {
		ctx.beginPath();
		for (const i of p.cells) {
			const c = m.cells[i];
			rect(ctx, v, c.x0 + 0.4, c.z0 + 0.9, c.x1 - 0.4, c.z1 - 0.9, lid);
		}
		ctx.fillStyle = s.faces.cut;
		ctx.fill();
		ctx.beginPath();
		for (const i of p.cells) {
			const c = m.cells[i];
			const mx = (c.x0 + c.x1) / 2;
			line(ctx, v, mx, lid, c.z0 + 1.6, mx, lid, c.z1 - 1.6);
		}
		ctx.strokeStyle = rgba(s.em, 0.7);
		ctx.lineWidth = 1;
		ctx.stroke();
		return;
	}

	ctx.beginPath();
	for (const i of p.cells) {
		const c = m.cells[i];
		if (p.kind === 'ports') {
			// a slot with its contact tongue
			rect(ctx, v, c.x0 + 0.4, c.z0 + 0.9, c.x1 - 0.4, c.z1 - 0.9, lid);
			const mx = (c.x0 + c.x1) / 2;
			line(ctx, v, mx, lid, c.z0 + 1.6, mx, lid, c.z1 - 1.6);
		} else if (p.kind === 'radio') {
			// a shield can: vent slots across it
			for (let k = 1; k < 4; k++) {
				const z = c.z0 + ((c.z1 - c.z0) * k) / 4;
				line(ctx, v, c.x0 + 0.35, lid, z, c.x1 - 0.35, lid, z);
			}
		} else {
			// a package's own pin-one notch
			circle(ctx, v, c.x0 + 0.45, lid, c.z0 + 0.45, 0.16);
		}
	}
	stroke(ctx, FINE);
}

// Pins along all four sides, as fine ticks.
function pins(ctx, v, p, y) {
	const step = 1.3;
	const out = 0.9;
	const yy = y + 0.12;
	ctx.beginPath();
	for (let x = p.x0 + 1.2; x <= p.x1 - 1.2 + 1e-6; x += step) {
		line(ctx, v, x, yy, p.z0 - out, x, yy, p.z0);
		line(ctx, v, x, yy, p.z1, x, yy, p.z1 + out);
	}
	for (let z = p.z0 + 1.2; z <= p.z1 - 1.2 + 1e-6; z += step) {
		line(ctx, v, p.x0 - out, yy, z, p.x0, yy, z);
		line(ctx, v, p.x1, yy, z, p.x1 + out, yy, z);
	}
	stroke(ctx, FINE);
}

/* On the face of a memory module you can see: three chips, fine
   lines; filled, three dark chips with no outline and a strip of
   contacts along the slot in the accent. */
function module(ctx, v, c, y0, y1, s) {
	if (Math.abs(v.sa) < 0.08) return;
	const x = v.sa < 0 ? c.x0 : c.x1;
	const span = c.z1 - c.z0 - 1.8;
	const face = (za, zb, ya, yb) => {
		project(v, x, ya, za, 1, A);
		ctx.moveTo(A[0], A[1]);
		project(v, x, ya, zb, 1, A);
		ctx.lineTo(A[0], A[1]);
		project(v, x, yb, zb, 1, A);
		ctx.lineTo(A[0], A[1]);
		project(v, x, yb, za, 1, A);
		ctx.lineTo(A[0], A[1]);
		ctx.closePath();
	};
	ctx.beginPath();
	for (let j = 0; j < 3; j++) {
		const za = c.z0 + 0.9 + (j * span) / 3 + 0.25;
		face(za, za + span / 3 - 0.5, y0 + 0.75, y1 - 0.45);
	}
	if (!s.faces.cut) {
		stroke(ctx, FINE);
		return;
	}
	ctx.fillStyle = s.faces.cut;
	ctx.fill();
	ctx.beginPath();
	face(c.z0 + 0.6, c.z1 - 0.6, y0 + 0.08, y0 + 0.32);
	ctx.fillStyle = rgba(s.em, 0.45);
	ctx.fill();
}

/* The die. Off, it is drawn like everything else and lettered in
   the line colour; powered, it fills with the accent and the
   lettering turns dark on it. No blur: canvas blur is the costliest
   thing to ask for every frame. */
function die(ctx, v, c, y, s) {
	ctx.beginPath();
	rect(ctx, v, c.x0 - 1.1, c.z0 - 1.1, c.x1 + 1.1, c.z1 + 1.1, y);
	stroke(ctx, FINE);

	const on = s.power || 0;
	ctx.beginPath();
	rect(ctx, v, c.x0, c.z0, c.x1, c.z1, y);
	if (on > 0.003) {
		ctx.fillStyle = rgba(s.em, 0.92 * on);
		ctx.fill();
	}
	stroke(ctx, CHIP);
	accent(ctx, c.i, s);
	if (on > 0.003 && s.glow) {
		// the light off it: one stamp, not a blur
		project(v, c.cx, y, c.cz, 1, O);
		project(v, c.x0, y, c.z0, 1, U);
		const r = 2.4 * Math.hypot(U[0] - O[0], U[1] - O[1]);
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = 0.55 * on;
		ctx.drawImage(s.glow, O[0] - r, O[1] - r, 2 * r, 2 * r);
		ctx.restore();
	}

	if (!s.mark) return;
	project(v, c.cx, y, c.cz, 1, O);
	project(v, c.cx + 1, y, c.cz, 1, U);
	project(v, c.cx, y, c.cz + 1, 1, N);
	const ux = U[0] - O[0];
	const uy = U[1] - O[1];
	const nx = N[0] - O[0];
	const ny = N[1] - O[1];
	ctx.save();
	if (s.mark.logo) {
		// square on the die, most of its width
		const img = s.mark.logo;
		const size = (c.x1 - c.x0) * 0.62;
		const k = (s.dpr * size) / Math.max(img.width, img.height);
		ctx.setTransform(ux * k, uy * k, nx * k, ny * k, O[0] * s.dpr, O[1] * s.dpr);
		ctx.drawImage(img, -img.width / 2, -img.height / 2);
		ctx.restore();
		return;
	}
	const room = (c.x1 - c.x0) * 0.82;
	// a line of lettering, `alpha` strong; returns its length on the die
	const text = (t, weight, size, at, alpha = 1) => {
		ctx.font = `${weight} 100px ${s.font}`;
		const w = ctx.measureText(t).width;
		const fit = Math.min(size, (room * 100) / Math.max(1, w));
		if (alpha > 0.003) {
			const k = (fit / 100) * s.dpr;
			ctx.setTransform(ux * k, uy * k, nx * k, ny * k, (O[0] + nx * at) * s.dpr, (O[1] + ny * at) * s.dpr);
			ctx.globalAlpha = alpha;
			ctx.fillText(t, 0, 0);
		}
		return (w * fit) / 100;
	};
	ctx.fillStyle = on > 0.5 ? INK : LETTER;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	if (s.mark.maker) text(s.mark.maker.toUpperCase(), 600, 0.7, -3.1);
	// The name can be faded (`shown`, 0–1) while the page's own copy of
	// it lands here; where it sits, and its axes, go back in `s.out`.
	const span = text(s.mark.name.toUpperCase(), 800, 1.9, -0.2, s.mark.shown ?? 1);
	if (s.out) s.out.named = { x: O[0] + nx * -0.2, y: O[1] + ny * -0.2, ux, uy, nx, ny, span };
	if (s.mark.part) text(s.mark.part, 600, 0.65, 2.9);
	ctx.restore();
}

/* The chip in focus outlined in the accent, the ones it is wired to
   more faintly, over the current path. */
function accent(ctx, i, s) {
	if (!s.lit) return;
	const t = s.lit.cell === i ? 1 : s.lit.cells.has(i) ? 0.4 : 0;
	if (!t) return;
	ctx.strokeStyle = rgba(s.em, 0.35 + 0.65 * t);
	ctx.lineWidth = 1.2;
	ctx.stroke();
}

/* ---- labels -------------------------------------------------- */

// The highest point of a part's top on screen: where its leader starts.
function top(v, p, y) {
	let best = null;
	for (const [x, z] of [[p.x0, p.z0], [p.x1, p.z0], [p.x1, p.z1], [p.x0, p.z1]]) {
		project(v, x, y, z, 1, A);
		if (!best || A[1] < best[1]) best = [A[0], A[1]];
	}
	return best;
}

// A leader up from the part and a short tick to the right, where
// the label hangs; returns where the label starts.
function leader(ctx, at, s) {
	const rise = 26;
	const x = at[0];
	const y = at[1] - rise;
	if (s.guides > 0) {
		ctx.beginPath();
		ctx.moveTo(at[0], at[1] - 3);
		ctx.lineTo(x, y);
		ctx.lineTo(x + 10, y);
		ctx.strokeStyle = rgba(LINE, 0.45 * s.guides);
		ctx.lineWidth = FINE[0];
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(at[0], at[1], 1.6, 0, Math.PI * 2);
		ctx.fillStyle = rgba(s.em, s.guides);
		ctx.fill();
	}
	return { x: x + 14, y };
}

/* ---- shapes -------------------------------------------------- */

// Larger is nearer the viewer.
function depth(v, x, z) {
	return (x - v.fx) * v.sa + (z - v.fz) * v.ca;
}

/* A box in line art: the sides that face you, then the top, each
   filled (`faces`: { top, side }) so whatever sits behind it is
   hidden. The top is drawn in `topW`, the sides in `sideW` ([width,
   alpha]). */
function solid(ctx, v, x0, z0, x1, z1, y0, y1, topW, sideW, faces) {
	const xs = [x0, x1, x1, x0];
	const zs = [z0, z0, z1, z1];
	for (let i = 0; i < 4; i++) {
		project(v, xs[i], y0, zs[i], 1, LO[i]);
		project(v, xs[i], y1, zs[i], 1, HI[i]);
	}
	if (y1 - y0 > 0.001) {
		// the side turned most toward you takes the front grey
		let most = -1;
		let best = 0.001;
		for (let i = 0; i < 4; i++) {
			const f = SIDES[i][0] * v.sa + SIDES[i][1] * v.ca;
			if (f > best) {
				best = f;
				most = i;
			}
		}
		for (let i = 0; i < 4; i++) {
			if (SIDES[i][0] * v.sa + SIDES[i][1] * v.ca <= 0.001) continue;
			const j = (i + 1) % 4;
			quad(ctx, LO[i], LO[j], HI[j], HI[i]);
			ctx.fillStyle = i === most ? faces.front : faces.side;
			ctx.fill();
			stroke(ctx, sideW);
		}
	}
	quad(ctx, HI[0], HI[1], HI[2], HI[3]);
	ctx.fillStyle = faces.top;
	ctx.fill();
	stroke(ctx, topW);
}

function stroke(ctx, w) {
	ctx.strokeStyle = rgba(LINE, w[1]);
	ctx.lineWidth = w[0];
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

// A flat rectangle at height y, added to the current path.
function rect(ctx, v, x0, z0, x1, z1, y) {
	project(v, x0, y, z0, 1, A);
	ctx.moveTo(A[0], A[1]);
	project(v, x1, y, z0, 1, A);
	ctx.lineTo(A[0], A[1]);
	project(v, x1, y, z1, 1, A);
	ctx.lineTo(A[0], A[1]);
	project(v, x0, y, z1, 1, A);
	ctx.lineTo(A[0], A[1]);
	ctx.closePath();
}

// A straight line, added to the current path.
function line(ctx, v, xa, ya, za, xb, yb, zb) {
	project(v, xa, ya, za, 1, A);
	ctx.moveTo(A[0], A[1]);
	project(v, xb, yb, zb, 1, A);
	ctx.lineTo(A[0], A[1]);
}

// A flat circle at height y, added to the current path.
function circle(ctx, v, x, y, z, r) {
	for (let i = 0; i <= 16; i++) {
		const t = (i / 16) * Math.PI * 2;
		project(v, x + Math.cos(t) * r, y, z + Math.sin(t) * r, 1, A);
		if (i) ctx.lineTo(A[0], A[1]);
		else ctx.moveTo(A[0], A[1]);
	}
	ctx.closePath();
}

// A flat [x, z, x, z, …] polyline at height y, added to the current path.
function poly(ctx, v, pts, y) {
	for (let i = 0; i < pts.length; i += 2) {
		project(v, pts[i], y, pts[i + 1], 1, A);
		if (i) ctx.lineTo(A[0], A[1]);
		else ctx.moveTo(A[0], A[1]);
	}
}

function rgba(c, a) {
	return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}
