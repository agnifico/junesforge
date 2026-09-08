/**
 * Viewport overlay + picking for isolation modelling. Operates in the
 * isolated mesh's object space; the engine supplies the live THREE.Mesh.
 */
import * as THREE from 'three';
import {
	type BMesh,
	edgeKey,
	edgesOf
} from './bmesh';
import type { EditSelectMode } from './editor.svelte';

const BRASS = 0xe2a35f;
const DIM = 0x6a6e72;

export function selectedVertSet(
	mesh: BMesh,
	mode: EditSelectMode,
	verts: Set<number>,
	edges: Set<string>,
	faces: Set<number>
): Set<number> {
	if (mode === 'vertex') return new Set(verts);
	const out = new Set<number>();
	if (mode === 'edge') {
		for (const k of edges) {
			const [a, b] = k.split(',').map(Number);
			out.add(a);
			out.add(b);
		}
		return out;
	}
	for (const fi of faces) {
		const f = mesh.faces[fi];
		if (f) for (const v of f) out.add(v);
	}
	return out;
}

export function parseEdge(k: string): [number, number] {
	const [a, b] = k.split(',').map(Number);
	return [a, b];
}

export function buildOverlay(mesh: BMesh): THREE.Group {
	const g = new THREE.Group();
	g.name = 'ModelOverlay';
	g.userData.isEditOverlay = true;

	const pts = new THREE.BufferGeometry();
	pts.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
	const points = new THREE.Points(
		pts,
		new THREE.PointsMaterial({
			color: DIM,
			size: 7,
			sizeAttenuation: false,
			depthTest: false
		})
	);
	points.renderOrder = 20;
	points.name = 'verts';
	g.add(points);

	const spts = new THREE.BufferGeometry();
	spts.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
	const selected = new THREE.Points(
		spts,
		new THREE.PointsMaterial({
			color: BRASS,
			size: 11,
			sizeAttenuation: false,
			depthTest: false
		})
	);
	selected.renderOrder = 21;
	selected.name = 'vertsSel';
	g.add(selected);

	const lines = new THREE.BufferGeometry();
	lines.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
	const edgeLines = new THREE.LineSegments(
		lines,
		new THREE.LineBasicMaterial({ color: 0x9aa0a4, depthTest: true })
	);
	edgeLines.renderOrder = 18;
	edgeLines.name = 'edges';
	g.add(edgeLines);

	const slines = new THREE.BufferGeometry();
	slines.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
	const selLines = new THREE.LineSegments(
		slines,
		new THREE.LineBasicMaterial({ color: BRASS, depthTest: false })
	);
	selLines.renderOrder = 19;
	selLines.name = 'edgesSel';
	g.add(selLines);

	const faceGeo = new THREE.BufferGeometry();
	const faceMesh = new THREE.Mesh(
		faceGeo,
		new THREE.MeshBasicMaterial({
			color: BRASS,
			transparent: true,
			opacity: 0.28,
			side: THREE.DoubleSide,
			depthTest: true,
			depthWrite: false
		})
	);
	faceMesh.renderOrder = 17;
	faceMesh.name = 'facesSel';
	g.add(faceMesh);

	syncOverlay(g, mesh, 'vertex', new Set(), new Set(), new Set());
	return g;
}

function setPositions(geo: THREE.BufferGeometry, arr: number[]) {
	geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
	geo.computeBoundingSphere();
}

export function syncOverlay(
	g: THREE.Group,
	mesh: BMesh,
	mode: EditSelectMode,
	verts: Set<number>,
	edges: Set<string>,
	faces: Set<number>
) {
	const all: number[] = [];
	for (const v of mesh.verts) all.push(v[0], v[1], v[2]);
	const selV = selectedVertSet(mesh, mode, verts, edges, faces);
	const sel: number[] = [];
	for (const i of selV) {
		const v = mesh.verts[i];
		if (v) sel.push(v[0], v[1], v[2]);
	}

	const pts = g.getObjectByName('verts') as THREE.Points;
	const spts = g.getObjectByName('vertsSel') as THREE.Points;
	setPositions(pts.geometry, all);
	setPositions(spts.geometry, sel);
	pts.visible = true;
	spts.visible = mode === 'vertex' && sel.length > 0;

	const edgeArr: number[] = [];
	for (const [a, b] of edgesOf(mesh)) {
		const va = mesh.verts[a];
		const vb = mesh.verts[b];
		edgeArr.push(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
	}
	const selE: number[] = [];
	if (mode === 'edge') {
		for (const k of edges) {
			const [a, b] = parseEdge(k);
			const va = mesh.verts[a];
			const vb = mesh.verts[b];
			if (va && vb) selE.push(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
		}
	} else if (mode === 'face') {
		for (const fi of faces) {
			const f = mesh.faces[fi];
			if (!f) continue;
			for (let i = 0; i < f.length; i++) {
				const va = mesh.verts[f[i]];
				const vb = mesh.verts[f[(i + 1) % f.length]];
				selE.push(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
			}
		}
	}
	const el = g.getObjectByName('edges') as THREE.LineSegments;
	const es = g.getObjectByName('edgesSel') as THREE.LineSegments;
	setPositions(el.geometry, edgeArr);
	setPositions(es.geometry, selE);

	const fmesh = g.getObjectByName('facesSel') as THREE.Mesh;
	const fpos: number[] = [];
	if (mode === 'face') {
		for (const fi of faces) {
			const f = mesh.faces[fi];
			if (!f || f.length < 3) continue;
			const a = mesh.verts[f[0]];
			for (let i = 1; i < f.length - 1; i++) {
				const b = mesh.verts[f[i]];
				const c = mesh.verts[f[i + 1]];
				fpos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
			}
		}
	}
	fmesh.geometry.dispose();
	fmesh.geometry = new THREE.BufferGeometry();
	if (fpos.length) fmesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
	fmesh.visible = fpos.length > 0;
}

export function worldToScreen(
	world: THREE.Vector3,
	camera: THREE.Camera,
	w: number,
	h: number
): { x: number; y: number; z: number } {
	const p = world.clone().project(camera);
	return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, z: p.z };
}

export function pickVertex(
	mesh: BMesh,
	obj: THREE.Object3D,
	camera: THREE.Camera,
	sx: number,
	sy: number,
	w: number,
	h: number
): number | null {
	obj.updateWorldMatrix(true, false);
	let best = -1;
	let bestD = 14;
	const wv = new THREE.Vector3();
	for (let i = 0; i < mesh.verts.length; i++) {
		const v = mesh.verts[i];
		wv.set(v[0], v[1], v[2]).applyMatrix4(obj.matrixWorld);
		const s = worldToScreen(wv, camera, w, h);
		if (s.z > 1 || s.z < -1) continue;
		const d = Math.hypot(s.x - sx, s.y - sy);
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	return best < 0 ? null : best;
}

export function pickEdge(
	mesh: BMesh,
	obj: THREE.Object3D,
	camera: THREE.Camera,
	sx: number,
	sy: number,
	w: number,
	h: number
): string | null {
	obj.updateWorldMatrix(true, false);
	let best: string | null = null;
	let bestD = 12;
	const wa = new THREE.Vector3();
	const wb = new THREE.Vector3();
	for (const [a, b] of edgesOf(mesh)) {
		const va = mesh.verts[a];
		const vb = mesh.verts[b];
		wa.set(va[0], va[1], va[2]).applyMatrix4(obj.matrixWorld);
		wb.set(vb[0], vb[1], vb[2]).applyMatrix4(obj.matrixWorld);
		const sa = worldToScreen(wa, camera, w, h);
		const sb = worldToScreen(wb, camera, w, h);
		if (sa.z > 1 && sb.z > 1) continue;
		const d = distToSegment(sx, sy, sa.x, sa.y, sb.x, sb.y);
		if (d < bestD) {
			bestD = d;
			best = edgeKey(a, b);
		}
	}
	return best;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = dx * dx + dy * dy;
	if (len < 1e-8) return Math.hypot(px - x1, py - y1);
	let t = ((px - x1) * dx + (py - y1) * dy) / len;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function pickFace(
	raycaster: THREE.Raycaster,
	obj: THREE.Object3D,
	triToFace: number[]
): number | null {
	const hits = raycaster.intersectObject(obj, false);
	if (!hits.length) return null;
	const tri = hits[0].faceIndex;
	if (tri === undefined || tri === null) return null;
	return triToFace[tri] ?? null;
}

export function selectionCentroid(mesh: BMesh, verts: Set<number>): THREE.Vector3 {
	const c = new THREE.Vector3();
	if (!verts.size) {
		if (mesh.verts.length) {
			for (const v of mesh.verts) c.add(new THREE.Vector3(v[0], v[1], v[2]));
			c.divideScalar(mesh.verts.length);
		}
		return c;
	}
	for (const i of verts) {
		const v = mesh.verts[i];
		c.add(new THREE.Vector3(v[0], v[1], v[2]));
	}
	return c.divideScalar(verts.size);
}

export function grabWeights(
	mesh: BMesh,
	core: Set<number>,
	proportional: boolean,
	radius: number
): number[] {
	const w = new Array(mesh.verts.length).fill(0);
	if (!core.size) return w;
	if (!proportional) {
		for (const i of core) w[i] = 1;
		return w;
	}
	const r = Math.max(0.05, radius);
	for (let i = 0; i < mesh.verts.length; i++) {
		const p = mesh.verts[i];
		let dMin = Infinity;
		for (const j of core) {
			const q = mesh.verts[j];
			const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
			if (d < dMin) dMin = d;
		}
		if (dMin >= r) continue;
		const t = dMin / r;
		w[i] = 1 - t * t;
	}
	return w;
}
