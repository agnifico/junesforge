/**
 * Model import — GLB, glTF, OBJ (+MTL).
 *
 * Colours: GLB/glTF carry their materials and textures inside the file, so they
 * come through automatically. OBJ does not — it stores geometry only, and its
 * colours live in a sibling .mtl that in turn references sibling image files.
 * That's exactly why the folder-based library matters: given the library's
 * sibling resolver we can find and wire those files up. An OBJ dropped in on
 * its own will import grey, and the UI should say so rather than look broken.
 *
 * Every URL we mint from a File is revoked after load — otherwise a session of
 * browsing a large library leaks blobs until the tab dies.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

export type ImportResult = {
	object: THREE.Object3D;
	stats: { meshes: number; triangles: number };
	/** True when the file arrived without material information. */
	untextured: boolean;
	warnings: string[];
	/** OBJ only: the .mtl this file references that couldn't be resolved —
	 *  set so a caller can offer to locate it by hand, rather than parsing
	 *  `warnings` strings to find out. */
	missingMtl?: string | null;
};

export type SiblingResolver = (relativePath: string) => Promise<File | null>;

let dracoLoader: DRACOLoader | null = null;
function getDraco() {
	if (!dracoLoader) {
		dracoLoader = new DRACOLoader();
		// Self-host these under /draco/ rather than pointing at a CDN, so the
		// tool keeps working offline and doesn't depend on someone else's uptime.
		dracoLoader.setDecoderPath('/draco/');
	}
	return dracoLoader;
}

export async function importModel(file: File, resolveSibling?: SiblingResolver): Promise<ImportResult> {
	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
	switch (ext) {
		case 'glb':
		case 'gltf':
			return importGltf(file, resolveSibling);
		case 'obj':
			return importObj(file, resolveSibling);
		default:
			throw new Error(`Unsupported format: .${ext}`);
	}
}

/**
 * A .glb carries its buffers and textures inside the file, but a .gltf is just
 * JSON that *references* sibling .bin and image files. Handing the loader a
 * blob URL gives it no base path to resolve those against, so they fail. We
 * therefore pre-resolve every external URI through the sibling resolver (which
 * must happen up front, because `setURLModifier` is synchronous), then parse
 * with an empty base path so the modifier sees the raw relative URIs.
 */
async function importGltf(file: File, resolveSibling?: SiblingResolver): Promise<ImportResult> {
	const warnings: string[] = [];
	const blobUrls: string[] = [];
	const isJsonGltf = file.name.toLowerCase().endsWith('.gltf');
	const rewrites = new Map<string, string>();
	let missingTextures = 0;

	const data: string | ArrayBuffer = isJsonGltf ? await file.text() : await file.arrayBuffer();

	// A .glb embeds its *buffers*, but its images may still be external URIs —
	// so both container formats need their companion files resolved, not just
	// .gltf. (Skipping this for .glb is why some models loaded with textures
	// and others didn't.)
	const json = isJsonGltf ? parseGltfJson(data as string) : readGlbJson(data as ArrayBuffer);
	if (json) {
		const external = new Set<string>();
		for (const b of json.buffers ?? []) if (b.uri && !b.uri.startsWith('data:')) external.add(b.uri);
		for (const im of json.images ?? []) if (im.uri && !im.uri.startsWith('data:')) external.add(im.uri);

		if (external.size && !resolveSibling) {
			warnings.push(
				`This model needs ${external.size} companion file(s) (.bin / textures). Select them together, or add the folder as a library.`
			);
		}
		for (const uri of external) {
			const sibling = resolveSibling ? await resolveSibling(decodeURIComponent(uri)) : null;
			if (sibling) {
				const url = URL.createObjectURL(sibling);
				blobUrls.push(url);
				rewrites.set(uri, url);
			} else if (resolveSibling) {
				missingTextures++;
				warnings.push(`Couldn't find ${uri} beside this model — importing without it.`);
			}
		}
	}

	const manager = new THREE.LoadingManager();
	manager.setURLModifier((url) => rewrites.get(url) ?? url);
	const loader = new GLTFLoader(manager);
	loader.setDRACOLoader(getDraco());

	try {
		const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) => {
			// Empty base path keeps relative URIs intact so the modifier can match them.
			loader.parse(data, '', resolve as never, reject);
		});
		const object = gltf.scene;
		return { object, stats: measure(object), untextured: !hasAnyMaterial(object) || missingTextures > 0, warnings };
	} finally {
		blobUrls.forEach(URL.revokeObjectURL);
	}
}

type GltfJson = { buffers?: { uri?: string }[]; images?: { uri?: string }[] };

function parseGltfJson(text: string): GltfJson | null {
	try {
		return JSON.parse(text) as GltfJson;
	} catch {
		throw new Error('That .gltf file is not valid JSON.');
	}
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_CHUNK_JSON = 0x4e4f534a; // "JSON"

/**
 * Pull the JSON chunk out of a .glb container so we can see which textures it
 * references externally. Layout: a 12-byte header, then chunks of
 * [uint32 length][uint32 type][data padded to 4 bytes].
 */
function readGlbJson(buffer: ArrayBuffer): GltfJson | null {
	try {
		const view = new DataView(buffer);
		if (view.byteLength < 12 || view.getUint32(0, true) !== GLB_MAGIC) return null;
		let offset = 12;
		while (offset + 8 <= view.byteLength) {
			const chunkLength = view.getUint32(offset, true);
			const chunkType = view.getUint32(offset + 4, true);
			const dataStart = offset + 8;
			if (chunkType === GLB_CHUNK_JSON) {
				const text = new TextDecoder().decode(new Uint8Array(buffer, dataStart, chunkLength));
				return JSON.parse(text) as GltfJson;
			}
			offset = dataStart + chunkLength + ((4 - (chunkLength % 4)) % 4);
		}
		return null;
	} catch {
		return null; // not fatal — the loader will still try, just without rewrites
	}
}

/** True when at least one mesh carries a material that isn't the loader's
 *  plain white default — used to warn that a model came in unpainted. */
function hasAnyMaterial(object: THREE.Object3D) {
	let found = false;
	object.traverse((child) => {
		const mesh = child as THREE.Mesh;
		if (!mesh.isMesh || found) return;
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const m of mats) {
			const std = m as THREE.MeshStandardMaterial;
			if (!std) continue;
			if (std.map || (std.color && !std.color.equals(new THREE.Color(0xffffff)))) found = true;
		}
	});
	return found;
}

async function importObj(file: File, resolveSibling?: SiblingResolver): Promise<ImportResult> {
	const warnings: string[] = [];
	const text = await file.text();
	const objLoader = new OBJLoader();
	let untextured = true;
	let missingMtl: string | null = null;

	const mtlName = findMtlReference(text);
	if (mtlName && resolveSibling) {
		const mtlFile = await resolveSibling(mtlName);
		if (mtlFile) {
			const mtlText = await mtlFile.text();
			const { materials, revoke } = await buildMaterials(mtlText, resolveSibling);
			objLoader.setMaterials(materials);
			untextured = false;
			// Textures are decoded by now; release the temporary blob URLs.
			queueMicrotask(revoke);
		} else {
			missingMtl = mtlName;
			warnings.push(`Couldn't find ${mtlName} beside this file — importing without colours.`);
		}
	} else if (mtlName) {
		missingMtl = mtlName;
		warnings.push(`This OBJ references ${mtlName}. Add the folder as a library to load its colours.`);
	} else {
		warnings.push('This OBJ has no material file, so it imports untextured.');
	}

	const object = objLoader.parse(text);
	return { object, stats: measure(object), untextured, warnings, missingMtl };
}

/** OBJ files name their material library with a `mtllib` directive. */
function findMtlReference(objText: string): string | null {
	for (const line of objText.split('\n', 200)) {
		const trimmed = line.trim();
		if (trimmed.toLowerCase().startsWith('mtllib ')) return trimmed.slice(7).trim();
	}
	return null;
}

/**
 * Parse an MTL and rewrite its texture references to blob URLs resolved from
 * the library folder, since the loader can't reach the user's disk itself.
 */
async function buildMaterials(mtlText: string, resolveSibling: SiblingResolver) {
	const urls: string[] = [];
	const mapDirectives = /^\s*(map_\w+)\s+(.+)$/gim;
	const replacements = new Map<string, string>();

	let match: RegExpExecArray | null;
	while ((match = mapDirectives.exec(mtlText))) {
		const raw = match[2].trim().split(/\s+/).pop()!; // strip any -options
		if (replacements.has(raw)) continue;
		const texFile = await resolveSibling(raw);
		if (!texFile) continue;
		const url = URL.createObjectURL(texFile);
		urls.push(url);
		replacements.set(raw, url);
	}

	let patched = mtlText;
	for (const [name, url] of replacements) patched = patched.split(name).join(url);

	const mtlLoader = new MTLLoader();
	const materials = mtlLoader.parse(patched, '');
	materials.preload();

	return { materials, revoke: () => urls.forEach(URL.revokeObjectURL) };
}

export function measure(object: THREE.Object3D) {
	let meshes = 0;
	let triangles = 0;
	object.traverse((child) => {
		const mesh = child as THREE.Mesh;
		if (!mesh.isMesh || !mesh.geometry) return;
		meshes++;
		const geo = mesh.geometry as THREE.BufferGeometry;
		triangles += geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3;
	});
	return { meshes, triangles: Math.round(triangles) };
}

/**
 * The constituent objects inside one loaded model — its root's immediate
 * children. This works for OBJ because OBJLoader emits exactly one child
 * (a Mesh, possibly multi-material) per `o`/`g`-declared object, named from
 * that declaration; it also happens to generalize to a glTF exported with
 * several independent top-level nodes. A single-mesh import simply comes
 * back with one part, which callers treat as "nothing to split".
 */
export type ImportPart = {
	index: number;
	name: string;
	stats: { meshes: number; triangles: number };
	/** This part's own geometry centroid, in the frame it sits in within the
	 *  unsplit file (i.e. relative to the whole import's root, at identity).
	 *  Used to give a split-out part a sane rotate/scale pivot — its own
	 *  content's centre — instead of inheriting the whole file's shared
	 *  origin (usually wherever the source file put "the base"). */
	center: { x: number; y: number; z: number };
};
export function listImportParts(object: THREE.Object3D): ImportPart[] {
	return object.children
		.map((child, index) => {
			const box = new THREE.Box3().setFromObject(child);
			const c = isFinite(box.min.x) ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
			return { index, name: child.name || `Part ${index + 1}`, stats: measure(child), center: { x: c.x, y: c.y, z: c.z } };
		})
		.filter((p) => p.stats.meshes > 0);
}

/**
 * Normalize an import so it behaves like a primitive: centred on its own base,
 * scaled into a sane range, ready to sit on the grid.
 */
export function normalizeImport(object: THREE.Object3D, targetSize = 2) {
	const box = new THREE.Box3().setFromObject(object);
	const size = box.getSize(new THREE.Vector3());
	const centre = box.getCenter(new THREE.Vector3());
	const largest = Math.max(size.x, size.y, size.z);
	const scale = largest > 0 ? targetSize / largest : 1;

	object.position.sub(centre);           // centre on origin
	object.position.y += size.y / 2;       // then sit on the ground plane
	object.scale.setScalar(scale);
	return { appliedScale: scale, originalSize: size };
}

/** Render a thumbnail for the gallery. Cache the result in IndexedDB. */
export function renderThumbnail(object: THREE.Object3D, size = 128): string {
	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setSize(size, size);
	const scene = new THREE.Scene();
	scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
	const key = new THREE.DirectionalLight(0xffffff, 1.4);
	key.position.set(3, 5, 4);
	scene.add(key);

	const clone = object.clone();
	scene.add(clone);

	const box = new THREE.Box3().setFromObject(clone);
	const sphere = box.getBoundingSphere(new THREE.Sphere());
	const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
	const dist = sphere.radius / Math.sin((40 * Math.PI) / 360);
	camera.position.set(1, 0.8, 1).normalize().multiplyScalar(dist).add(sphere.center);
	camera.lookAt(sphere.center);

	renderer.render(scene, camera);
	const url = renderer.domElement.toDataURL('image/webp', 0.75);
	renderer.dispose();
	return url;
}
