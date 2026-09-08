/**
 * Bake / restore authored mesh geometry. The node only stores an asset id;
 * this file is the payload format inside that asset's embedded data URL.
 */
import * as THREE from 'three';

export type MeshGeomPayload = {
	position: number[];
	normal: number[] | null;
	uv: number[] | null;
	index: number[] | null;
};

export function geometryToPayload(geo: THREE.BufferGeometry): MeshGeomPayload {
	const g = geo.clone();
	if (!g.getAttribute('normal')) g.computeVertexNormals();
	const pos = g.getAttribute('position');
	const nrm = g.getAttribute('normal');
	const uv = g.getAttribute('uv');
	const idx = g.getIndex();
	const payload: MeshGeomPayload = {
		position: Array.from(pos.array as ArrayLike<number>),
		normal: nrm ? Array.from(nrm.array as ArrayLike<number>) : null,
		uv: uv ? Array.from(uv.array as ArrayLike<number>) : null,
		index: idx ? Array.from(idx.array as ArrayLike<number>) : null
	};
	g.dispose();
	return payload;
}

export function payloadToGeometry(payload: MeshGeomPayload): THREE.BufferGeometry {
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(payload.position, 3));
	if (payload.normal?.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(payload.normal, 3));
	else geo.computeVertexNormals();
	if (payload.uv?.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(payload.uv, 2));
	if (payload.index?.length) geo.setIndex(payload.index);
	geo.computeBoundingBox();
	geo.computeBoundingSphere();
	return geo;
}

export function payloadToDataUrl(payload: MeshGeomPayload): string {
	const json = JSON.stringify(payload);
	return `data:application/json,${encodeURIComponent(json)}`;
}

export function dataUrlToPayload(dataUrl: string): MeshGeomPayload | null {
	try {
		const comma = dataUrl.indexOf(',');
		if (comma < 0) return null;
		const body = dataUrl.slice(comma + 1);
		const json = dataUrl.slice(0, comma).includes('base64') ? atob(body) : decodeURIComponent(body);
		const raw = JSON.parse(json) as MeshGeomPayload;
		if (!Array.isArray(raw.position) || raw.position.length < 9) return null;
		return raw;
	} catch {
		return null;
	}
}

export function triangleCount(payload: MeshGeomPayload): number {
	if (payload.index?.length) return Math.floor(payload.index.length / 3);
	return Math.floor(payload.position.length / 9);
}
