// @ts-nocheck — vendored as plain JS (shared with the standalone showcase build);
// kept loose rather than annotated to strict-TS standards.
// Builds a THREE.Group from a Propsize document (version 2).
// Docs are a flat node list: {id, parentId, kind:'group'|'primitive', type, transform, geometry, materialId}.
const D2R = Math.PI / 180;

function makeGeometry(THREE, type, g = {}) {
	switch (type) {
		case 'box':
			return new THREE.BoxGeometry(g.width, g.height, g.depth, g.wSeg || 1, g.hSeg || 1, g.dSeg || 1);
		case 'cylinder':
			return new THREE.CylinderGeometry(
				g.radiusTop, g.radiusBottom, g.height,
				g.radialSeg || 16, g.heightSeg || 1, !!g.openEnded
			);
		case 'cone':
			return new THREE.ConeGeometry(g.radius, g.height, g.radialSeg || 16, g.heightSeg || 1, !!g.openEnded);
		case 'sphere':
			return new THREE.SphereGeometry(g.radius, g.wSeg || 16, g.hSeg || 12);
		case 'icosa':
			return new THREE.IcosahedronGeometry(g.radius, g.detail || 0);
		case 'torus':
			return new THREE.TorusGeometry(g.radius, g.tube, g.radialSeg || 10, g.tubularSeg || 24, g.arc ?? Math.PI * 2);
		default:
			return new THREE.BoxGeometry(1, 1, 1);
	}
}

function makeMaterial(THREE, m) {
	const side = m?.side === 'back' ? THREE.BackSide : m?.side === 'double' ? THREE.DoubleSide : THREE.FrontSide;
	return new THREE.MeshStandardMaterial({
		color: new THREE.Color(m?.color || '#8a8a8a'),
		roughness: m?.roughness ?? 0.9,
		metalness: m?.metalness ?? 0,
		flatShading: !!m?.flatShading,
		wireframe: !!m?.wireframe,
		transparent: !!m?.transparent,
		opacity: m?.opacity ?? 1,
		emissive: new THREE.Color(m?.emissive || '#000000'),
		emissiveIntensity: m?.emissiveIntensity ?? 0,
		side
	});
}

export function buildGroup(THREE, doc) {
	const objects = new Map();
	const root = new THREE.Group();
	root.name = doc.name || 'Model';
	const matCache = new Map();

	for (const n of doc.nodes) {
		let obj;
		if (n.kind === 'primitive') {
			let mat = matCache.get(n.materialId);
			if (!mat) {
				mat = makeMaterial(THREE, doc.materials?.[n.materialId]);
				matCache.set(n.materialId, mat);
			}
			obj = new THREE.Mesh(makeGeometry(THREE, n.type, n.geometry), mat);
		} else {
			obj = new THREE.Group();
		}
		obj.name = n.name || n.id;
		const t = n.transform || {};
		if (t.position) obj.position.set(t.position.x, t.position.y, t.position.z);
		if (t.rotation) obj.rotation.set(t.rotation.x * D2R, t.rotation.y * D2R, t.rotation.z * D2R);
		if (t.scale) obj.scale.set(t.scale.x, t.scale.y, t.scale.z);
		obj.visible = n.visible !== false;
		objects.set(n.id, obj);
		const parent = n.parentId ? objects.get(n.parentId) : null;
		(parent || root).add(obj);
	}
	return root;
}
