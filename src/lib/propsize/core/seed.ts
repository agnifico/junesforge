/**
 * A small starter cluster so the editor isn't a blank void on first load, and
 * so grouping/hierarchy is demonstrated immediately. Ported from the
 * prototype's seedStarterScene().
 */
import { docStore } from './document.svelte';
import { defaultMaterial, shadeColor } from './materials';
import { defaultTransform } from './utils';
import type { GroupNode, PrimitiveNode } from './types';

export function seedStarterScene() {
	if (docStore.doc.nodes.length) return; // don't clobber a loaded/imported document

	const clusterId = docStore.newId();
	const cluster: GroupNode = {
		id: clusterId,
		parentId: null,
		name: 'Boulder Cluster',
		kind: 'group',
		visible: true,
		locked: false,
		transform: defaultTransform()
	};
	docStore.doc.nodes.push(cluster);

	const rocks = [
		{ r: 0.7, x: -0.7, z: 0.1, rot: 12, color: '#9a938c' },
		{ r: 0.5, x: 0.5, z: 0.5, rot: -20, color: '#847c73' },
		{ r: 0.85, x: 0.1, z: -0.6, rot: 40, color: '#6b6560' }
	];

	rocks.forEach((rk, i) => {
		const materialId = docStore.newId('m');
		docStore.doc.materials[materialId] = {
			...defaultMaterial(rk.color),
			texture: {
				type: 'speckle',
				colorA: rk.color,
				colorB: shadeColor(rk.color, -0.18),
				tiles: 10,
				repeatX: 1,
				repeatY: 1,
				assetId: null
			}
		};
		const rock: PrimitiveNode = {
			id: docStore.newId(),
			parentId: clusterId,
			name: 'Rock ' + (i + 1),
			kind: 'primitive',
			type: 'icosa',
			visible: true,
			locked: false,
			transform: {
				position: { x: rk.x, y: rk.r * 0.75, z: rk.z },
				rotation: { x: rk.rot * 0.6, y: rk.rot, z: 0 },
				scale: { x: 1, y: 1, z: 1 }
			},
			geometry: { radius: rk.r, detail: 0 },
			materialId,
			castShadow: true,
			receiveShadow: true
		};
		docStore.doc.nodes.push(rock);
	});

	docStore.resetHistory();
}
