import * as THREE from 'three';

/**
 * Fully release an object tree. Only safe for objects that *own* what they
 * reference — a throwaway model loaded for a preview, say. Scene clones share
 * geometry and materials with their cached template, so they must never be
 * passed here (see disposeObject3D in scene-engine).
 */
export function disposeTree(object: THREE.Object3D) {
	object.traverse((child) => {
		const mesh = child as THREE.Mesh;
		if (mesh.geometry) mesh.geometry.dispose();
		const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
		for (const mat of mats) {
			const m = mat as THREE.MeshStandardMaterial;
			if (m.map) m.map.dispose();
			m.dispose();
		}
	});
}
