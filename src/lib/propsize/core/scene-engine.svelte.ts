/**
 * The three.js half of Propsize. Owns the renderer/scene/camera, the sync
 * loop that reconciles `docStore.doc.nodes` (+ shared materials) with a live
 * THREE.Object3D graph, selection, CRUD, arrange tools, and both the drag
 * gizmo and orbit camera. Ported from the HTML prototype, which is why the
 * math here mirrors it closely â it already works.
 *
 * One instance is created per editor session (see the app route) and mounted
 * to a canvas holder element. UI components call its methods directly; the
 * few bits the template needs to read reactively (`specPlate`) are $state.
 */
import * as THREE from 'three';
import { docStore } from './document.svelte';
import { editorStore } from './editor.svelte';
import type { GizmoMode } from './editor.svelte';
import { GEO_DEFS, defaultGroundY } from './geometry';
import { defaultMaterial, buildThreeMaterial, updateMaterialInPlace } from './materials';
import { randomPaletteColor } from './palette';
import { defaultTransform, round3, D2R, R2D } from './utils';
import { SimpleOrbitControls } from './orbit-controls';
import { isGroup, isPrimitive, isImported } from './types';
import type { SceneNode, PrimitiveNode, GroupNode, ImportedNode, PrimitiveType, Asset, AssetSource, Vec3 } from './types';
import { importModel, normalizeImport, type ImportPart } from '../import/loaders';
import { dataUrlToFile } from '../import/local-import';

type Axis = 'x' | 'y' | 'z';

/**
 * A detached deep copy of something that may be reactive state.
 *
 * structuredClone can't take a $state proxy — it throws "Proxy object could
 * not be cloned" — so anything read back out of the document (or out of a
 * $state field like the material clipboard) has to be snapshotted first.
 * Every material copy in here goes through this.
 */
function copyOf<T>(value: T): T {
	return structuredClone($state.snapshot(value)) as T;
}

export type SpecPlateData = { title: string; rows: [string, string][] } | null;

function disposeObject3D(obj: THREE.Object3D) {
	// Imported models are clone(true) of a cached template, which SHARES its
	// geometry and materials with the template and with every other placement
	// of the same asset. Disposing those here would blank out copies that are
	// still on screen, so a clone is only detached, never disposed.
	if (obj.userData?.isAssetClone) {
		// The override material *is* owned by this clone (not the template), so
		// it's the one thing here that must be released.
		const om = obj.userData.overrideMaterial as THREE.MeshStandardMaterial | undefined;
		if (om) {
			if (om.map) om.map.dispose();
			om.dispose();
		}
		return;
	}
	obj.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (mesh.geometry) mesh.geometry.dispose();
		const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
		for (const mat of mats) {
			const m = mat as THREE.MeshStandardMaterial;
			if (m.map) m.map.dispose();
			m.dispose();
		}
	});
}
/** Take an object out of the scene and release whatever it owns. */
function detachObject3D(obj: THREE.Object3D) {
	obj.parent?.remove(obj);
	disposeObject3D(obj);
}
function countTris(obj: THREE.Object3D) {
	let tris = 0;
	obj.traverse((o) => {
		const m = o as THREE.Mesh;
		if (m.isMesh) {
			const g = m.geometry;
			tris += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
		}
	});
	return Math.round(tris);
}
/** `obj`'s own bounding box, expressed in its own local frame (i.e. as if its
 *  position/rotation/scale were identity right now) — every descendant mesh's
 *  geometry bounds, mapped through its world matrix and back through the
 *  inverse of `obj`'s. Used to anchor one edge in place during a one-sided
 *  scale; for a single mesh this is just its geometry's own bounding box. */
function localBounds(obj: THREE.Object3D): THREE.Box3 {
	obj.updateWorldMatrix(true, true);
	const invRoot = obj.matrixWorld.clone().invert();
	const box = new THREE.Box3();
	const corner = new THREE.Vector3();
	obj.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (!mesh.isMesh || !mesh.geometry) return;
		if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
		const gb = mesh.geometry.boundingBox!;
		if (!isFinite(gb.min.x)) return;
		for (let i = 0; i < 8; i++) {
			corner
				.set(i & 1 ? gb.max.x : gb.min.x, i & 2 ? gb.max.y : gb.min.y, i & 4 ? gb.max.z : gb.min.z)
				.applyMatrix4(mesh.matrixWorld)
				.applyMatrix4(invRoot);
			box.expandByPoint(corner);
		}
	});
	return box;
}

// ---- gizmo geometry (module-level, shared across instances) ---------------
const AXIS_INFO = [
	{
		axis: 'x' as Axis,
		dir: new THREE.Vector3(1, 0, 0),
		color: 0xe0555f,
		rot: [0, 0, -Math.PI / 2],
		ring: [0, Math.PI / 2, 0]
	},
	{
		axis: 'y' as Axis,
		dir: new THREE.Vector3(0, 1, 0),
		color: 0x86c25c,
		rot: [0, 0, 0],
		ring: [Math.PI / 2, 0, 0]
	},
	{
		axis: 'z' as Axis,
		dir: new THREE.Vector3(0, 0, 1),
		color: 0x5b9de0,
		rot: [Math.PI / 2, 0, 0],
		ring: [0, 0, 0]
	}
];
const PLANE_INFO = [
	{ name: 'xy', normal: new THREE.Vector3(0, 0, 1), color: 0x5b9de0, pos: [0.26, 0.26, 0], rot: [0, 0, 0] },
	{
		name: 'yz',
		normal: new THREE.Vector3(1, 0, 0),
		color: 0xe0555f,
		pos: [0, 0.26, 0.26],
		rot: [0, Math.PI / 2, 0]
	},
	{
		name: 'zx',
		normal: new THREE.Vector3(0, 1, 0),
		color: 0x86c25c,
		pos: [0.26, 0, 0.26],
		rot: [-Math.PI / 2, 0, 0]
	}
];
const PLANE_NORMAL: Record<'xy' | 'yz' | 'zx', Axis> = { xy: 'z', yz: 'x', zx: 'y' };
function gzMat(hex: number, opacity = 0.95) {
	return new THREE.MeshBasicMaterial({
		color: hex,
		depthTest: false,
		transparent: true,
		opacity,
		side: THREE.DoubleSide
	});
}
function gzPick() {
	return new THREE.MeshBasicMaterial({ visible: false });
}

type GizmoTarget = {
	node: SceneNode;
	parent: THREE.Object3D;
	start: Vec3;
	startScale: Vec3;
	startWorldPos?: THREE.Vector3;
	startWorldQ?: THREE.Quaternion;
	parentWorldQInv?: THREE.Quaternion;
	/** Object-local bounding box (already includes startScale) and local
	 *  rotation, captured for one-sided (anchor-the-far-edge) scaling. */
	localBox?: THREE.Box3;
	startLocalQ?: THREE.Quaternion;
};
type GizmoDrag = {
	mode: GizmoMode;
	plane: THREE.Plane;
	origin: THREE.Vector3;
	targets: GizmoTarget[];
	axisDir: THREE.Vector3 | null;
	rotAxis: THREE.Vector3 | null;
	scaleAxis: string | null;
	startProj: number;
	startVec: THREE.Vector3 | null;
	p0: THREE.Vector3 | null;
};

export class SceneEngine {
	renderer!: THREE.WebGLRenderer;
	scene!: THREE.Scene;
	camera!: THREE.PerspectiveCamera;
	controls!: SimpleOrbitControls;
	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();
	sceneRoot!: THREE.Group;
	helpersGroup!: THREE.Group;
	gridHelper!: THREE.GridHelper;
	shadowPlane!: THREE.Mesh;
	hemiLight!: THREE.HemisphereLight;
	dirLight!: THREE.DirectionalLight;

	threeObjects = new Map<string, THREE.Object3D>();
	selectionHelpers = new Map<string, THREE.BoxHelper>();
	heldKeys = new Set<string>();

	/** Viewport HUD data â the one piece of engine state the template reads. */
	specPlate = $state<SpecPlateData>(null);

	#holder: HTMLElement | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#raf = 0;
	#syncScheduled = false;
	#disposed = false;

	#gizmoGroup: THREE.Group | null = null;
	#gizmoParts: Record<GizmoMode, THREE.Group> = {} as Record<GizmoMode, THREE.Group>;
	#gizmoHandles: Record<GizmoMode, THREE.Object3D[]> = { translate: [], rotate: [], scale: [] };
	#gizmoDrag: GizmoDrag | null = null;
	gizmoWasDragging = false;

	// ---- lifecycle ----------------------------------------------------------
	mount(holder: HTMLElement) {
		this.#holder = holder;
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(editorStore.bgColor);
		this.scene.fog = new THREE.Fog(editorStore.bgColor, 18, 55);

		this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
		this.camera.position.set(6, 5, 8);

		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		holder.appendChild(this.renderer.domElement);

		this.sceneRoot = new THREE.Group();
		this.sceneRoot.name = 'PropsizeRoot';
		this.scene.add(this.sceneRoot);

		this.helpersGroup = new THREE.Group();
		this.scene.add(this.helpersGroup);

		this.hemiLight = new THREE.HemisphereLight(0xdfe6ea, 0x2a2620, editorStore.ambientIntensity);
		this.scene.add(this.hemiLight);
		this.dirLight = new THREE.DirectionalLight(editorStore.lightColor, editorStore.lightIntensity);
		this.dirLight.castShadow = true;
		this.dirLight.shadow.mapSize.set(2048, 2048);
		this.dirLight.shadow.camera.left = -12;
		this.dirLight.shadow.camera.right = 12;
		this.dirLight.shadow.camera.top = 12;
		this.dirLight.shadow.camera.bottom = -12;
		this.dirLight.shadow.camera.far = 40;
		this.dirLight.shadow.bias = -0.0025;
		this.scene.add(this.dirLight);
		this.scene.add(this.dirLight.target);
		this.setLightAngle(editorStore.lightAzimuth, editorStore.lightElevation);

		this.gridHelper = new THREE.GridHelper(40, 40, 0x4a4d4f, 0x2a2d2f);
		this.gridHelper.visible = editorStore.showGrid;
		this.helpersGroup.add(this.gridHelper);

		this.shadowPlane = new THREE.Mesh(
			new THREE.PlaneGeometry(200, 200),
			new THREE.ShadowMaterial({ opacity: 0.32 })
		);
		this.shadowPlane.rotation.x = -Math.PI / 2;
		this.shadowPlane.receiveShadow = true;
		this.shadowPlane.visible = editorStore.showGrid;
		this.helpersGroup.add(this.shadowPlane);

		this.controls = new SimpleOrbitControls(this.camera, this.renderer.domElement, this.gizmoTryGrab);
		this.controls.target.set(0, 1.2, 0);

		this.#buildGizmo();

		this.#resizeObserver = new ResizeObserver(this.#onResize);
		this.#resizeObserver.observe(holder);
		this.#onResize();

		this.renderer.domElement.addEventListener('pointerdown', this.#onPointerDown);
		this.renderer.domElement.addEventListener('dblclick', this.focusOnSelection);

		this.#raf = requestAnimationFrame(this.#tick);
	}

	dispose() {
		this.#disposed = true;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#resizeObserver?.disconnect();
		this.controls?.dispose();
		this.renderer?.domElement.removeEventListener('pointerdown', this.#onPointerDown);
		this.renderer?.domElement.removeEventListener('dblclick', this.focusOnSelection);
		window.removeEventListener('pointermove', this.#onGizmoMove);
		window.removeEventListener('pointerup', this.#onGizmoUp);
		this.threeObjects.forEach(disposeObject3D);
		this.threeObjects.clear();
		this.renderer?.dispose();
		if (this.#holder) this.#holder.replaceChildren();
	}

	#onResize = () => {
		if (!this.#holder) return;
		const w = this.#holder.clientWidth,
			h = this.#holder.clientHeight;
		if (w === 0 || h === 0) return;
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(w, h);
	};

	#tick = () => {
		if (this.#disposed) return;
		this.controls.update();
		this.selectionHelpers.forEach((bh) => bh.update());
		this.#updateGizmoTransform();
		this.#updateCameraKeys();
		this.renderer.render(this.scene, this.camera);
		this.#raf = requestAnimationFrame(this.#tick);
	};

	// ---- viewport toggles -----------------------------------------------------
	toggleGrid() {
		editorStore.showGrid = !editorStore.showGrid;
		this.gridHelper.visible = editorStore.showGrid;
		this.shadowPlane.visible = editorStore.showGrid;
	}
	toggleWire() {
		editorStore.wireAll = !editorStore.wireAll;
		this.threeObjects.forEach((obj) => {
			const mesh = obj as THREE.Mesh;
			const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
			if (mat) mat.wireframe = editorStore.wireAll || !!mat.wireframe;
		});
		this.requestSync();
	}
	setBgColor(hex: string) {
		editorStore.bgColor = hex;
		(this.scene.background as THREE.Color).set(hex);
		(this.scene.fog as THREE.Fog).color.set(hex);
	}
	setGizmoMode(mode: GizmoMode) {
		editorStore.gizmoMode = mode;
	}

	// ---- lighting -------------------------------------------------------------
	setLightIntensity(v: number) {
		editorStore.lightIntensity = v;
		this.dirLight.intensity = v;
	}
	setLightColor(hex: string) {
		editorStore.lightColor = hex;
		this.dirLight.color.set(hex);
	}
	setAmbientIntensity(v: number) {
		editorStore.ambientIntensity = v;
		this.hemiLight.intensity = v;
	}
	/** Repositions the key light on a sphere around the origin — azimuth swings
	 *  it around Y (0° = +X), elevation lifts it off the horizon. Distance is
	 *  fixed; it only ever existed to give the light somewhere to be, and the
	 *  shadow camera's frustum doesn't depend on it. */
	setLightAngle(azimuthDeg: number, elevationDeg: number) {
		editorStore.lightAzimuth = azimuthDeg;
		editorStore.lightElevation = elevationDeg;
		const az = D2R(azimuthDeg);
		const el = D2R(elevationDeg);
		const radius = 11.5;
		const horiz = Math.cos(el) * radius;
		this.dirLight.position.set(Math.cos(az) * horiz, Math.sin(el) * radius, Math.sin(az) * horiz);
		this.dirLight.target.position.set(0, 0, 0);
	}

	// ---- sync engine ----------------------------------------------------------
	requestSync() {
		if (this.#syncScheduled) return;
		this.#syncScheduled = true;
		requestAnimationFrame(() => {
			this.#syncScheduled = false;
			this.syncScene();
		});
	}

	#applyTransform(obj: THREE.Object3D, node: SceneNode) {
		const t = node.transform;
		obj.position.set(t.position.x, t.position.y, t.position.z);
		obj.rotation.set(D2R(t.rotation.x), D2R(t.rotation.y), D2R(t.rotation.z));
		obj.scale.set(t.scale.x, t.scale.y, t.scale.z);
	}

	syncScene() {
		if (!this.scene) return;
		const seen = new Set<string>();
		for (const node of docStore.doc.nodes) {
			seen.add(node.id);
			let obj = this.threeObjects.get(node.id);
			if (!obj) {
				obj = this.#createObject(node);
				this.threeObjects.set(node.id, obj);
			} else {
				this.#updateExistingObject(obj, node);
			}
			obj.name = node.name;
			obj.visible = node.visible;
			this.#applyTransform(obj, node);
		}
		// reparent pass â every object exists by now, so lookups always resolve
		for (const node of docStore.doc.nodes) {
			const obj = this.threeObjects.get(node.id);
			if (!obj) continue;
			const desiredParent = node.parentId ? this.threeObjects.get(node.parentId) : this.sceneRoot;
			if (desiredParent && obj.parent !== desiredParent) desiredParent.add(obj);
		}
		// drop stale objects
		for (const [id, obj] of [...this.threeObjects]) {
			if (seen.has(id)) continue;
			detachObject3D(obj);
			this.threeObjects.delete(id);
		}
		this.#refreshSelectionHighlight();
		this.#updateSpecPlate();
	}

	/** Loaded + normalized model templates, keyed by assetId. Cloned per node
	 *  instance rather than reused directly, so N placements of one asset are
	 *  independent objects in the scene graph. */
	#assetCache = new Map<string, THREE.Object3D>();
	#pendingAssetLoads = new Set<string>();

	#createObject(node: SceneNode): THREE.Object3D {
		if (isGroup(node)) {
			const g = new THREE.Group();
			g.userData.nodeId = node.id;
			return g;
		}
		if (isPrimitive(node)) {
			const geo = GEO_DEFS[node.type].build(node.geometry);
			const material = docStore.doc.materials[node.materialId] ?? defaultMaterial();
			const mat = buildThreeMaterial(material, editorStore.wireAll);
			const mesh = new THREE.Mesh(geo, mat);
			mesh.userData.nodeId = node.id;
			mesh.userData.geoSig = JSON.stringify(node.geometry);
			mesh.castShadow = node.castShadow;
			mesh.receiveShadow = node.receiveShadow;
			return mesh;
		}
		// Imported node. If its asset is already loaded (the normal case —
		// addImportedObject() seeds the cache in the same call that creates the
		// node), clone the template. Otherwise, for an embedded asset (its bytes
		// are saved right in the document) kick off a reload in the background —
		// this is what makes a re-opened session's imported models come back
		// without the user having to re-import them. Library-sourced assets
		// can't self-heal the same way (reconnecting a folder needs a user
		// gesture), so those still render the placeholder until the user
		// reopens the Model library panel.
		const template = this.#assetCache.get(node.assetId);
		if (!template) this.#tryAutoResolveEmbeddedAsset(node.assetId);
		const obj = template ? this.#buildImportedObject(template, node.part) : this.#placeholderObject();
		obj.userData.nodeId = node.id;
		obj.userData.isPlaceholder = !template;
		obj.userData.isAssetClone = !!template;
		this.#applyMaterialOverride(obj, node);
		this.#applyShadowFlags(obj, node.castShadow, node.receiveShadow);
		return obj;
	}

	/**
	 * Clones the right content out of an imported template. A whole-model
	 * node clones the template directly, unchanged. A split-out part clones
	 * just its own child — matched by name first (stable across a re-import
	 * that reorders children), falling back to the index recorded at split
	 * time — and wraps it in an empty Group offset by `-part.center`.
	 *
	 * That wrapper matters because the sync loop only ever sets the *node's
	 * own* top-level object transform (from node.transform); it never touches
	 * anything nested inside. If the part's clone were used directly as the
	 * node's object, whatever position it originally had within the file
	 * would simply be overwritten by node.transform, discarding it — visibly
	 * fine for a part like an OBJ's, which starts at identity anyway, but
	 * it also means node.transform.position (== part.center, see
	 * addImportedObjectSplit) would BE the part's only position, with no
	 * memory of where it actually sat in the file. Wrapping means the child's
	 * original placement survives one level down, undisturbed by sync, while
	 * the wrapper's own origin — which node.transform drives, and which the
	 * gizmo pivots on — sits exactly at the part's own geometry centre.
	 */
	#buildImportedObject(template: THREE.Object3D, part: ImportedNode['part']): THREE.Object3D {
		if (!part) return template.clone(true);
		const source = template.children.find((c) => c.name === part.name) ?? template.children[part.index] ?? null;
		if (!source) return this.#placeholderObject();
		const inner = source.clone(true);
		inner.position.sub(new THREE.Vector3(part.center.x, part.center.y, part.center.z));
		const wrapper = new THREE.Group();
		wrapper.add(inner);
		return wrapper;
	}

	/**
	 * Paint every mesh in an imported subtree with a single document material.
	 * The clone shares its materials with the cached template, so we must
	 * assign a *new* material instance rather than mutate what's there —
	 * otherwise recolouring one placement would recolour every copy.
	 */
	#applyMaterialOverride(obj: THREE.Object3D, node: ImportedNode) {
		obj.userData.appliedOverride = node.materialOverride ?? null;
		if (!node.materialOverride) return;
		const spec = docStore.doc.materials[node.materialOverride];
		if (!spec) return;
		const mat = buildThreeMaterial(spec, editorStore.wireAll);
		obj.userData.overrideMaterial = mat;
		obj.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (mesh.isMesh) mesh.material = mat;
		});
	}

	#placeholderObject(): THREE.Object3D {
		const mesh = new THREE.Mesh(
			new THREE.BoxGeometry(0.5, 0.5, 0.5),
			new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
		);
		return mesh;
	}

	/** Reloads an embedded asset's bytes in the background and populates the
	 *  cache when done, then resyncs so any node referencing it swaps its
	 *  placeholder for the real thing. Mirrors addImportedObject()'s
	 *  normalize-then-reset-to-identity convention so the template lands in
	 *  the same frame of reference the node's already-saved transform expects. */
	#tryAutoResolveEmbeddedAsset(assetId: string) {
		if (this.#pendingAssetLoads.has(assetId) || this.#assetCache.has(assetId)) return;
		const asset = docStore.doc.assets[assetId];
		if (!asset || asset.source.type !== 'embedded') return;
		this.#pendingAssetLoads.add(assetId);
		const file = dataUrlToFile(asset.source.dataUrl, asset.name, asset.format);
		importModel(file)
			.then((result) => {
				normalizeImport(result.object);
				result.object.position.set(0, 0, 0);
				result.object.scale.set(1, 1, 1);
				this.#assetCache.set(assetId, result.object);
				this.requestSync();
			})
			.catch((e) => {
				console.error('Propsize: could not reload embedded asset', asset.name, e);
			})
			.finally(() => {
				this.#pendingAssetLoads.delete(assetId);
			});
	}

	#applyShadowFlags(obj: THREE.Object3D, cast: boolean, receive: boolean) {
		obj.traverse((o) => {
			const m = o as THREE.Mesh;
			if (m.isMesh) {
				m.castShadow = cast;
				m.receiveShadow = receive;
			}
		});
	}

	#updateExistingObject(obj: THREE.Object3D, node: SceneNode) {
		if (isPrimitive(node)) {
			const mesh = obj as THREE.Mesh;
			const sig = JSON.stringify(node.geometry);
			if (mesh.userData.geoSig !== sig) {
				mesh.geometry.dispose();
				mesh.geometry = GEO_DEFS[node.type].build(node.geometry);
				mesh.userData.geoSig = sig;
			}
			const material = docStore.doc.materials[node.materialId] ?? defaultMaterial();
			updateMaterialInPlace(mesh.material as THREE.MeshStandardMaterial, material, editorStore.wireAll);
			mesh.castShadow = node.castShadow;
			mesh.receiveShadow = node.receiveShadow;
			return;
		}
		if (isImported(node)) {
			// A placeholder whose asset has since loaded (addImportedObject ran
			// again for the same assetId, e.g. a duplicate placed before the
			// original's load finished) — swap it out for the real thing.
			if (obj.userData.isPlaceholder && this.#assetCache.has(node.assetId)) {
				// Must leave the scene graph too, not just the id map — once it's
				// out of the map the stale-object pass can no longer see it, so
				// skipping this stranded the placeholder on screen alongside the
				// real model it was supposed to be replaced by.
				detachObject3D(obj);
				this.threeObjects.delete(node.id);
				this.requestSync(); // rebuilds it for real on the follow-up pass
				return;
			}
			// Turning an override on or off changes which materials the meshes
			// point at; rebuilding from the pristine template is the only way to
			// get the file's original materials back when it's switched off.
			if ((obj.userData.appliedOverride ?? null) !== (node.materialOverride ?? null)) {
				detachObject3D(obj);
				this.threeObjects.delete(node.id);
				this.requestSync();
				return;
			}
			if (node.materialOverride) {
				const spec = docStore.doc.materials[node.materialOverride];
				const mat = obj.userData.overrideMaterial as THREE.MeshStandardMaterial | undefined;
				if (spec && mat) updateMaterialInPlace(mat, spec, editorStore.wireAll);
			}
			this.#applyShadowFlags(obj, node.castShadow, node.receiveShadow);
		}
	}

	// ---- selection --------------------------------------------------------
	setSelection(ids: string[]) {
		docStore.selectedIds = ids.filter((id) => docStore.node(id));
		// The selection outline and spec plate only repaint inside syncScene(),
		// which is otherwise only scheduled by document edits — without this a
		// selection made from the Hierarchy panel (or a plain click with no
		// drag) leaves both stuck on whatever was selected last until some
		// unrelated edit happens to trigger a sync.
		this.requestSync();
		this.#recenterOrbitOnSelection();
	}

	/** Re-anchors the orbit pivot to the new selection *without* moving the
	 *  camera itself — only orbiting or panning from here on revolves around
	 *  it. Matches Blender's "Orbit Around Selection", which is what the
	 *  Preferences → Navigation toggle of the same name switches on; off (the
	 *  default) leaves the pivot exactly where it was, as most 3D tools do
	 *  out of the box. (See `focusOnSelection`, bound to F/double-click, for
	 *  the version that actually reframes the camera onto the selection —
	 *  that one always runs, regardless of this setting.)
	 *  Selecting nothing leaves the pivot where it was. */
	#recenterOrbitOnSelection() {
		if (!editorStore.orbitAroundSelection || !docStore.selectedIds.length) return;
		const box = new THREE.Box3();
		let any = false;
		for (const id of docStore.selectedIds) {
			const obj = this.threeObjects.get(id);
			if (obj) {
				box.expandByObject(obj);
				any = true;
			}
		}
		if (!any) return;
		const center = box.getCenter(new THREE.Vector3());
		const offset = this.camera.position.clone().sub(center);
		this.controls.target.copy(center);
		this.controls.spherical.setFromVector3(offset);
		this.controls.spherical.radius = Math.max(
			this.controls.minDistance,
			Math.min(this.controls.maxDistance, this.controls.spherical.radius)
		);
	}
	toggleSelection(id: string) {
		if (docStore.selectedIds.includes(id)) this.setSelection(docStore.selectedIds.filter((x) => x !== id));
		else this.setSelection([...docStore.selectedIds, id]);
	}
	selectAllTopLevel() {
		this.setSelection(docStore.children(null).map((n) => n.id));
	}

	// ---- undo / redo --------------------------------------------------------
	// docStore.undo()/redo() replace `doc` with a restored snapshot, which
	// Svelte reactivity propagates fine to the Inspector/Hierarchy (they read
	// docStore.doc directly). The three.js scene is imperative, though, and
	// only ever updates via requestSync() — so a bare docStore.undo() call
	// updates the document but leaves stale meshes on screen until some
	// unrelated edit happens to trigger a sync. Route through here instead.
	undo() {
		docStore.undo();
		this.requestSync();
	}
	redo() {
		docStore.redo();
		this.requestSync();
	}

	/**
	 * Call after swapping in a whole *different* document (Load session,
	 * Import JSON) — as opposed to undo/redo, which restore a snapshot of the
	 * *same* document's history where a given id always names the same kind
	 * of node. Two unrelated documents both number their nodes from "n1", so
	 * without this the id-keyed `threeObjects` cache reuses a stale object of
	 * the wrong kind (e.g. treats a leftover Group as a Mesh) and crashes the
	 * next sync. Clearing it forces every object to rebuild fresh.
	 */
	resetSceneObjects() {
		this.threeObjects.forEach(detachObject3D);
		this.threeObjects.clear();
		this.selectionHelpers.forEach((bh) => {
			this.helpersGroup.remove(bh);
			bh.geometry.dispose();
			(bh.material as THREE.Material).dispose();
		});
		this.selectionHelpers.clear();
		this.requestSync();
	}

	#refreshSelectionHighlight() {
		this.selectionHelpers.forEach((bh) => {
			this.helpersGroup.remove(bh);
			bh.geometry.dispose();
			(bh.material as THREE.Material).dispose();
		});
		this.selectionHelpers.clear();
		for (const id of docStore.selectedIds) {
			const obj = this.threeObjects.get(id);
			if (!obj) continue;
			const bh = new THREE.BoxHelper(obj, 0xe2a35f);
			this.helpersGroup.add(bh);
			this.selectionHelpers.set(id, bh);
		}
	}

	/**
	 * Map a raycast hit back to the node that owns it. A primitive is a single
	 * Mesh carrying its own nodeId, but an imported model is a whole subtree
	 * whose nodeId lives on the root — the ray hits a *child* mesh with no id
	 * of its own. Walk up to the nearest tagged ancestor so imported models
	 * are clickable in the viewport.
	 */
	#nodeIdFor(obj: THREE.Object3D): string | null {
		let cur: THREE.Object3D | null = obj;
		while (cur && cur !== this.sceneRoot) {
			const id = cur.userData?.nodeId as string | undefined;
			if (id) return id;
			cur = cur.parent;
		}
		return null;
	}

	/** Hidden objects shouldn't be clickable — three's raycaster doesn't check
	 *  `visible` for objects handed to it directly, and an imported model can
	 *  be hidden by its parent rather than on the mesh itself. */
	#isEffectivelyVisible(obj: THREE.Object3D): boolean {
		let cur: THREE.Object3D | null = obj;
		while (cur && cur !== this.sceneRoot) {
			if (!cur.visible) return false;
			cur = cur.parent;
		}
		return true;
	}

	#onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) return;
		const startX = e.clientX,
			startY = e.clientY;
		const dom = this.renderer.domElement;
		const up = (ev: PointerEvent) => {
			dom.removeEventListener('pointerup', up);
			if (this.gizmoWasDragging) {
				this.gizmoWasDragging = false;
				return;
			}
			const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY);
			if (moved > 4) return; // was an orbit drag
			const rect = dom.getBoundingClientRect();
			this.mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
			this.mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
			this.raycaster.setFromCamera(this.mouse, this.camera);
			const meshes: THREE.Object3D[] = [];
			this.sceneRoot.traverse((o) => {
				if ((o as THREE.Mesh).isMesh && this.#isEffectivelyVisible(o)) meshes.push(o);
			});
			const hits = this.raycaster.intersectObjects(meshes, false);
			const id = hits.length ? this.#nodeIdFor(hits[0].object) : null;
			if (id) {
				if (ev.ctrlKey || ev.metaKey) this.toggleSelection(id);
				else this.setSelection([id]);
			} else if (!(ev.ctrlKey || ev.metaKey)) {
				this.setSelection([]);
			}
		};
		dom.addEventListener('pointerup', up);
	};

	focusOnSelection = () => {
		const ids = docStore.selectedIds.length ? docStore.selectedIds : docStore.children(null).map((n) => n.id);
		if (!ids.length) return;
		const box = new THREE.Box3();
		let any = false;
		for (const id of ids) {
			const obj = this.threeObjects.get(id);
			if (obj) {
				box.expandByObject(obj);
				any = true;
			}
		}
		if (!any) return;
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3()).length();
		this.controls.target.copy(center);
		this.controls.spherical.radius = Math.max(2.5, size * 1.4);
	};

	// ---- spec plate ---------------------------------------------------------
	#updateSpecPlate() {
		if (!docStore.selectedIds.length) {
			this.specPlate = null;
			return;
		}
		const roots = docStore.selectionRoots();
		const meshes = docStore.selectionMeshes(true);
		let tris = 0,
			any = false;
		const box = new THREE.Box3();
		for (const n of roots) {
			const o = this.threeObjects.get(n.id);
			if (o) {
				o.updateWorldMatrix(true, true);
				tris += countTris(o);
				box.expandByObject(o);
				any = true;
			}
		}
		if (!any) {
			this.specPlate = null;
			return;
		}
		const size = box.getSize(new THREE.Vector3());
		const single = docStore.selectedIds.length === 1 ? docStore.node(docStore.selectedIds[0]) : null;
		const rows: [string, string][] = [];
		if (single) {
			const typeLabel = isGroup(single) ? 'group' : isPrimitive(single) ? GEO_DEFS[single.type].label : 'model';
			rows.push(['type', typeLabel]);
			if (isGroup(single) || isImported(single)) rows.push(['meshes', String(meshes.length)]);
		} else {
			rows.push(['selected', `${docStore.selectedIds.length} objects`]);
			rows.push(['meshes', String(meshes.length)]);
		}
		rows.push(['tris', String(tris)]);
		rows.push(['size', `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`]);
		if (single) {
			const p = single.transform.position;
			rows.push(['pos', `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`]);
		}
		this.specPlate = { title: single ? single.name : `${docStore.selectedIds.length} selected`, rows };
	}

	// ---- CRUD ---------------------------------------------------------------
	addPrimitive(type: PrimitiveType) {
		docStore.mark(null);
		const sel = docStore.selectedIds;
		const soleSelected = sel.length === 1 ? docStore.node(sel[0]) : undefined;
		const parentId = soleSelected && isGroup(soleSelected) ? soleSelected.id : null;
		const materialId = docStore.newId('m');
		docStore.doc.materials[materialId] = defaultMaterial(randomPaletteColor());
		const siblingCount = docStore.children(parentId).length;
		const node: PrimitiveNode = {
			id: docStore.newId(),
			parentId,
			name: GEO_DEFS[type].label,
			kind: 'primitive',
			type,
			visible: true,
			locked: false,
			transform: {
				...defaultTransform(),
				position: {
					x: (siblingCount % 4) * 1.4 - 2,
					y: defaultGroundY(type),
					z: Math.floor(siblingCount / 4) * 1.4
				}
			},
			geometry: { ...GEO_DEFS[type].defaults },
			materialId,
			castShadow: true,
			receiveShadow: true
		};
		docStore.doc.nodes.push(node);
		// Synchronous, not requestSync() — setSelection() below needs node.id
		// to already resolve in threeObjects if "Orbit around selection" is on,
		// not next-frame (see the same note on duplicateSelection()).
		this.syncScene();
		this.setSelection([node.id]);
		editorStore.toast('Added ' + node.name);
	}

	addGroup() {
		docStore.mark(null);
		const node: GroupNode = {
			id: docStore.newId(),
			parentId: null,
			name: 'Group',
			kind: 'group',
			visible: true,
			locked: false,
			transform: defaultTransform()
		};
		docStore.doc.nodes.push(node);
		this.syncScene();
		this.setSelection([node.id]);
	}

	/**
	 * Register a freshly-loaded model (already run through normalizeImport())
	 * as an Asset + ImportedNode. normalizeImport() bakes a centered/grounded
	 * position and a uniform scale directly onto `object`; we lift those into
	 * node.transform — the single source of truth the sync loop re-applies
	 * every frame — and reset the cached template to identity, so cloning it
	 * for further placements doesn't double-apply the offset.
	 */
	addImportedObject(
		object: THREE.Object3D,
		meta: { name: string; format: Asset['format']; source: AssetSource; stats: { meshes: number; triangles: number } }
	) {
		docStore.mark(null);

		const groundedY = object.position.y;
		const scale = { x: object.scale.x, y: object.scale.y, z: object.scale.z };
		object.position.set(0, 0, 0);
		object.scale.set(1, 1, 1);

		const assetId = docStore.newId('a');
		const asset: Asset = { id: assetId, name: meta.name, kind: 'model', format: meta.format, source: meta.source };
		docStore.doc.assets[assetId] = asset;
		this.#assetCache.set(assetId, object);

		const sel = docStore.selectedIds;
		const soleSelected = sel.length === 1 ? docStore.node(sel[0]) : undefined;
		const parentId = soleSelected && isGroup(soleSelected) ? soleSelected.id : null;
		const siblingCount = docStore.children(parentId).length;

		const node: ImportedNode = {
			id: docStore.newId(),
			parentId,
			name: meta.name,
			kind: 'imported',
			assetId,
			materialOverride: null,
			visible: true,
			locked: false,
			transform: {
				position: {
					x: round3((siblingCount % 4) * 1.4 - 2),
					y: round3(groundedY),
					z: round3(Math.floor(siblingCount / 4) * 1.4)
				},
				rotation: { x: 0, y: 0, z: 0 },
				scale
			},
			castShadow: true,
			receiveShadow: true,
			stats: meta.stats,
			part: null
		};
		docStore.doc.nodes.push(node);
		this.syncScene();
		this.setSelection([node.id]);
		editorStore.toast('Added ' + meta.name);
	}

	/**
	 * Same asset-registration as addImportedObject(), but for a model the user
	 * chose to bring in as separate objects: one Asset + cached template as
	 * before, but a GroupNode carrying the normalize/ground transform, with
	 * one ImportedNode per part underneath it at identity local transform.
	 * Because three.js composes parent*child transforms, the group renders
	 * identically to a merged import — the parts are just independently
	 * selectable, movable and recolourable now.
	 */
	addImportedObjectSplit(
		object: THREE.Object3D,
		parts: ImportPart[],
		meta: { name: string; format: Asset['format']; source: AssetSource; stats: { meshes: number; triangles: number } }
	) {
		docStore.mark(null);

		const groundedY = object.position.y;
		const scale = { x: object.scale.x, y: object.scale.y, z: object.scale.z };
		object.position.set(0, 0, 0);
		object.scale.set(1, 1, 1);

		const assetId = docStore.newId('a');
		const asset: Asset = { id: assetId, name: meta.name, kind: 'model', format: meta.format, source: meta.source };
		docStore.doc.assets[assetId] = asset;
		this.#assetCache.set(assetId, object);

		const sel = docStore.selectedIds;
		const soleSelected = sel.length === 1 ? docStore.node(sel[0]) : undefined;
		const parentId = soleSelected && isGroup(soleSelected) ? soleSelected.id : null;
		const siblingCount = docStore.children(parentId).length;

		const groupNode: GroupNode = {
			id: docStore.newId(),
			parentId,
			name: meta.name,
			kind: 'group',
			visible: true,
			locked: false,
			transform: {
				position: {
					x: round3((siblingCount % 4) * 1.4 - 2),
					y: round3(groundedY),
					z: round3(Math.floor(siblingCount / 4) * 1.4)
				},
				rotation: { x: 0, y: 0, z: 0 },
				scale
			}
		};
		docStore.doc.nodes.push(groupNode);

		for (const part of parts) {
			const node: ImportedNode = {
				id: docStore.newId(),
				parentId: groupNode.id,
				name: part.name,
				kind: 'imported',
				assetId,
				materialOverride: null,
				visible: true,
				locked: false,
				// Pivoting the node at the part's own geometry centre (rather than
				// identity, i.e. the whole file's shared origin) is what gives it a
				// sane rotate/scale gizmo — see #buildImportedObject() for the other
				// half of this: the wrapper that keeps the part rendering exactly
				// where it originally sat once its own origin has moved like this.
				transform: { ...defaultTransform(), position: { ...part.center } },
				castShadow: true,
				receiveShadow: true,
				stats: part.stats,
				part: { index: part.index, name: part.name, center: part.center }
			};
			docStore.doc.nodes.push(node);
		}
		this.syncScene();
		this.setSelection([groupNode.id]);
		editorStore.toast(`Added ${meta.name} as ${parts.length} objects`);
	}

	// ---- asset registry (used by the model library to restore models) -------
	hasAsset(assetId: string) {
		return this.#assetCache.has(assetId);
	}

	/**
	 * Install a freshly re-loaded model as the template for an asset that
	 * already has nodes pointing at it (the restore-after-reload path, as
	 * opposed to addImportedObject() which also creates a node). Normalizes
	 * then resets to identity so the template sits in the same frame of
	 * reference the nodes' already-saved transforms expect.
	 */
	registerRestoredAsset(assetId: string, object: THREE.Object3D) {
		normalizeImport(object);
		object.position.set(0, 0, 0);
		object.scale.set(1, 1, 1);
		this.#assetCache.set(assetId, object);
		this.requestSync();
	}

	/** Start overriding an imported model's materials with one editable
	 *  document material, so a model that arrived unpainted (or just wrong)
	 *  can be recoloured without touching the source file. */
	enableMaterialOverride(node: ImportedNode) {
		if (node.materialOverride) return;
		docStore.mark(null);
		const id = docStore.newId('m');
		docStore.doc.materials[id] = defaultMaterial('#b7b0a6');
		node.materialOverride = id;
		this.requestSync();
	}

	/** Drop the override and go back to the materials in the source file. */
	clearMaterialOverride(node: ImportedNode) {
		if (!node.materialOverride) return;
		docStore.mark(null);
		node.materialOverride = null;
		this.requestSync();
	}

	/** Assets referenced by imported nodes whose geometry isn't loaded in this
	 *  session — i.e. the ones currently drawn as placeholder boxes. */
	missingAssetIds(): string[] {
		const missing = new Set<string>();
		for (const node of docStore.doc.nodes) {
			if (isImported(node) && !this.#assetCache.has(node.assetId)) missing.add(node.assetId);
		}
		return [...missing];
	}

	deleteSelection() {
		if (!docStore.selectedIds.length) return;
		docStore.mark(null);
		docStore.remove(docStore.selectedIds);
		this.requestSync();
	}

	/** Bounding-box width of a live object, used to space duplicates apart. */
	widthOf(id: string): number {
		const o = this.threeObjects.get(id);
		if (!o) return 0.5;
		o.updateWorldMatrix(true, true);
		const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
		return isFinite(s.x) && s.x > 0.01 ? s.x : 0.5;
	}

	duplicateSelection() {
		if (!docStore.selectedIds.length) return;
		docStore.mark(null);
		const snap = editorStore.snapEnabled ? editorStore.snapStep : 0;
		const newIds = docStore.selectedIds
			.map((id) => docStore.duplicate(id, (nid) => this.widthOf(nid), snap))
			.filter((id): id is string => !!id);
		// Synchronous, not requestSync() — setSelection() below (with "Orbit
		// around selection" on) reads threeObjects.get() for each new id to
		// recentre the pivot, and requestSync() only runs on the next animation
		// frame, so the lookup would still be finding nothing.
		this.syncScene();
		this.setSelection(newIds);
		editorStore.toast('Duplicated');
	}

	groupSelection() {
		const sel = docStore.selectedIds;
		if (sel.length < 1) return;
		docStore.mark(null);
		this.syncScene(); // matrices must be current before we read them
		const soleParent = docStore.node(sel[0])?.parentId ?? null;
		const parentObj = soleParent ? this.threeObjects.get(soleParent) : this.sceneRoot;
		if (!parentObj) return;
		parentObj.updateMatrixWorld(true);

		const centroid = new THREE.Vector3();
		let count = 0;
		for (const id of sel) {
			const obj = this.threeObjects.get(id);
			if (obj) {
				const wp = new THREE.Vector3();
				obj.getWorldPosition(wp);
				centroid.add(wp);
				count++;
			}
		}
		if (count) centroid.divideScalar(count);

		const groupNode: GroupNode = {
			id: docStore.newId(),
			parentId: soleParent,
			name: 'Group',
			kind: 'group',
			visible: true,
			locked: false,
			transform: { ...defaultTransform(), position: { x: centroid.x, y: centroid.y, z: centroid.z } }
		};
		docStore.doc.nodes.push(groupNode);

		const parentWorldMatrix = parentObj.matrixWorld.clone();
		const trueGroupWorld = new THREE.Matrix4().multiplyMatrices(
			parentWorldMatrix,
			new THREE.Matrix4().compose(centroid, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
		);
		const groupWorldInverse = new THREE.Matrix4().copy(trueGroupWorld).invert();

		for (const id of sel) {
			const node = docStore.node(id);
			const obj = this.threeObjects.get(id);
			if (!node || !obj) continue;
			const childWorld = obj.matrixWorld.clone();
			const localMatrix = new THREE.Matrix4().multiplyMatrices(groupWorldInverse, childWorld);
			const pos = new THREE.Vector3(),
				quat = new THREE.Quaternion(),
				scl = new THREE.Vector3();
			localMatrix.decompose(pos, quat, scl);
			const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
			node.transform.position = { x: pos.x, y: pos.y, z: pos.z };
			node.transform.rotation = { x: R2D(euler.x), y: R2D(euler.y), z: R2D(euler.z) };
			node.transform.scale = { x: scl.x, y: scl.y, z: scl.z };
			node.parentId = groupNode.id;
		}
		// Synchronous, not requestSync() — see the same note in
		// duplicateSelection(): setSelection() below needs groupNode.id to
		// already resolve in threeObjects, not next-frame.
		this.syncScene();
		this.setSelection([groupNode.id]);
		editorStore.toast(`Grouped ${sel.length} object(s)`);
	}

	ungroupSelection() {
		if (docStore.selectedIds.length !== 1) return;
		const groupNode = docStore.node(docStore.selectedIds[0]);
		if (!groupNode || !isGroup(groupNode)) return;
		docStore.mark(null);
		this.syncScene();
		const groupObj = this.threeObjects.get(groupNode.id);
		if (!groupObj) return;
		groupObj.updateMatrixWorld(true);
		const newParentId = groupNode.parentId;
		const newParentObj = newParentId ? this.threeObjects.get(newParentId) : this.sceneRoot;
		if (!newParentObj) return;
		newParentObj.updateMatrixWorld(true);
		const newParentInverse = new THREE.Matrix4().copy(newParentObj.matrixWorld).invert();

		const children = docStore.children(groupNode.id);
		const childIds = children.map((c) => c.id);
		for (const node of children) {
			const obj = this.threeObjects.get(node.id);
			if (!obj) continue;
			const childWorld = obj.matrixWorld.clone();
			const localMatrix = new THREE.Matrix4().multiplyMatrices(newParentInverse, childWorld);
			const pos = new THREE.Vector3(),
				quat = new THREE.Quaternion(),
				scl = new THREE.Vector3();
			localMatrix.decompose(pos, quat, scl);
			const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
			node.transform.position = { x: pos.x, y: pos.y, z: pos.z };
			node.transform.rotation = { x: R2D(euler.x), y: R2D(euler.y), z: R2D(euler.z) };
			node.transform.scale = { x: scl.x, y: scl.y, z: scl.z };
			node.parentId = newParentId;
		}
		docStore.doc.nodes = docStore.doc.nodes.filter((n) => n.id !== groupNode.id);
		// Synchronous — the children just got new world transforms above, and
		// setSelection() below reads current object positions to recentre the
		// orbit pivot; requestSync() wouldn't apply those until next frame.
		this.syncScene();
		this.setSelection(childIds);
		editorStore.toast('Ungrouped');
	}

	isAncestorOf(ancestorId: string, id: string) {
		let n = docStore.node(id);
		while (n && n.parentId) {
			if (n.parentId === ancestorId) return true;
			n = docStore.node(n.parentId);
		}
		return false;
	}

	/**
	 * Move a whole set of nodes at once — what a hierarchy drag actually does,
	 * since dragging one row of a multi-selection is meant to carry the rest.
	 *
	 * `beforeId` places them among their new siblings (null = last), so this
	 * covers both "drop into that group" and "drop between these two rows".
	 * Anything already inside the moving set is skipped: a subtree travels with
	 * its root, and a node can't become its own descendant.
	 *
	 * World positions are preserved across the reparent, so nothing visibly
	 * jumps — that needs a sync in the middle to get the new parent matrices.
	 */
	moveNodes(ids: string[], newParentId: string | null, beforeId: string | null = null) {
		const moving = docStore
			.rootsOf(ids)
			.filter((n) => n.id !== newParentId && !(newParentId && this.isAncestorOf(n.id, newParentId)));
		if (!moving.length) return;

		const sameParent = moving.every((n) => (n.parentId ?? null) === (newParentId ?? null));
		if (sameParent && beforeId === null) return;

		docStore.mark(null);
		const worlds = new Map<string, THREE.Vector3>();
		for (const n of moving) {
			const obj = this.threeObjects.get(n.id);
			if (!obj) continue;
			obj.updateWorldMatrix(true, false);
			worlds.set(n.id, obj.getWorldPosition(new THREE.Vector3()));
		}

		for (const n of moving) {
			n.parentId = newParentId;
			docStore.moveInOrder(n.id, beforeId);
		}

		this.syncScene();
		for (const n of moving) {
			const world = worlds.get(n.id);
			if (!world) continue;
			const obj = this.threeObjects.get(n.id);
			const parent = obj?.parent ?? this.sceneRoot;
			parent.updateWorldMatrix(true, false);
			const local = parent.worldToLocal(world.clone());
			n.transform.position = { x: round3(local.x), y: round3(local.y), z: round3(local.z) };
		}

		this.requestSync();
		editorStore.toast(moving.length === 1 ? 'Moved in hierarchy' : `Moved ${moving.length} objects`);
	}

	reparentNode(id: string, newParentId: string | null) {
		const node = docStore.node(id);
		if (!node || (node.parentId ?? null) === (newParentId ?? null)) return;
		docStore.mark(null);
		const obj = this.threeObjects.get(id);
		let world: THREE.Vector3 | null = null;
		if (obj) {
			obj.updateWorldMatrix(true, false);
			world = obj.getWorldPosition(new THREE.Vector3());
		}
		docStore.reparent(id, newParentId, () => {
			if (!world) return null;
			this.syncScene();
			const o2 = this.threeObjects.get(id);
			const parent = (o2 && o2.parent) || this.sceneRoot;
			parent.updateWorldMatrix(true, false);
			const local = parent.worldToLocal(world.clone());
			return { x: round3(local.x), y: round3(local.y), z: round3(local.z) };
		});
		this.requestSync();
		editorStore.toast('Moved in hierarchy');
	}

	// ---- world-space helpers --------------------------------------------------
	worldBoxOf(node: SceneNode): THREE.Box3 | null {
		const obj = this.threeObjects.get(node.id);
		if (!obj) return null;
		obj.updateWorldMatrix(true, true);
		return new THREE.Box3().setFromObject(obj);
	}

	/** Translate a node by a world-space delta, correcting for parent rotation. */
	nudgeWorld(node: SceneNode, axis: Axis, delta: number) {
		if (!delta) return;
		const obj = this.threeObjects.get(node.id);
		if (!obj) return;
		const parent = obj.parent || this.sceneRoot;
		parent.updateWorldMatrix(true, false);
		const world = new THREE.Vector3();
		world[axis] = delta;
		const a = parent.worldToLocal(new THREE.Vector3(0, 0, 0));
		const b = parent.worldToLocal(world);
		node.transform.position.x = round3(node.transform.position.x + (b.x - a.x));
		node.transform.position.y = round3(node.transform.position.y + (b.y - a.y));
		node.transform.position.z = round3(node.transform.position.z + (b.z - a.z));
	}

	// ---- arrangement tools ------------------------------------------------
	alignSelection(axis: Axis, mode: 'min' | 'center' | 'max') {
		const roots = docStore.selectionRoots();
		if (roots.length < 2) {
			editorStore.toast('Select at least two objects');
			return;
		}
		docStore.mark(null);
		const items = roots.map((n) => ({ n, b: this.worldBoxOf(n) })).filter((x) => x.b);
		const valOf = (b: THREE.Box3) =>
			mode === 'min' ? b.min[axis] : mode === 'max' ? b.max[axis] : (b.min[axis] + b.max[axis]) / 2;
		const vals = items.map((x) => valOf(x.b!));
		const target =
			mode === 'min'
				? Math.min(...vals)
				: mode === 'max'
					? Math.max(...vals)
					: vals.reduce((a, b) => a + b, 0) / vals.length;
		items.forEach((x, i) => this.nudgeWorld(x.n, axis, target - vals[i]));
		this.requestSync();
		editorStore.toast('Aligned ' + axis.toUpperCase());
	}

	distributeSelection(axis: Axis) {
		const roots = docStore.selectionRoots();
		if (roots.length < 3) {
			editorStore.toast('Select three or more objects');
			return;
		}
		docStore.mark(null);
		const items = roots
			.map((n) => {
				const b = this.worldBoxOf(n);
				return b ? { n, v: (b.min[axis] + b.max[axis]) / 2 } : null;
			})
			.filter((x): x is { n: SceneNode; v: number } => !!x);
		items.sort((a, b) => a.v - b.v);
		const first = items[0].v,
			last = items[items.length - 1].v;
		const step = (last - first) / (items.length - 1);
		items.forEach((it, i) => this.nudgeWorld(it.n, axis, first + step * i - it.v));
		this.requestSync();
		editorStore.toast('Distributed along ' + axis.toUpperCase());
	}

	/** "Ground" is whichever axis Settings nominates as down — Y for a normal
	 *  scene, but a wall layout may want X or Z instead. */
	dropToGround() {
		const roots = docStore.selectionRoots();
		if (!roots.length) {
			editorStore.toast('Nothing selected');
			return;
		}
		const axis = editorStore.dropAxis;
		docStore.mark(null);
		roots.forEach((n) => {
			const b = this.worldBoxOf(n);
			if (b) this.nudgeWorld(n, axis, -b.min[axis]);
		});
		this.requestSync();
		editorStore.toast(`Dropped to ${axis.toUpperCase()} = 0`);
	}

	randomizeSelection() {
		const roots = docStore.selectionRoots();
		if (!roots.length) return;
		docStore.mark(null);
		roots.forEach((n) => {
			n.transform.rotation.y = round3(n.transform.rotation.y + (Math.random() * 2 - 1) * 180);
			n.transform.rotation.x = round3(n.transform.rotation.x + (Math.random() * 2 - 1) * 12);
			n.transform.rotation.z = round3(n.transform.rotation.z + (Math.random() * 2 - 1) * 12);
			const s = 1 + (Math.random() * 2 - 1) * 0.18;
			n.transform.scale.x = round3(n.transform.scale.x * s);
			n.transform.scale.y = round3(n.transform.scale.y * s);
			n.transform.scale.z = round3(n.transform.scale.z * s);
		});
		this.requestSync();
	}

	resetTransform(kind: 'position' | 'rotation' | 'scale') {
		const roots = docStore.selectionRoots();
		if (!roots.length) return;
		docStore.mark(null);
		roots.forEach((n) => {
			if (kind === 'rotation') n.transform.rotation = { x: 0, y: 0, z: 0 };
			else if (kind === 'scale') n.transform.scale = { x: 1, y: 1, z: 1 };
			else n.transform.position = { x: 0, y: 0, z: 0 };
		});
		this.requestSync();
	}

	/**
	 * Flip across a plane. Plane XY has normal Z, so it mirrors Z; position is
	 * mirrored about the selection's own centre, orientation conjugated by the
	 * reflection, and the normal axis of scale negated so geometry itself flips.
	 */
	flipAcross(plane: 'xy' | 'yz' | 'zx') {
		const normal = PLANE_NORMAL[plane];
		const roots = docStore.selectionRoots();
		if (!roots.length) {
			editorStore.toast('Nothing selected');
			return;
		}
		docStore.mark(null);
		const box = new THREE.Box3();
		let any = false;
		roots.forEach((n) => {
			const o = this.threeObjects.get(n.id);
			if (o) {
				o.updateWorldMatrix(true, true);
				box.expandByObject(o);
				any = true;
			}
		});
		const centre = any ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();

		roots.forEach((n) => {
			const o = this.threeObjects.get(n.id);
			if (o) {
				o.updateWorldMatrix(true, false);
				const wp = o.getWorldPosition(new THREE.Vector3());
				this.nudgeWorld(n, normal, 2 * (centre[normal] - wp[normal]));
			}
			const r = n.transform.rotation;
			const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(D2R(r.x), D2R(r.y), D2R(r.z), 'XYZ'));
			if (normal === 'x') q.set(q.x, -q.y, -q.z, q.w);
			else if (normal === 'y') q.set(-q.x, q.y, -q.z, q.w);
			else q.set(-q.x, -q.y, q.z, q.w);
			const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
			n.transform.rotation = { x: round3(R2D(e.x)), y: round3(R2D(e.y)), z: round3(R2D(e.z)) };
			n.transform.scale[normal] = round3(-n.transform.scale[normal]);
		});
		this.requestSync();
		editorStore.toast('Flipped across ' + plane.toUpperCase());
	}

	// ---- material clipboard -------------------------------------------------
	// Only PrimitiveNode carries a materialId (ImportedNode keeps its file's
	// own materials, out of scope for this pass), so these narrow with
	// isPrimitive rather than the broader isMeshNode.
	copyMaterialFrom(node: SceneNode) {
		if (!isPrimitive(node)) return;
		const mat = docStore.doc.materials[node.materialId];
		if (!mat) return;
		editorStore.materialClipboard = copyOf(mat);
		editorStore.toast('Material copied');
	}

	pasteMaterialToSelection() {
		if (!editorStore.materialClipboard) {
			editorStore.toast('Copy a material first');
			return;
		}
		const meshes = docStore.selectionMeshes(true).filter(isPrimitive);
		if (!meshes.length) {
			editorStore.toast('No meshes selected');
			return;
		}
		docStore.mark(null);
		for (const n of meshes) {
			const id = docStore.newId('m');
			docStore.doc.materials[id] = copyOf(editorStore.materialClipboard);
			n.materialId = id;
		}
		this.requestSync();
		editorStore.toast('Material pasted to ' + meshes.length);
	}

	/** Batch material edit: mutates each distinct material entry touched by
	 *  `meshes` exactly once, so nodes sharing a materialId stay in sync. */
	batchEditMaterial(meshes: PrimitiveNode[], mutate: (id: string) => void) {
		const seen = new Set<string>();
		for (const n of meshes) {
			if (seen.has(n.materialId)) continue;
			seen.add(n.materialId);
			mutate(n.materialId);
		}
		this.requestSync();
	}

	/** Give a node its own material entry, breaking any sharing link. */
	unlinkMaterial(node: PrimitiveNode) {
		const current = docStore.doc.materials[node.materialId];
		if (!current) return;
		docStore.mark(null);
		const id = docStore.newId('m');
		docStore.doc.materials[id] = copyOf(current);
		node.materialId = id;
		this.requestSync();
	}

	/**
	 * Give every object that shares a material its own copy.
	 *
	 * Sharing a materialId is deliberate — it's how a duplicated crate stays in
	 * sync with its original, one edit repainting them all. But a model that
	 * arrived as a single authored document often points dozens of parts at one
	 * material, and then recolouring a door repaints the whole tower. This
	 * breaks every shared link in one pass so each part is independently
	 * paintable.
	 *
	 * Within each group of sharers the first keeps the original entry, so no
	 * material is left orphaned. Objects that already had a material to
	 * themselves are untouched. Returns how many objects were detached.
	 */
	unshareAllMaterials(): number {
		// Collect a setter per user rather than the node, so primitives and an
		// imported node's override material can be handled in one pass.
		const users = new Map<string, ((id: string) => void)[]>();
		const add = (matId: string, apply: (id: string) => void) => {
			const list = users.get(matId) ?? [];
			list.push(apply);
			users.set(matId, list);
		};
		for (const n of docStore.doc.nodes) {
			if (isPrimitive(n)) add(n.materialId, (id) => (n.materialId = id));
			else if (isImported(n) && n.materialOverride) add(n.materialOverride, (id) => (n.materialOverride = id));
		}

		let detached = 0;
		for (const [matId, appliers] of users) {
			const source = docStore.doc.materials[matId];
			if (!source || appliers.length < 2) continue;
			for (const apply of appliers.slice(1)) {
				if (!detached) docStore.mark(null); // one history entry for the whole pass
				const id = docStore.newId('m');
				// A fresh copy each time — sharing one object here would just
				// re-link everything we're trying to unshare.
				docStore.doc.materials[id] = copyOf(source);
				apply(id);
				detached++;
			}
		}
		if (detached) this.requestSync();
		return detached;
	}

	/** How many objects would `unshareAllMaterials()` detach — drives the
	 *  button's tooltip so the user knows what they're about to change. */
	sharedMaterialCount(): number {
		const counts = new Map<string, number>();
		for (const n of docStore.doc.nodes) {
			const id = isPrimitive(n) ? n.materialId : isImported(n) ? n.materialOverride : null;
			if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		let shared = 0;
		for (const c of counts.values()) if (c > 1) shared += c - 1;
		return shared;
	}

	// ---- keyboard nudge -------------------------------------------------------
	nudgeByKey(e: KeyboardEvent) {
		const roots = docStore.selectionRoots();
		if (!roots.length) return;
		const map: Record<string, [Axis, number]> = {
			ArrowLeft: ['x', -1],
			ArrowRight: ['x', 1],
			ArrowUp: ['z', -1],
			ArrowDown: ['z', 1]
		};
		const entry = map[e.key];
		if (!entry) return;
		e.preventDefault();
		let [axis, sign] = entry;
		if (e.shiftKey) {
			axis = 'y';
			sign = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1;
		}
		const step = editorStore.snapEnabled ? editorStore.snapStep : 0.1;
		docStore.mark('nudge:' + axis);
		roots.forEach((n) => {
			n.transform.position[axis] = round3(n.transform.position[axis] + sign * step);
		});
		this.requestSync();
	}

	// ---- WASD camera --------------------------------------------------------
	#WORLD_UP = new THREE.Vector3(0, 1, 0);
	#updateCameraKeys() {
		if (!this.heldKeys.size || !this.controls) return;
		const sph = this.controls.spherical;
		if (this.heldKeys.has('shift')) {
			if (this.heldKeys.has('a')) sph.theta += 0.028;
			if (this.heldKeys.has('d')) sph.theta -= 0.028;
			if (this.heldKeys.has('w')) sph.phi = Math.max(0.06, sph.phi - 0.02);
			if (this.heldKeys.has('s')) sph.phi = Math.min(Math.PI - 0.06, sph.phi + 0.02);
			return;
		}
		const forward = new THREE.Vector3();
		this.camera.getWorldDirection(forward);
		forward.y = 0;
		if (forward.lengthSq() < 1e-6) return;
		forward.normalize();
		const right = new THREE.Vector3().crossVectors(forward, this.#WORLD_UP).normalize();
		const dir = new THREE.Vector3();
		if (this.heldKeys.has('w')) dir.add(forward);
		if (this.heldKeys.has('s')) dir.sub(forward);
		if (this.heldKeys.has('d')) dir.add(right);
		if (this.heldKeys.has('a')) dir.sub(right);
		if (dir.lengthSq() < 1e-6) return;
		this.controls.target.addScaledVector(dir.normalize(), sph.radius * 0.018);
	}

	// ---- gizmo: build -------------------------------------------------------
	#buildGizmo() {
		const gizmoGroup = new THREE.Group();
		gizmoGroup.visible = false;
		this.helpersGroup.add(gizmoGroup);
		this.#gizmoGroup = gizmoGroup;

		// translate â arrows both ways on every axis, plus three plane handles
		const tG = new THREE.Group();
		AXIS_INFO.forEach((a) => {
			[1, -1].forEach((sign) => {
				const arm = new THREE.Group();
				const mat = gzMat(a.color);
				const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.74, 8), mat);
				shaft.position.y = 0.41;
				shaft.renderOrder = 999;
				const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.17, 12), mat);
				tip.position.y = 0.88;
				tip.renderOrder = 999;
				const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.84, 6), gzPick());
				pick.position.y = 0.55;
				pick.userData.gizmoDir = a.dir;
				arm.add(shaft, tip, pick);
				arm.rotation.set(a.rot[0], a.rot[1], a.rot[2]);
				if (sign < 0) arm.scale.y = -1;
				tG.add(arm);
				this.#gizmoHandles.translate.push(pick);
			});
		});
		PLANE_INFO.forEach((p) => {
			const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), gzMat(p.color, 0.32));
			quad.position.set(p.pos[0], p.pos[1], p.pos[2]);
			quad.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
			quad.renderOrder = 999;
			quad.userData.gizmoPlane = p.normal;
			tG.add(quad);
			this.#gizmoHandles.translate.push(quad);
		});

		// rotate â one ring per axis
		const rG = new THREE.Group();
		AXIS_INFO.forEach((a) => {
			const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.012, 8, 56), gzMat(a.color));
			ring.rotation.set(a.ring[0], a.ring[1], a.ring[2]);
			ring.renderOrder = 999;
			const pick = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.06, 6, 32), gzPick());
			pick.rotation.set(a.ring[0], a.ring[1], a.ring[2]);
			pick.userData.gizmoRotAxis = a.dir;
			rG.add(ring, pick);
			this.#gizmoHandles.rotate.push(pick);
		});

		// scale â knobs per axis plus a uniform cube at the centre
		const sG = new THREE.Group();
		AXIS_INFO.forEach((a) => {
			const arm = new THREE.Group();
			const mat = gzMat(a.color);
			const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.74, 8), mat);
			shaft.position.y = 0.4;
			shaft.renderOrder = 999;
			const knob = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), mat);
			knob.position.y = 0.84;
			knob.renderOrder = 999;
			const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.84, 6), gzPick());
			pick.position.y = 0.55;
			pick.userData.gizmoScaleAxis = a.axis;
			arm.add(shaft, knob, pick);
			arm.rotation.set(a.rot[0], a.rot[1], a.rot[2]);
			sG.add(arm);
			this.#gizmoHandles.scale.push(pick);
		});
		const uni = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), gzMat(0xe2a35f));
		uni.renderOrder = 999;
		uni.userData.gizmoScaleAxis = 'uniform';
		sG.add(uni);
		this.#gizmoHandles.scale.push(uni);

		this.#gizmoParts = { translate: tG, rotate: rG, scale: sG };
		gizmoGroup.add(tG, rG, sG);
	}

	#updateGizmoTransform() {
		const gizmoGroup = this.#gizmoGroup;
		if (!gizmoGroup) return;
		if (!docStore.selectedIds.length) {
			gizmoGroup.visible = false;
			return;
		}
		const roots = docStore.selectionRoots();
		const c = new THREE.Vector3();
		let count = 0;
		for (const nd of roots) {
			const o = this.threeObjects.get(nd.id);
			if (o) {
				o.updateWorldMatrix(true, false);
				c.add(o.getWorldPosition(new THREE.Vector3()));
				count++;
			}
		}
		if (!count) {
			gizmoGroup.visible = false;
			return;
		}
		c.divideScalar(count);
		gizmoGroup.position.copy(c);
		gizmoGroup.visible = true;
		const mode = editorStore.gizmoMode;
		this.#gizmoParts.translate.visible = mode === 'translate';
		this.#gizmoParts.rotate.visible = mode === 'rotate';
		this.#gizmoParts.scale.visible = mode === 'scale';
		// Scale always resizes an object along its own local axes, so once an
		// object is rotated a world-aligned scale gizmo points a different way
		// than what dragging it actually does. For a single selection, orient
		// the scale handles to match the object's rotation so the handle you
		// drag is the axis it scales. (Left world-aligned for multi-select,
		// where there's no one rotation to match.)
		const singleObj = roots.length === 1 ? this.threeObjects.get(roots[0].id) : null;
		if (singleObj) {
			singleObj.updateWorldMatrix(true, false);
			this.#gizmoParts.scale.quaternion.copy(singleObj.getWorldQuaternion(new THREE.Quaternion()));
		} else {
			this.#gizmoParts.scale.quaternion.identity();
		}
		gizmoGroup.scale.setScalar(Math.max(0.35, this.camera.position.distanceTo(c) * 0.15));
	}

	#pointerNDC(e: PointerEvent) {
		const rect = this.renderer.domElement.getBoundingClientRect();
		return new THREE.Vector2(
			((e.clientX - rect.left) / rect.width) * 2 - 1,
			-((e.clientY - rect.top) / rect.height) * 2 + 1
		);
	}
	#cameraFacingPlane(origin: THREE.Vector3) {
		const n = new THREE.Vector3().subVectors(this.camera.position, origin).normalize();
		return new THREE.Plane().setFromNormalAndCoplanarPoint(n, origin);
	}

	/** Called from the orbit controls' pointerdown before it commits to an
	 *  orbit drag; returns true if a gizmo handle was grabbed instead. */
	gizmoTryGrab = (e: PointerEvent): boolean => {
		const gizmoGroup = this.#gizmoGroup;
		if (!gizmoGroup || !gizmoGroup.visible || this.#gizmoDrag) return false;
		this.raycaster.setFromCamera(this.#pointerNDC(e), this.camera);
		const hits = this.raycaster.intersectObjects(this.#gizmoHandles[editorStore.gizmoMode], false);
		if (!hits.length) return false;
		const h = hits[0].object;
		const origin = gizmoGroup.position.clone();
		const roots = docStore.selectionRoots();
		if (!roots.length) return false;

		const targets: GizmoTarget[] = roots.map((nd) => {
			const obj = this.threeObjects.get(nd.id);
			const parent = (obj && obj.parent) || this.sceneRoot;
			parent.updateWorldMatrix(true, false);
			const t: GizmoTarget = {
				node: nd,
				parent,
				start: { ...nd.transform.position },
				startScale: { ...nd.transform.scale }
			};
			if (obj) {
				obj.updateWorldMatrix(true, false);
				t.startWorldPos = obj.getWorldPosition(new THREE.Vector3());
				t.startWorldQ = obj.getWorldQuaternion(new THREE.Quaternion());
				t.parentWorldQInv = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
				if (editorStore.gizmoMode === 'scale') {
					t.localBox = localBounds(obj);
					t.startLocalQ = obj.quaternion.clone();
				}
			}
			return t;
		});

		let plane: THREE.Plane,
			axisDir: THREE.Vector3 | null = null,
			rotAxis: THREE.Vector3 | null = null,
			scaleAxis: string | null = null,
			startProj = 0,
			startVec: THREE.Vector3 | null = null;

		if (editorStore.gizmoMode === 'rotate') {
			rotAxis = (h.userData.gizmoRotAxis as THREE.Vector3).clone();
			plane = new THREE.Plane().setFromNormalAndCoplanarPoint(rotAxis.clone(), origin);
			const p0 = new THREE.Vector3();
			if (!this.raycaster.ray.intersectPlane(plane, p0)) return false;
			startVec = p0.clone().sub(origin);
			if (startVec.lengthSq() < 1e-8) return false;
		} else if (editorStore.gizmoMode === 'scale') {
			scaleAxis = h.userData.gizmoScaleAxis as string;
			if (scaleAxis === 'uniform') {
				plane = this.#cameraFacingPlane(origin);
				const p0 = new THREE.Vector3();
				if (!this.raycaster.ray.intersectPlane(plane, p0)) return false;
				axisDir = p0.clone().sub(origin);
				if (axisDir.lengthSq() < 1e-8) return false;
				startProj = axisDir.length();
				axisDir.normalize();
			} else {
				const info = AXIS_INFO.find((a) => a.axis === scaleAxis)!;
				// Read the axis off the handle's actual current orientation (which
				// tracks the object's rotation, see #updateGizmoTransform) rather
				// than the raw world-space table, so the drag always follows the
				// direction the handle is drawn pointing.
				axisDir = info.dir.clone().applyQuaternion(this.#gizmoParts.scale.getWorldQuaternion(new THREE.Quaternion()));
				const camDir = new THREE.Vector3().subVectors(this.camera.position, origin).normalize();
				const nrm = new THREE.Vector3().crossVectors(axisDir, camDir).cross(axisDir);
				if (nrm.lengthSq() < 1e-6) nrm.set(0, 1, 0);
				plane = new THREE.Plane().setFromNormalAndCoplanarPoint(nrm.normalize(), origin);
				const p0 = new THREE.Vector3();
				if (!this.raycaster.ray.intersectPlane(plane, p0)) return false;
				startProj = p0.clone().sub(origin).dot(axisDir);
				if (Math.abs(startProj) < 1e-4) return false;
			}
		} else {
			if (h.userData.gizmoPlane) {
				plane = new THREE.Plane().setFromNormalAndCoplanarPoint((h.userData.gizmoPlane as THREE.Vector3).clone(), origin);
			} else {
				axisDir = (h.userData.gizmoDir as THREE.Vector3).clone();
				const camDir = new THREE.Vector3().subVectors(this.camera.position, origin).normalize();
				const nrm = new THREE.Vector3().crossVectors(axisDir, camDir).cross(axisDir);
				if (nrm.lengthSq() < 1e-6) nrm.set(0, 1, 0);
				plane = new THREE.Plane().setFromNormalAndCoplanarPoint(nrm.normalize(), origin);
			}
			const p0 = new THREE.Vector3();
			if (!this.raycaster.ray.intersectPlane(plane, p0)) return false;
			startVec = p0;
		}

		docStore.mark('gizmo:' + Date.now());
		this.#gizmoDrag = {
			mode: editorStore.gizmoMode,
			plane,
			origin,
			targets,
			axisDir,
			rotAxis,
			scaleAxis,
			startProj,
			startVec,
			p0: editorStore.gizmoMode === 'translate' ? startVec : null
		};
		this.gizmoWasDragging = true;
		window.addEventListener('pointermove', this.#onGizmoMove);
		window.addEventListener('pointerup', this.#onGizmoUp);
		return true;
	};

	#onGizmoMove = (e: PointerEvent) => {
		const drag = this.#gizmoDrag;
		if (!drag) return;
		this.raycaster.setFromCamera(this.#pointerNDC(e), this.camera);
		const p = new THREE.Vector3();
		if (!this.raycaster.ray.intersectPlane(drag.plane, p)) return;

		if (drag.mode === 'translate') {
			let delta = new THREE.Vector3().subVectors(p, drag.p0!);
			if (drag.axisDir) delta = drag.axisDir.clone().multiplyScalar(delta.dot(drag.axisDir));
			drag.targets.forEach((t) => {
				t.parent.updateWorldMatrix(true, false);
				const a = t.parent.worldToLocal(new THREE.Vector3(0, 0, 0));
				const b = t.parent.worldToLocal(delta.clone());
				t.node.transform.position.x = round3(editorStore.snapVal(t.start.x + (b.x - a.x)));
				t.node.transform.position.y = round3(editorStore.snapVal(t.start.y + (b.y - a.y)));
				t.node.transform.position.z = round3(editorStore.snapVal(t.start.z + (b.z - a.z)));
			});
		} else if (drag.mode === 'rotate') {
			const v = p.clone().sub(drag.origin);
			if (v.lengthSq() < 1e-8) return;
			let angle = Math.atan2(
				new THREE.Vector3().crossVectors(drag.startVec!, v).dot(drag.rotAxis!),
				drag.startVec!.dot(v)
			);
			if (editorStore.snapEnabled) {
				const s = D2R(editorStore.snapAngle);
				if (s > 0) angle = Math.round(angle / s) * s;
			}
			const dq = new THREE.Quaternion().setFromAxisAngle(drag.rotAxis!, angle);
			drag.targets.forEach((t) => {
				if (!t.startWorldQ) return;
				const worldQ = dq.clone().multiply(t.startWorldQ);
				const localQ = t.parentWorldQInv!.clone().multiply(worldQ);
				const eul = new THREE.Euler().setFromQuaternion(localQ, 'XYZ');
				t.node.transform.rotation = { x: round3(R2D(eul.x)), y: round3(R2D(eul.y)), z: round3(R2D(eul.z)) };
				if (drag.targets.length > 1) {
					const rel = t.startWorldPos!.clone().sub(drag.origin).applyQuaternion(dq).add(drag.origin);
					t.parent.updateWorldMatrix(true, false);
					const local = t.parent.worldToLocal(rel);
					t.node.transform.position = { x: round3(local.x), y: round3(local.y), z: round3(local.z) };
				}
			});
		} else {
			const cur = p.clone().sub(drag.origin);
			const proj = cur.dot(drag.axisDir!);
			let f = proj / drag.startProj;
			if (!isFinite(f)) return;
			f = Math.max(0.02, Math.min(40, f));
			if (editorStore.snapEnabled) f = Math.round(f * 10) / 10 || 0.1;
			// Shift pins the edge opposite the handle in place instead of scaling
			// from the object's centre — held live, so toggling it mid-drag
			// switches modes without restarting the drag.
			const anchorFarEdge = drag.scaleAxis !== 'uniform' && e.shiftKey;
			drag.targets.forEach((t) => {
				// With more than one object selected, "scale the selection" should
				// also spread the objects apart from the shared pivot (drag.origin),
				// same as translate/rotate already do — otherwise everything just
				// grows or shrinks in place and overlaps. For a single selection
				// this target's own pivot IS drag.origin, so the offset is zero and
				// this is a no-op.
				let groupPos = t.start;
				if (t.startWorldPos) {
					const offset = t.startWorldPos.clone().sub(drag.origin);
					const newOffset =
						drag.scaleAxis === 'uniform'
							? offset.clone().multiplyScalar(f)
							: offset.clone().addScaledVector(drag.axisDir!, offset.dot(drag.axisDir!) * (f - 1));
					t.parent.updateWorldMatrix(true, false);
					const local = t.parent.worldToLocal(drag.origin.clone().add(newOffset));
					groupPos = { x: local.x, y: local.y, z: local.z };
				}
				if (drag.scaleAxis === 'uniform') {
					t.node.transform.scale.x = round3(t.startScale.x * f);
					t.node.transform.scale.y = round3(t.startScale.y * f);
					t.node.transform.scale.z = round3(t.startScale.z * f);
					t.node.transform.position.x = round3(groupPos.x);
					t.node.transform.position.y = round3(groupPos.y);
					t.node.transform.position.z = round3(groupPos.z);
				} else {
					const axis = drag.scaleAxis as Axis;
					t.node.transform.scale[axis] = round3(t.startScale[axis] * f);
					const minLocal = t.localBox?.min[axis];
					if (anchorFarEdge && minLocal !== undefined && isFinite(minLocal)) {
						// The handle always sits on the axis's positive side, so the
						// far edge that stays put is the local minimum. Shifting the
						// origin by how much *it* would otherwise have moved (in real,
						// scale-inclusive units — localBox is unscaled geometry space)
						// keeps it fixed in world space while the handle-side edge does
						// the scaling.
						const shift = new THREE.Vector3();
						shift[axis] = minLocal * t.startScale[axis] * (1 - f);
						if (t.startLocalQ) shift.applyQuaternion(t.startLocalQ);
						t.node.transform.position.x = round3(groupPos.x + shift.x);
						t.node.transform.position.y = round3(groupPos.y + shift.y);
						t.node.transform.position.z = round3(groupPos.z + shift.z);
					} else {
						t.node.transform.position.x = round3(groupPos.x);
						t.node.transform.position.y = round3(groupPos.y);
						t.node.transform.position.z = round3(groupPos.z);
					}
				}
			});
		}
		this.requestSync();
	};

	#onGizmoUp = () => {
		window.removeEventListener('pointermove', this.#onGizmoMove);
		window.removeEventListener('pointerup', this.#onGizmoUp);
		if (!this.#gizmoDrag) return;
		this.#gizmoDrag = null;
		this.requestSync();
		setTimeout(() => {
			this.gizmoWasDragging = false;
		}, 0);
	};
}
