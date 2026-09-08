/**
 * Model import — GLB, glTF, OBJ (+MTL), FBX, STL, PLY.
 *
 * Colours: GLB/glTF and binary FBX carry their materials (and often their
 * textures) inside the file, so they come through automatically. OBJ does not
 * — it stores geometry only, and its colours live in a sibling .mtl that in
 * turn references sibling image files. That's exactly why the folder-based
 * library matters: given the library's sibling resolver we can find and wire
 * those files up. An OBJ dropped in on its own will import grey, and the UI
 * should say so rather than look broken. STL and PLY are geometry-only by
 * design and get a neutral material.
 *
 * Every URL we mint from a File is revoked after load — otherwise a session of
 * browsing a large library leaks blobs until the tab dies.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

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

/** Every extension importModel() can actually open. Keep the library's file
 *  filter and the drop-zone copy driven off this rather than their own lists —
 *  they used to drift, and the library would offer a file the importer then
 *  refused. */
export const SUPPORTED_MODEL_EXTENSIONS = ['glb', 'gltf', 'obj', 'fbx', 'stl', 'ply'] as const;
export type ModelExtension = (typeof SUPPORTED_MODEL_EXTENSIONS)[number];

export function isSupportedModelFile(name: string): boolean {
	const ext = name.split('.').pop()?.toLowerCase() ?? '';
	return (SUPPORTED_MODEL_EXTENSIONS as readonly string[]).includes(ext);
}

/** Human-readable list for prompts and drop hints, e.g. ".glb, .gltf, .obj…" */
export const SUPPORTED_MODEL_LABEL = SUPPORTED_MODEL_EXTENSIONS.map((e) => '.' + e).join(', ');

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

/**
 * KTX2 (`KHR_texture_basisu`) textures have to be transcoded to whatever
 * compressed format the GPU actually supports, which means the loader needs a
 * live renderer to ask. The engine hands us its renderer at mount; until it
 * does we simply don't attach the loader, and a KTX2 model reports a clear
 * "needs a renderer" rather than dying inside three.
 */
let ktx2Loader: KTX2Loader | null = null;
let importRenderer: THREE.WebGLRenderer | null = null;

export function setImportRenderer(renderer: THREE.WebGLRenderer | null) {
	importRenderer = renderer;
	if (!renderer && ktx2Loader) {
		ktx2Loader.dispose();
		ktx2Loader = null;
	}
}

function getKtx2(): KTX2Loader | null {
	if (!importRenderer) return null;
	if (!ktx2Loader) {
		ktx2Loader = new KTX2Loader();
		ktx2Loader.setTranscoderPath('/basis/');
		ktx2Loader.detectSupport(importRenderer);
	}
	return ktx2Loader;
}

export async function importModel(file: File, resolveSibling?: SiblingResolver): Promise<ImportResult> {
	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
	switch (ext) {
		case 'glb':
		case 'gltf':
			return importGltf(file, resolveSibling);
		case 'obj':
			return importObj(file, resolveSibling);
		case 'fbx':
			return importFbx(file, resolveSibling);
		case 'stl':
			return importStl(file);
		case 'ply':
			return importPly(file);
		default:
			throw new Error(
				ext
					? `Propsize can't open .${ext} files yet. Supported: ${SUPPORTED_MODEL_LABEL}.`
					: `That file has no extension, so there's no way to tell what it is. Supported: ${SUPPORTED_MODEL_LABEL}.`
			);
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

		// Say which optional-but-required extension is missing *before* the
		// loader throws something opaque about an undefined decoder.
		const unmet = unmetGltfExtensions(json);
		if (unmet.length) {
			throw new Error(
				`This model requires the glTF extension${unmet.length > 1 ? 's' : ''} ${unmet.join(', ')}, which Propsize can't decode. Re-export it without that compression (or as a plain .glb) and it'll open.`
			);
		}
	}

	const manager = new THREE.LoadingManager();
	manager.setURLModifier((url) => rewrites.get(url) ?? url);
	const loader = new GLTFLoader(manager);
	loader.setDRACOLoader(getDraco());
	// gltfpack/meshoptimizer output (EXT_meshopt_compression) is extremely
	// common for models published online, and is pure JS — always attach it.
	loader.setMeshoptDecoder(MeshoptDecoder);
	const ktx2 = getKtx2();
	if (ktx2) loader.setKTX2Loader(ktx2);

	try {
		const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) => {
			// Empty base path keeps relative URIs intact so the modifier can match them.
			loader.parse(data, '', resolve as never, reject);
		});
		const object = gltf.scene;
		prepareImportedMaterials(object);
		return { object, stats: measure(object), untextured: !hasAnyMaterial(object) || missingTextures > 0, warnings };
	} catch (err) {
		throw new Error(describeLoadFailure(file, err));
	} finally {
		blobUrls.forEach(URL.revokeObjectURL);
	}
}

/** Extensions the file says it cannot render without, that we have no decoder
 *  for. KHR_draco_mesh_compression, EXT_meshopt_compression and (when a
 *  renderer is available) KHR_texture_basisu are all covered above. */
function unmetGltfExtensions(json: GltfJson): string[] {
	const required = json.extensionsRequired ?? [];
	const handled = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression']);
	if (getKtx2()) handled.add('KHR_texture_basisu');
	// These change how a material looks but never prevent geometry loading —
	// three ignores what it doesn't know, which is a far better outcome than
	// refusing the file.
	const cosmetic = /^(KHR_materials_|KHR_texture_transform|KHR_mesh_quantization|KHR_lights_)/;
	return required.filter((e) => !handled.has(e) && !cosmetic.test(e));
}

type GltfJson = {
	buffers?: { uri?: string }[];
	images?: { uri?: string }[];
	extensionsRequired?: string[];
};

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

/**
 * Turn a loader's internal failure into something a person can act on.
 *
 * three throws raw SyntaxErrors, `undefined is not a function` from a missing
 * decoder, and DOMExceptions from bad buffers — all of which surfaced to the
 * user as an identical "import failed", which is why some models "just didn't
 * open" with no way to tell why.
 */
function describeLoadFailure(file: File, err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	const name = file.name;
	if (/draco/i.test(msg)) {
		return `"${name}" uses Draco compression and the decoder failed to load. Check that /draco/ is being served.`;
	}
	if (/ktx|basis|transcoder/i.test(msg)) {
		return `"${name}" uses KTX2/Basis textures and the transcoder failed to load. Check that /basis/ is being served.`;
	}
	if (/meshopt/i.test(msg)) {
		return `"${name}" uses meshopt compression that couldn't be decoded.`;
	}
	if (/unexpected token|JSON|Unexpected end/i.test(msg)) {
		return `"${name}" looks truncated or isn't really a ${name.split('.').pop()?.toUpperCase()} file. Try re-downloading it.`;
	}
	if (/version/i.test(msg)) {
		return `"${name}" is in an older format version Propsize can't read (${msg}).`;
	}
	return `Couldn't read "${name}" — ${msg}`;
}

/**
 * Things every importer wants doing to a freshly-parsed subtree, regardless of
 * which loader produced it.
 *
 * The important one is double-sided-ness: a great many models published online
 * are authored with inward-facing or unclosed geometry that only looks right
 * in the DCC tool that made it, and backface culling turns those into models
 * with holes — the single most common "this imported wrong" report. Rendering
 * imports double-sided costs nothing here and makes them look like they do in
 * the preview the user downloaded them from.
 */
function prepareImportedMaterials(object: THREE.Object3D) {
	object.traverse((child) => {
		const mesh = child as THREE.Mesh;
		if (!mesh.isMesh) return;
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const m of mats) {
			if (!m) continue;
			const std = m as THREE.MeshStandardMaterial;
			std.side = THREE.DoubleSide;
			// A fully-metallic surface reflects its environment and nothing
			// else, so with no env map it renders black. The engine installs a
			// neutral studio environment, but clamp pure chrome anyway — it's
			// almost never what someone wants to see on import.
			if (typeof std.metalness === 'number' && std.metalness > 0.98 && !std.envMap) {
				std.metalness = 0.9;
			}
			std.needsUpdate = true;
		}
		if (!mesh.geometry) return;
		// Flat-shaded imports with no normals render black under any light.
		if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
	});
}

/** True when at least one mesh carries a material that isn't the loader's
 *  plain white default — used to warn that a model came in unpainted. */
function hasAnyMaterial(object: THREE.Object3D) {
	let found = false;
	const white = new THREE.Color(0xffffff);
	object.traverse((child) => {
		const mesh = child as THREE.Mesh;
		if (!mesh.isMesh || found) return;
		if (mesh.geometry?.getAttribute('color')) {
			found = true; // vertex colours are colours
			return;
		}
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const m of mats) {
			const std = m as THREE.MeshStandardMaterial;
			if (!std) continue;
			if (std.map || std.emissiveMap || std.normalMap || std.roughnessMap || std.metalnessMap) found = true;
			else if (std.color && !std.color.equals(white)) found = true;
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

	try {
		const object = objLoader.parse(text);
		prepareImportedMaterials(object);
		return { object, stats: measure(object), untextured, warnings, missingMtl };
	} catch (err) {
		throw new Error(describeLoadFailure(file, err));
	}
}

/**
 * FBX. Binary FBX usually embeds its textures, which the loader extracts on
 * its own; ASCII FBX and some exports reference them as siblings, so the same
 * URL-rewriting trick as glTF applies. FBX is also authored in centimetres far
 * more often than not, but normalizeImport() rescales everything to a common
 * size anyway, so there's nothing to special-case here.
 */
async function importFbx(file: File, resolveSibling?: SiblingResolver): Promise<ImportResult> {
	const warnings: string[] = [];
	const blobUrls: string[] = [];
	const buffer = await file.arrayBuffer();

	// The loader resolves texture filenames lazily during parse, so unlike
	// glTF we can't enumerate them up front — hand the manager a resolver that
	// answers from an already-materialised map of the sibling batch instead.
	const manager = new THREE.LoadingManager();
	const cache = new Map<string, string>();
	if (resolveSibling) {
		manager.setURLModifier((url) => {
			const key = url.split(/[\\/]/).pop() ?? url;
			return cache.get(key) ?? url;
		});
		// Pre-warm the cache with anything the resolver can offer by basename.
		// A miss just means the texture stays unresolved, which the loader
		// already tolerates.
		for (const guess of await probeFbxTextureNames(buffer)) {
			const sibling = await resolveSibling(guess);
			if (!sibling) continue;
			const url = URL.createObjectURL(sibling);
			blobUrls.push(url);
			cache.set(guess, url);
		}
	}

	try {
		const object = new FBXLoader(manager).parse(buffer, '');
		prepareImportedMaterials(object);
		const untextured = !hasAnyMaterial(object);
		if (untextured) warnings.push('This FBX arrived without material information, so it imports untextured.');
		return { object, stats: measure(object), untextured, warnings };
	} catch (err) {
		throw new Error(describeLoadFailure(file, err));
	} finally {
		blobUrls.forEach(URL.revokeObjectURL);
	}
}

/** Scrape plausible texture filenames out of an FBX so the sibling resolver
 *  has something to look for. Deliberately crude — a wrong guess costs one
 *  failed lookup, and FBX's own relative paths are unreliable anyway. */
async function probeFbxTextureNames(buffer: ArrayBuffer): Promise<string[]> {
	try {
		// Latin1 keeps byte offsets stable through the binary sections.
		const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));
		const names = new Set<string>();
		const re = /[\w\-. ]+\.(?:png|jpe?g|tga|bmp|tif{1,2}|webp)/gi;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) && names.size < 64) names.add(m[0].split(/[\\/]/).pop()!);
		return [...names];
	} catch {
		return [];
	}
}

/** STL is geometry only — no colours, no names, no parts. */
async function importStl(file: File): Promise<ImportResult> {
	const buffer = await file.arrayBuffer();
	try {
		const geometry = new STLLoader().parse(buffer);
		geometry.computeVertexNormals();
		const mesh = new THREE.Mesh(
			geometry,
			new THREE.MeshStandardMaterial({ color: 0xb9bec2, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide })
		);
		mesh.name = file.name.replace(/\.[^.]+$/, '');
		const object = new THREE.Group();
		object.add(mesh);
		return {
			object,
			stats: measure(object),
			untextured: true,
			warnings: ['STL stores geometry only, so this imported with a neutral material.']
		};
	} catch (err) {
		throw new Error(describeLoadFailure(file, err));
	}
}

/** PLY is geometry, sometimes with per-vertex colours. */
async function importPly(file: File): Promise<ImportResult> {
	const buffer = await file.arrayBuffer();
	try {
		const geometry = new PLYLoader().parse(buffer);
		if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
		const vertexColors = !!geometry.getAttribute('color');
		const mesh = new THREE.Mesh(
			geometry,
			new THREE.MeshStandardMaterial({
				color: vertexColors ? 0xffffff : 0xb9bec2,
				vertexColors,
				roughness: 0.8,
				metalness: 0.05,
				side: THREE.DoubleSide
			})
		);
		mesh.name = file.name.replace(/\.[^.]+$/, '');
		const object = new THREE.Group();
		object.add(mesh);
		return {
			object,
			stats: measure(object),
			untextured: !vertexColors,
			warnings: vertexColors ? [] : ['This PLY has no vertex colours, so it imported with a neutral material.']
		};
	} catch (err) {
		throw new Error(describeLoadFailure(file, err));
	}
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
	// Measure with the root neutralised, so a part's recorded centre is in the
	// template's own frame no matter whether normalizeImport() has already run.
	// (It used to depend on being called first, which silently offset every
	// split part once the ordering changed.)
	const savedPos = object.position.clone();
	const savedScale = object.scale.clone();
	const savedQuat = object.quaternion.clone();
	object.position.set(0, 0, 0);
	object.scale.set(1, 1, 1);
	object.quaternion.identity();
	object.updateMatrixWorld(true);

	try {
		return object.children
			.map((child, index) => {
				const box = new THREE.Box3().setFromObject(child);
				const c = isFinite(box.min.x) ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
				return {
					index,
					name: child.name || `Part ${index + 1}`,
					stats: measure(child),
					center: { x: c.x, y: c.y, z: c.z }
				};
			})
			.filter((p) => p.stats.meshes > 0);
	} finally {
		object.position.copy(savedPos);
		object.scale.copy(savedScale);
		object.quaternion.copy(savedQuat);
		object.updateMatrixWorld(true);
	}
}

/**
 * Normalize an import so it behaves like a primitive: its own origin sits at
 * the centre of its base, and it's scaled into a sane range ready for the grid.
 *
 * The offset is baked into the *content* (every direct child moves), not into
 * the root's position. That matters because callers keep only the root's
 * `scale` and place x/z themselves on the sibling grid — when the offset lived
 * on the root, the x/z centring was thrown away and the y grounding was
 * computed in unscaled units and then scaled, so anything that wasn't already
 * ~2 units across imported floating in the air, off-centre, or (for a large
 * model) far enough outside the view to look like nothing had loaded at all.
 *
 * With the shift on the content, the template is correct at scale 1 and stays
 * correct under any root scale the node later carries.
 */
export function normalizeImport(object: THREE.Object3D, targetSize = 2) {
	object.position.set(0, 0, 0);
	object.scale.set(1, 1, 1);
	object.quaternion.identity();
	object.updateMatrixWorld(true);

	const box = new THREE.Box3().setFromObject(object);
	if (!isFinite(box.min.x) || box.isEmpty()) {
		return { appliedScale: 1, originalSize: new THREE.Vector3() };
	}
	const size = box.getSize(new THREE.Vector3());
	const centre = box.getCenter(new THREE.Vector3());
	const largest = Math.max(size.x, size.y, size.z);
	const scale = largest > 1e-9 && isFinite(largest) ? targetSize / largest : 1;

	// Centre on x/z, sit the base on y=0 — in the root's own local frame.
	const shift = new THREE.Vector3(-centre.x, -box.min.y, -centre.z);
	for (const child of object.children) child.position.add(shift);

	object.scale.setScalar(scale);
	object.updateMatrixWorld(true);
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
