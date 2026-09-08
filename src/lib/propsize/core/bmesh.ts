/**
 * Face-vertex mesh used by isolation modelling. BufferGeometry from Three
 * primitives is split-per-face; we weld by position and merge coplanar
 * triangles into n-gons so a box is 8 verts / 6 quads, not 24 / 12.
 */
import * as THREE from 'three';

export type Vec3 = [number, number, number];
export type BMesh = { verts: Vec3[]; faces: number[][] };

const EPS = 1e-5;
const Q = 1e5;

export function edgeKey(a: number, b: number) {
	return a < b ? a + ',' + b : b + ',' + a;
}

export function edgesOf(mesh: BMesh): [number, number][] {
	const seen = new Set<string>();
	const out: [number, number][] = [];
	for (const f of mesh.faces) {
		for (let i = 0; i < f.length; i++) {
			const a = f[i];
			const b = f[(i + 1) % f.length];
			const k = edgeKey(a, b);
			if (seen.has(k)) continue;
			seen.add(k);
			out.push(a < b ? [a, b] : [b, a]);
		}
	}
	return out;
}

export function faceNormal(mesh: BMesh, face: number[]): THREE.Vector3 {
	const n = new THREE.Vector3();
	if (face.length < 3) return n;
	const a = mesh.verts[face[0]];
	for (let i = 1; i < face.length - 1; i++) {
		const b = mesh.verts[face[i]];
		const c = mesh.verts[face[i + 1]];
		n.add(
			new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(
				new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])
			)
		);
	}
	return n.normalize();
}

export function faceCentroid(mesh: BMesh, face: number[]): Vec3 {
	let x = 0,
		y = 0,
		z = 0;
	for (const i of face) {
		x += mesh.verts[i][0];
		y += mesh.verts[i][1];
		z += mesh.verts[i][2];
	}
	const n = face.length || 1;
	return [x / n, y / n, z / n];
}

function vsub(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function vadd(a: Vec3, b: Vec3): Vec3 {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function vscale(a: Vec3, s: number): Vec3 {
	return [a[0] * s, a[1] * s, a[2] * s];
}
function vlerp(a: Vec3, b: Vec3, t: number): Vec3 {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function vlen(a: Vec3) {
	return Math.hypot(a[0], a[1], a[2]);
}

export function cloneBMesh(mesh: BMesh): BMesh {
	return {
		verts: mesh.verts.map((v) => [v[0], v[1], v[2]] as Vec3),
		faces: mesh.faces.map((f) => f.slice())
	};
}

export function bmeshFromGeometry(geo: THREE.BufferGeometry): BMesh {
	const pos = geo.getAttribute('position');
	const idx = geo.getIndex();
	const weld = new Map<string, number>();
	const verts: Vec3[] = [];
	const mapIndex = (i: number) => {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const z = pos.getZ(i);
		const key = `${Math.round(x * Q)},${Math.round(y * Q)},${Math.round(z * Q)}`;
		let w = weld.get(key);
		if (w === undefined) {
			w = verts.length;
			verts.push([x, y, z]);
			weld.set(key, w);
		}
		return w;
	};
	const tris: number[][] = [];
	const triCount = idx ? idx.count / 3 : Math.floor(pos.count / 3);
	for (let t = 0; t < triCount; t++) {
		const i0 = idx ? idx.getX(t * 3) : t * 3;
		const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
		const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
		const a = mapIndex(i0);
		const b = mapIndex(i1);
		const c = mapIndex(i2);
		if (a === b || b === c || c === a) continue;
		tris.push([a, b, c]);
	}
	return { verts, faces: mergeCoplanar(verts, tris) };
}

function mergeCoplanar(verts: Vec3[], tris: number[][]): number[][] {
	const n = tris.length;
	if (n < 2) return tris;
	const tmp: BMesh = { verts, faces: tris };
	const nrm: THREE.Vector3[] = [];
	const d: number[] = [];
	for (let i = 0; i < n; i++) {
		const nn = faceNormal(tmp, tris[i]);
		nrm.push(nn);
		const p = verts[tris[i][0]];
		d.push(-(nn.x * p[0] + nn.y * p[1] + nn.z * p[2]));
	}
	const parent = Array.from({ length: n }, (_, i) => i);
	const find = (i: number): number => {
		while (parent[i] !== i) {
			parent[i] = parent[parent[i]];
			i = parent[i];
		}
		return i;
	};
	const unite = (a: number, b: number) => {
		const pa = find(a);
		const pb = find(b);
		if (pa !== pb) parent[pb] = pa;
	};
	const edgeFaces = new Map<string, number[]>();
	for (let fi = 0; fi < n; fi++) {
		const f = tris[fi];
		for (let i = 0; i < 3; i++) {
			const k = edgeKey(f[i], f[(i + 1) % 3]);
			const list = edgeFaces.get(k) ?? [];
			list.push(fi);
			edgeFaces.set(k, list);
		}
	}
	for (const pair of edgeFaces.values()) {
		if (pair.length !== 2) continue;
		const [a, b] = pair;
		if (nrm[a].dot(nrm[b]) < 0.999) continue;
		if (Math.abs(d[a] - d[b]) > 1e-3) continue;
		unite(a, b);
	}
	const groups = new Map<number, number[]>();
	for (let i = 0; i < n; i++) {
		const r = find(i);
		const g = groups.get(r) ?? [];
		g.push(i);
		groups.set(r, g);
	}
	const faces: number[][] = [];
	for (const g of groups.values()) {
		if (g.length === 1) {
			faces.push(tris[g[0]]);
			continue;
		}
		const loop = boundaryLoop(tris, g);
		if (loop && loop.length >= 3) {
			const avg = new THREE.Vector3();
			for (const i of g) avg.add(nrm[i]);
			avg.normalize();
			const polyN = faceNormal({ verts, faces: [loop] }, loop);
			faces.push(polyN.dot(avg) < 0 ? loop.slice().reverse() : loop);
		} else {
			for (const i of g) faces.push(tris[i]);
		}
	}
	return faces;
}

function boundaryLoop(tris: number[][], group: number[]): number[] | null {
	const count = new Map<string, { a: number; b: number; n: number }>();
	for (const gi of group) {
		const f = tris[gi];
		for (let i = 0; i < 3; i++) {
			const a = f[i];
			const b = f[(i + 1) % 3];
			const k = edgeKey(a, b);
			const cur = count.get(k);
			if (cur) cur.n++;
			else count.set(k, { a, b, n: 1 });
		}
	}
	const next = new Map<number, number[]>();
	for (const { a, b, n } of count.values()) {
		if (n !== 1) continue;
		// restore winding from a triangle in the group
		let ea = a;
		let eb = b;
		for (const gi of group) {
			const f = tris[gi];
			for (let i = 0; i < 3; i++) {
				if (f[i] === a && f[(i + 1) % 3] === b) {
					ea = a;
					eb = b;
				} else if (f[i] === b && f[(i + 1) % 3] === a) {
					ea = b;
					eb = a;
				}
			}
		}
		const list = next.get(ea) ?? [];
		list.push(eb);
		next.set(ea, list);
	}
	if (!next.size) return null;
	const start = next.keys().next().value as number;
	const loop: number[] = [start];
	const seen = new Set<number>([start]);
	let cur = start;
	for (let guard = 0; guard < 4096; guard++) {
		const opts = next.get(cur);
		if (!opts?.length) break;
		const nxt = opts.find((v) => !seen.has(v)) ?? (opts[0] === start ? start : null);
		if (nxt === null || nxt === undefined) break;
		if (nxt === start) return loop;
		loop.push(nxt);
		seen.add(nxt);
		cur = nxt;
	}
	return loop.length >= 3 ? loop : null;
}

export type BakedMesh = { geometry: THREE.BufferGeometry; triToFace: number[] };

export function bmeshToGeometry(mesh: BMesh): BakedMesh {
	const positions: number[] = [];
	for (const v of mesh.verts) positions.push(v[0], v[1], v[2]);
	const index: number[] = [];
	const triToFace: number[] = [];
	mesh.faces.forEach((f, fi) => {
		if (f.length < 3) return;
		for (let i = 1; i < f.length - 1; i++) {
			index.push(f[0], f[i], f[i + 1]);
			triToFace.push(fi);
		}
	});
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	if (index.length) geometry.setIndex(index);
	geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	return { geometry, triToFace };
}

export function compactBMesh(mesh: BMesh) {
	mesh.faces = mesh.faces
		.map((f) => {
			const out: number[] = [];
			for (const v of f) {
				if (out.length === 0 || out[out.length - 1] !== v) out.push(v);
			}
			if (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
			const uniq = new Set(out);
			return uniq.size >= 3 ? out : [];
		})
		.filter((f) => f.length >= 3);

	const used = new Set<number>();
	for (const f of mesh.faces) for (const v of f) used.add(v);
	const map = new Map<number, number>();
	const verts: Vec3[] = [];
	mesh.verts.forEach((v, i) => {
		if (!used.has(i)) return;
		map.set(i, verts.length);
		verts.push(v);
	});
	mesh.verts = verts;
	mesh.faces = mesh.faces.map((f) => f.map((v) => map.get(v)!));
}

/** Region-extrude selected faces along their average normal. Returns the cap face indices (same slots). */
export function extrudeFaces(mesh: BMesh, faceIdxs: number[], dist: number): number[] {
	if (!faceIdxs.length) return [];
	const origFaces = faceIdxs.map((i) => mesh.faces[i].slice());
	const avg = new THREE.Vector3();
	for (const f of origFaces) avg.add(faceNormal(mesh, f));
	if (avg.lengthSq() < 1e-10) avg.set(0, 1, 0);
	else avg.normalize();
	const used = new Set<number>();
	for (const f of origFaces) for (const v of f) used.add(v);
	const dup = new Map<number, number>();
	for (const v of used) {
		const p = mesh.verts[v];
		dup.set(v, mesh.verts.length);
		mesh.verts.push([p[0] + avg.x * dist, p[1] + avg.y * dist, p[2] + avg.z * dist]);
	}
	const edgeN = new Map<string, { a: number; b: number; n: number }>();
	for (const f of origFaces) {
		for (let i = 0; i < f.length; i++) {
			const a = f[i];
			const b = f[(i + 1) % f.length];
			const k = edgeKey(a, b);
			const cur = edgeN.get(k);
			if (cur) cur.n++;
			else edgeN.set(k, { a, b, n: 1 });
		}
	}
	faceIdxs.forEach((fi, k) => {
		mesh.faces[fi] = origFaces[k].map((v) => dup.get(v)!);
	});
	for (const f of origFaces) {
		for (let i = 0; i < f.length; i++) {
			const a = f[i];
			const b = f[(i + 1) % f.length];
			if ((edgeN.get(edgeKey(a, b))?.n ?? 0) !== 1) continue;
			mesh.faces.push([a, b, dup.get(b)!, dup.get(a)!]);
		}
	}
	return faceIdxs;
}

export function insetFaces(mesh: BMesh, faceIdxs: number[], t: number): number[] {
	const amt = Math.min(0.49, Math.max(0.02, t));
	for (const fi of faceIdxs) {
		const f = mesh.faces[fi];
		if (f.length < 3) continue;
		const c = faceCentroid(mesh, f);
		const inner = f.map((v) => {
			const p = vlerp(mesh.verts[v], c, amt);
			mesh.verts.push(p);
			return mesh.verts.length - 1;
		});
		for (let i = 0; i < f.length; i++) {
			const a = f[i];
			const b = f[(i + 1) % f.length];
			const na = inner[i];
			const nb = inner[(i + 1) % f.length];
			mesh.faces.push([a, b, nb, na]);
		}
		mesh.faces[fi] = inner;
	}
	return faceIdxs;
}

function oppositeQuadEdge(face: number[], a: number, b: number): [number, number] | null {
	if (face.length !== 4) return null;
	for (let i = 0; i < 4; i++) {
		const ea = face[i];
		const eb = face[(i + 1) % 4];
		if ((ea === a && eb === b) || (ea === b && eb === a)) {
			return [face[(i + 2) % 4], face[(i + 3) % 4]];
		}
	}
	return null;
}

function facesUsingEdge(mesh: BMesh, a: number, b: number): number[] {
	const out: number[] = [];
	mesh.faces.forEach((f, i) => {
		for (let k = 0; k < f.length; k++) {
			const ea = f[k];
			const eb = f[(k + 1) % f.length];
			if ((ea === a && eb === b) || (ea === b && eb === a)) out.push(i);
		}
	});
	return out;
}

function midVert(mesh: BMesh, a: number, b: number, t: number, cache: Map<string, number>): number {
	const k = edgeKey(a, b);
	const hit = cache.get(k);
	if (hit !== undefined) return hit;
	const id = mesh.verts.length;
	mesh.verts.push(vlerp(mesh.verts[a], mesh.verts[b], t));
	cache.set(k, id);
	return id;
}

/** Quad loop cut through the ring that contains edge (a,b). */
export function loopCut(mesh: BMesh, a: number, b: number, t = 0.5): boolean {
	const startFaces = facesUsingEdge(mesh, a, b);
	if (!startFaces.length) return false;
	type Step = { face: number; a: number; b: number };
	const ring: Step[] = [];
	const seenF = new Set<number>();

	const walk = (faceIdx: number, ea: number, eb: number) => {
		let f = faceIdx;
		let a0 = ea;
		let b0 = eb;
		for (let guard = 0; guard < mesh.faces.length + 2; guard++) {
			const face = mesh.faces[f];
			if (face.length !== 4) return;
			if (seenF.has(f)) return;
			ring.push({ face: f, a: a0, b: b0 });
			seenF.add(f);
			const opp = oppositeQuadEdge(face, a0, b0);
			if (!opp) return;
			const nextFaces = facesUsingEdge(mesh, opp[0], opp[1]).filter((i) => i !== f);
			if (!nextFaces.length) return;
			const nf = nextFaces[0];
			if (seenF.has(nf)) return;
			f = nf;
			a0 = opp[0];
			b0 = opp[1];
		}
	};

	walk(startFaces[0], a, b);
	if (startFaces[1] && !seenF.has(startFaces[1])) walk(startFaces[1], a, b);
	if (!ring.length) return false;

	const cache = new Map<string, number>();
	const extras: number[][] = [];
	const seenFace = new Set<number>();
	for (const s of ring) {
		if (seenFace.has(s.face)) continue;
		seenFace.add(s.face);
		const face = mesh.faces[s.face];
		if (face.length !== 4) continue;
		let i = -1;
		for (let k = 0; k < 4; k++) {
			const ea = face[k];
			const eb = face[(k + 1) % 4];
			if ((ea === s.a && eb === s.b) || (ea === s.b && eb === s.a)) {
				i = k;
				break;
			}
		}
		if (i < 0) continue;
		const A = face[i];
		const B = face[(i + 1) % 4];
		const C = face[(i + 2) % 4];
		const D = face[(i + 3) % 4];
		const m = midVert(mesh, A, B, t, cache);
		const n = midVert(mesh, C, D, t, cache);
		mesh.faces[s.face] = [A, m, n, D];
		extras.push([m, B, C, n]);
	}
	for (const q of extras) mesh.faces.push(q);
	return extras.length > 0;
}

export function bevelEdges(mesh: BMesh, edges: [number, number][], t: number): number[] {
	const amt = Math.min(0.45, Math.max(0.02, t));
	const newFaces: number[] = [];
	for (const [a, b] of edges) {
		const fs = facesUsingEdge(mesh, a, b);
		if (fs.length < 1) continue;
		const f1 = mesh.faces[fs[0]];
		const f2 = fs[1] !== undefined ? mesh.faces[fs[1]] : null;
		const prevNext = (face: number[], v: number, other: number) => {
			const i = face.indexOf(v);
			if (i < 0) return null;
			const prev = face[(i - 1 + face.length) % face.length];
			const next = face[(i + 1) % face.length];
			if (next === other) return prev;
			if (prev === other) return next;
			return prev === other ? next : prev;
		};
		const p1 = prevNext(f1, a, b);
		const q1 = prevNext(f1, b, a);
		if (p1 === null || q1 === null) continue;
		const a1 = mesh.verts.length;
		mesh.verts.push(vlerp(mesh.verts[a], mesh.verts[p1], amt));
		const b1 = mesh.verts.length;
		mesh.verts.push(vlerp(mesh.verts[b], mesh.verts[q1], amt));
		replaceEdge(f1, a, b, a1, b1);
		if (f2) {
			const p2 = prevNext(f2, a, b);
			const q2 = prevNext(f2, b, a);
			if (p2 === null || q2 === null) continue;
			const a2 = mesh.verts.length;
			mesh.verts.push(vlerp(mesh.verts[a], mesh.verts[p2], amt));
			const b2 = mesh.verts.length;
			mesh.verts.push(vlerp(mesh.verts[b], mesh.verts[q2], amt));
			replaceEdge(f2, a, b, a2, b2);
			mesh.faces.push([a1, b1, b2, a2]);
			newFaces.push(mesh.faces.length - 1);
		} else {
			mesh.faces.push([a, a1, b1, b]);
			newFaces.push(mesh.faces.length - 1);
		}
	}
	compactBMesh(mesh);
	return newFaces;
}

function replaceEdge(face: number[], a: number, b: number, na: number, nb: number) {
	for (let i = 0; i < face.length; i++) {
		const ea = face[i];
		const eb = face[(i + 1) % face.length];
		if (ea === a && eb === b) {
			face[i] = na;
			face[(i + 1) % face.length] = nb;
			return;
		}
		if (ea === b && eb === a) {
			face[i] = nb;
			face[(i + 1) % face.length] = na;
			return;
		}
	}
}

export function mergeVerts(mesh: BMesh, indices: number[]): boolean {
	const uniq = [...new Set(indices)].filter((i) => i >= 0 && i < mesh.verts.length);
	if (uniq.length < 2) return false;
	let x = 0,
		y = 0,
		z = 0;
	for (const i of uniq) {
		x += mesh.verts[i][0];
		y += mesh.verts[i][1];
		z += mesh.verts[i][2];
	}
	const n = uniq.length;
	const keep = uniq[0];
	mesh.verts[keep] = [x / n, y / n, z / n];
	const drop = new Set(uniq.slice(1));
	for (const f of mesh.faces) {
		for (let i = 0; i < f.length; i++) {
			if (drop.has(f[i])) f[i] = keep;
		}
	}
	compactBMesh(mesh);
	return true;
}

export function deleteFaces(mesh: BMesh, faceIdxs: number[]): boolean {
	const drop = new Set(faceIdxs);
	if (!drop.size) return false;
	mesh.faces = mesh.faces.filter((_, i) => !drop.has(i));
	if (!mesh.faces.length) return false;
	compactBMesh(mesh);
	return true;
}

export function deleteVerts(mesh: BMesh, vertIdxs: number[]): boolean {
	const drop = new Set(vertIdxs);
	if (!drop.size) return false;
	mesh.faces = mesh.faces.filter((f) => !f.some((v) => drop.has(v)));
	if (!mesh.faces.length) return false;
	compactBMesh(mesh);
	return true;
}

export function deleteEdges(mesh: BMesh, edges: [number, number][]): boolean {
	const dropF = new Set<number>();
	for (const [a, b] of edges) {
		for (const fi of facesUsingEdge(mesh, a, b)) dropF.add(fi);
	}
	return deleteFaces(mesh, [...dropF]);
}

export function averageNormal(mesh: BMesh, faceIdxs: number[]): THREE.Vector3 {
	const n = new THREE.Vector3();
	for (const i of faceIdxs) n.add(faceNormal(mesh, mesh.faces[i]));
	if (n.lengthSq() < 1e-10) return new THREE.Vector3(0, 1, 0);
	return n.normalize();
}

export function applyDelta(mesh: BMesh, weights: number[], delta: Vec3) {
	for (let i = 0; i < mesh.verts.length; i++) {
		const w = weights[i];
		if (!w) continue;
		mesh.verts[i] = vadd(mesh.verts[i], vscale(delta, w));
	}
}

export { vlerp, vsub, vadd, vscale, vlen };
