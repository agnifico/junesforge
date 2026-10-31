/* =============================================================
   BOARD LAYOUT — brand-graph.js laid out as a circuit board.
   Pure geometry: no DOM, no canvas. The board lies in the x/z
   plane (x runs east, z runs south, y is height), in board units.

   Each ring of the graph is one part, shaped by what it does:
     0  brand      the processor
     1  substance  a controller, just above it
     2  material   a bank of memory modules, west: stored values
                   everything else reads
     3  rules      a logic chip, east
     4  form       a strip of ports across the front
     5  signal     a radio module, antennas out to the board edge
   On every part the chips are grouped by sub-pillar: one block
   each on the controller and the logic chip, and a wider gap
   between groups along the rows.
   Every link between two rings is a trace, and the traces between
   the same two parts run together as one bus. Links inside a ring
   get no trace; they show as lit chips when either end is hovered.
   ============================================================= */

import { NODES, RINGS } from '../brand-graph.js';

const PITCH = 0.55; // centre-to-centre gap between traces in a bus

/* x/z is the centre of the part, w × d its footprint, h its height.
   Its objects sit on top, `pad` in from the edge, `gap` apart and
   raised by `rise`: in one row, or with `blocks` in one column per
   sub-pillar. `split` is the extra gap between sub-pillars. */
const PARTS = [
	{ ring: 0, kind: 'core', x: 0, z: -11, w: 16, d: 16, h: 2.2, blocks: false, pad: 3, gap: 0, split: 0, rise: 0.1 },
	{ ring: 1, kind: 'ctrl', x: 0, z: -28, w: 22, d: 12, h: 1.5, blocks: true, pad: 1.6, gap: 0.6, split: 0.6, rise: 0.1 },
	{ ring: 2, kind: 'memory', x: -27, z: 0, w: 22, d: 24, h: 0.8, blocks: false, pad: 1.5, gap: 0.45, split: 1, rise: 2.8 },
	{ ring: 3, kind: 'logic', x: 27, z: 0, w: 22, d: 24, h: 1.6, blocks: true, pad: 1.8, gap: 0.9, split: 0.6, rise: 0.1 },
	{ ring: 4, kind: 'ports', x: 0, z: 19, w: 80, d: 8, h: 1.3, blocks: false, pad: 1.5, gap: 0.45, split: 2, rise: 0.1 },
	{ ring: 5, kind: 'radio', x: 0, z: 30, w: 30, d: 8, h: 1.8, blocks: false, pad: 1.5, gap: 0.5, split: 1.2, rise: 0.1 }
];

/* The centre line of each bus, from the inner part to the outer one,
   keyed by their rings. The first and last legs meet the package
   sides square, so the traces land on pins spread along those sides.
   A pair with no entry here gets no trace, only the hover link.
   The parts sit close: the widest bus (memory to logic, 24 traces)
   runs just under the processor's pins. */
const BUSES = {
	'0-1': [[0, -19], [0, -22]],
	'0-2': [[-8, -9], [-16, -9]],
	'1-2': [[-11, -28], [-23, -28], [-27, -24], [-27, -12]],
	'1-3': [[11, -28], [23, -28], [27, -24], [27, -12]],
	'1-4': [[6, -34], [6, -36], [8, -38], [45, -38], [47, -36], [47, 17], [45, 19], [40, 19]],
	'1-5': [[-6, -34], [-6, -36], [-8, -38], [-45, -38], [-47, -36], [-47, 29], [-45, 31], [-15, 31]],
	'2-3': [[-16, 5.5], [16, 5.5]],
	'2-4': [[-27, 12], [-27, 15]],
	'2-5': [[-38, -6], [-41, -6], [-43, -4], [-43, 27], [-41, 29], [-15, 29]],
	'3-4': [[27, 12], [27, 15]],
	'3-5': [[38, -6], [41, -6], [43, -4], [43, 27], [41, 29], [15, 29]],
	'4-5': [[0, 23], [0, 26]]
};

// Decoupling capacitors either side of the processor, and mounting holes.
const CAPS = [[-10.5, -17], [10.5, -17], [-10.5, -12], [10.5, -12], [-10.5, -5], [10.5, -5]];
const HOLES = [[-49, -40], [49, -40], [-49, 41], [49, 41]];
const BOUNDS = { x0: -50, x1: 50, z0: -41, z1: 43 };

export function buildBoard() {
	const index = new Map(NODES.map((n, i) => [n.id, i]));
	const parts = PARTS.map((p) => ({
		...p,
		x0: p.x - p.w / 2,
		x1: p.x + p.w / 2,
		z0: p.z - p.d / 2,
		z1: p.z + p.d / 2,
		cells: []
	}));
	const partOf = new Map(parts.map((p) => [p.ring, p]));

	// Objects onto the tops of their parts, sub-pillar by sub-pillar
	// (brand-graph order within each).
	const cells = [];
	for (const p of parts) {
		const order = RINGS.find((r) => r.id === p.ring)?.groups ?? [];
		const rank = (i) => {
			const g = order.indexOf(NODES[i].group);
			return g < 0 ? order.length : g;
		};
		NODES.forEach((n, i) => n.ring === p.ring && p.cells.push(i));
		if (!p.cells.length) continue;
		p.cells.sort((a, b) => rank(a) - rank(b) || a - b);
		const runs = [];
		for (const i of p.cells) {
			const run = runs[runs.length - 1];
			if (run && run.rank === rank(i)) run.cells.push(i);
			else runs.push({ rank: rank(i), cells: [i] });
		}
		const place = (i, x0, z0, w, d) => {
			cells[i] = {
				i,
				ring: p.ring,
				kind: p.kind,
				x0,
				z0,
				x1: x0 + w,
				z1: z0 + d,
				cx: x0 + w / 2,
				cz: z0 + d / 2,
				y0: p.h,
				y1: p.h + p.rise
			};
		};
		if (p.blocks) {
			const rows = Math.max(...runs.map((r) => r.cells.length));
			const w = (p.w - 2 * p.pad - (runs.length - 1) * (p.gap + p.split)) / runs.length;
			const d = (p.d - 2 * p.pad - (rows - 1) * p.gap) / rows;
			runs.forEach((run, c) =>
				run.cells.forEach((i, r) =>
					place(i, p.x0 + p.pad + c * (w + p.gap + p.split), p.z0 + p.pad + r * (d + p.gap), w, d)
				)
			);
		} else {
			const n = p.cells.length;
			const w = (p.w - 2 * p.pad - (n - 1) * p.gap - (runs.length - 1) * p.split) / n;
			let x = p.x0 + p.pad;
			runs.forEach((run, k) => {
				if (k) x += p.split;
				for (const i of run.cells) {
					place(i, x, p.z0 + p.pad, w, p.d - 2 * p.pad);
					x += w + p.gap;
				}
			});
		}
	}

	// Sort every link into a bus, or into `links` when it has no trace.
	const buses = new Map();
	const links = [];
	NODES.forEach((n, to) => {
		for (const id of n.from) {
			const from = index.get(id);
			if (from === undefined || !cells[from] || !cells[to]) continue;
			const ra = NODES[from].ring;
			const rb = n.ring;
			const key = `${Math.min(ra, rb)}-${Math.max(ra, rb)}`;
			if (ra === rb || !BUSES[key]) {
				links.push([from, to]);
				continue;
			}
			const [inner, outer] = ra < rb ? [from, to] : [to, from];
			if (!buses.has(key)) buses.set(key, []);
			buses.get(key).push({ from, to, inner, outer });
		}
	});

	// Lay each bus out side by side. Traces are ordered by where their
	// chips sit, so a trace leaves its part on the same side as its chip.
	const lanes = [];
	for (const [key, group] of buses) {
		const line = BUSES[key];
		const head = line[0];
		const tail = line[line.length - 1];
		const n0 = normal(line[0], line[1]);
		const n1 = normal(line[line.length - 2], tail);
		const side = (c, p, n) => (c.cx - p[0]) * n[0] + (c.cz - p[1]) * n[1];
		group.sort(
			(a, b) =>
				side(cells[a.inner], head, n0) - side(cells[b.inner], head, n0) ||
				side(cells[a.outer], tail, n1) - side(cells[b.outer], tail, n1)
		);
		group.forEach((g, k) => {
			const pts = offset(line, (k - (group.length - 1) / 2) * PITCH);
			const cum = [0];
			for (let j = 1; j < pts.length; j++) {
				cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
			}
			lanes.push({
				...g,
				ra: NODES[g.inner].ring,
				rb: NODES[g.outer].ring,
				pts: pts.flat(),
				cum,
				len: cum[cum.length - 1]
			});
		});
	}

	// What lights up with each chip: its traces and the chips at their
	// other ends, plus the chips it links to inside its own part.
	const touch = NODES.map(() => ({ lanes: [], cells: new Set() }));
	lanes.forEach((L, k) => {
		touch[L.inner].lanes.push(k);
		touch[L.outer].lanes.push(k);
		touch[L.inner].cells.add(L.outer);
		touch[L.outer].cells.add(L.inner);
	});
	for (const [a, b] of links) {
		touch[a].cells.add(b);
		touch[b].cells.add(a);
	}

	// One meandering antenna per radio chip, out to the board edge.
	const radio = partOf.get(5);
	const antennas = radio
		? radio.cells.map((i) => {
				const c = cells[i];
				const z = radio.z1;
				const pts = [
					[c.cx, z],
					[c.cx, z + 1.1]
				];
				for (let k = 0; k < 6; k++) pts.push([c.cx + (k % 2 ? -0.7 : 0.7), z + 1.7 + k * 0.8]);
				pts.push([c.cx, z + 6.8]);
				return { cell: i, pts: pts.flat() };
			})
		: [];

	const core = partOf.get(0);
	return {
		parts,
		cells,
		lanes,
		links,
		touch,
		antennas,
		caps: CAPS.map(([x, z]) => ({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.35, z1: z + 0.35, h: 0.55 })),
		holes: HOLES,
		bounds: BOUNDS,
		core: { x: core.x, z: core.z }
	};
}

/* When each trace fires in the opening. Pulses run inward: the
   outermost part fires first, and each part fires once everything
   running into it has arrived, so the wave ends at the processor.
   `pace` scales every duration. */
export function schedule(model, pace = 1) {
	const top = Math.max(...model.parts.map((p) => p.ring));
	const at = new Map([[top, 0]]);
	const lanes = model.lanes.map(() => ({ start: 0, dur: 0 }));
	for (let r = top - 1; r >= 0; r--) {
		let t = at.get(r + 1);
		model.lanes.forEach((L, k) => {
			if (L.ra !== r) return;
			const start = at.get(L.rb) + noise(k) * 0.12 * pace;
			const dur = Math.min(0.85, 0.28 + L.len / 150) * pace;
			lanes[k] = { start, dur };
			t = Math.max(t, start + dur);
		});
		at.set(r, t);
	}
	return { lanes, end: at.get(0) };
}

// A steady 0–1 value per index, so the stagger is the same every visit.
export function noise(k) {
	const s = Math.sin(k * 78.233 + 1.7) * 43758.5453;
	return s - Math.floor(s);
}

// Unit normal to the left of a → b.
function normal(a, b) {
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const l = Math.hypot(dx, dz);
	return [-dz / l, dx / l];
}

// The polyline moved sideways by `o`, its corners mitred so that
// neighbouring traces stay parallel through every bend.
function offset(line, o) {
	return line.map((p, i) => {
		const a = i > 0 ? normal(line[i - 1], p) : null;
		const b = i < line.length - 1 ? normal(p, line[i + 1]) : null;
		if (!a || !b) {
			const n = a || b;
			return [p[0] + n[0] * o, p[1] + n[1] * o];
		}
		let nx = a[0] + b[0];
		let nz = a[1] + b[1];
		const l = Math.hypot(nx, nz);
		nx /= l;
		nz /= l;
		const k = o / (nx * b[0] + nz * b[1]);
		return [p[0] + nx * k, p[1] + nz * k];
	});
}
