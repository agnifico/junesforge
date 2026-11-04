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
import { GEO_DEFS, defaultGroundY, absorbScale, ABSORB_REASON } from './geometry';
import { defaultMaterial, buildThreeMaterial, updateMaterialInPlace } from './materials';
import { randomPaletteColor } from './palette';
import { defaultTransform, round3, D2R, R2D } from './utils';
import { SimpleOrbitControls } from './orbit-controls';
import { isGroup, isPrimitive, isImported, isAuthoredMesh } from './types';
import type { SceneNode, PrimitiveNode, GroupNode, ImportedNode, MeshNode, PrimitiveType, Asset, AssetSource, Vec3 } from './types';
import { importModel, normalizeImport, setImportRenderer, type ImportPart } from '../import/loaders';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { dataUrlToFile } from '../import/local-import';
import { dataUrlToPayload, geometryToPayload, payloadToDataUrl, payloadToGeometry, triangleCount } from './mesh-geom';
import {
	type BMesh,
	bmeshFromGeometry,
	bmeshToGeometry,
	cloneBMesh,
	extrudeFaces,
	insetFaces,
	loopCut,
	bevelEdges,
	mergeVerts,
	deleteFaces,
	deleteVerts,
	deleteEdges,
	applyDelta,
	averageNormal,
	edgeKey,
	edgesOf
} from './bmesh';
import {
	buildOverlay,
	syncOverlay,
	pickVertex,
	pickEdge,
	pickFace,
	selectedVertSet,
	parseEdge,
	selectionCentroid,
	grabWeights,
	worldToScreen
} from './model-overlay';
import type { EditSelectMode } from './editor.svelte';

type Axis = 'x' | 'y' | 'z';

/**
 * A detached deep copy of something that may be reactive state.
 *
 * structuredClone can't take a $state proxy — it throws "Proxy object could
 * not be cloned" — so anything read back out of the document (or out of a
 * $state field like the material clipboard) has to be snapshotted first.
 * Every material copy in here goes through this.
 */
/** Close enough to 1 that treating it as unscaled is honest. Scale values
 *  arrive from gizmo drags and matrix decomposition, so exact equality never
 *  holds even when nothing has actually changed. */
function near1(v: number) {
	return Math.abs(v - 1) < 1e-4;
}

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
	/** This object's own world-space bounding-box centre at grab time — the
	 *  pivot "Each" turns and scales it around. */
	ownCentre?: THREE.Vector3;
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
	/**
	 * The single selected object's dimensions, republished on every sync so the
	 * Inspector's Dimensions field and the viewport plate both read live during
	 * a gizmo drag. Null for an empty or multiple selection.
	 */
	selectionDims = $state<{ x: number; y: number; z: number } | null>(null);
	modelSelCount = $state(0);
	modelVertCount = $state(0);
	modelFaceCount = $state(0);

	#holder: HTMLElement | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#raf = 0;
	#syncScheduled = false;
	#disposed = false;

	#pmrem: THREE.PMREMGenerator | null = null;
	#envTexture: THREE.Texture | null = null;

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
		// Imported glTF/FBX materials are physically-based: a metallic surface
		// reflects its surroundings and emits nothing of its own, so with no
		// environment to reflect it renders black no matter how many lights are
		// in the scene. That is the single biggest reason imported models "lose
		// their colours". A neutral room IBL costs one render at mount and makes
		// PBR imports look the way they do in every other viewer.
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;
		holder.appendChild(this.renderer.domElement);
		setImportRenderer(this.renderer);

		this.sceneRoot = new THREE.Group();
		this.sceneRoot.name = 'PropsizeRoot';
		this.scene.add(this.sceneRoot);

		this.helpersGroup = new THREE.Group();
		this.scene.add(this.helpersGroup);

		this.#pmrem = new THREE.PMREMGenerator(this.renderer);
		this.#envTexture = this.#pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		// `environment` only — not `background`, which stays the flat studio
		// colour the user picked.
		this.scene.environment = this.#envTexture;

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
		window.removeEventListener('pointermove', this.#onMarqueeMove);
		window.removeEventListener('pointerup', this.#onMarqueeUp);
		this.threeObjects.forEach(disposeObject3D);
		this.threeObjects.clear();
		this.#disposeEditOverlay();
		setImportRenderer(null);
		this.#envTexture?.dispose();
		this.#pmrem?.dispose();
		this.#envTexture = null;
		this.#pmrem = null;
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
		this.#syncEditSession();
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
		this.#applyIsolationLook();
		this.#syncEditSession();
	}

	/** Loaded + normalized model templates, keyed by assetId. Cloned per node
	 *  instance rather than reused directly, so N placements of one asset are
	 *  independent objects in the scene graph. */
	#assetCache = new Map<string, THREE.Object3D>();
	#pendingAssetLoads = new Set<string>();
	#meshGeoCache = new Map<string, THREE.BufferGeometry>();
	#meshGen = new Map<string, number>();
	#edit: {
		bmesh: BMesh;
		triToFace: number[];
		assetId: string;
		sig: string;
		overlay: THREE.Group;
		verts: Set<number>;
		edges: Set<string>;
		faces: Set<number>;
		grab: {
			startVerts: [number, number, number][];
			weights: number[];
			plane: THREE.Plane;
			p0: THREE.Vector3;
			axis: THREE.Vector3 | null;
			nodeId: string;
		} | null;
		pick: { x: number; y: number; additive: boolean; hit: { kind: EditSelectMode; id: string | number } | null } | null;
	} | null = null;
	#editConsumedClick = false;

	#geometryForMeshAsset(assetId: string): THREE.BufferGeometry | null {
		const cached = this.#meshGeoCache.get(assetId);
		if (cached) return cached;
		const asset = docStore.doc.assets[assetId];
		if (!asset || asset.kind !== 'mesh' || asset.source.type !== 'embedded') return null;
		const payload = dataUrlToPayload(asset.source.dataUrl);
		if (!payload) return null;
		const geo = payloadToGeometry(payload);
		this.#meshGeoCache.set(assetId, geo);
		if (!this.#meshGen.has(assetId)) this.#meshGen.set(assetId, 1);
		return geo;
	}

	#createObject(node: SceneNode): THREE.Object3D {
		if (isGroup(node)) {
			const g = new THREE.Group();
			g.userData.nodeId = node.id;
			g.userData.nodeKind = node.kind;
			return g;
		}
		if (isPrimitive(node)) {
			const geo = GEO_DEFS[node.type].build(node.geometry);
			const material = docStore.doc.materials[node.materialId] ?? defaultMaterial();
			const mat = buildThreeMaterial(material, editorStore.wireAll, this.#resolveTextureUrl);
			const mesh = new THREE.Mesh(geo, mat);
			mesh.userData.nodeId = node.id;
			mesh.userData.nodeKind = node.kind;
			mesh.userData.geoSig = JSON.stringify(node.geometry);
			mesh.castShadow = node.castShadow;
			mesh.receiveShadow = node.receiveShadow;
			return mesh;
		}
		if (isAuthoredMesh(node)) {
			const src = this.#geometryForMeshAsset(node.assetId);
			const geo = src ? src.clone() : new THREE.BoxGeometry(0.6, 0.6, 0.6);
			const material = docStore.doc.materials[node.materialId] ?? defaultMaterial();
			const mat = buildThreeMaterial(material, editorStore.wireAll, this.#resolveTextureUrl);
			const mesh = new THREE.Mesh(geo, mat);
			mesh.userData.nodeId = node.id;
			mesh.userData.nodeKind = node.kind;
			mesh.userData.meshAssetId = node.assetId;
			mesh.userData.meshGen = this.#meshGen.get(node.assetId) ?? 0;
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
		obj.userData.nodeKind = node.kind;
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
		const mat = buildThreeMaterial(spec, editorStore.wireAll, this.#resolveTextureUrl);
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
	#resolveTextureUrl = (assetId: string): string | null => {
		const asset = docStore.doc.assets[assetId];
		if (!asset || asset.kind !== 'texture') return null;
		if (asset.source.type === 'embedded') return asset.source.dataUrl;
		if (asset.source.type === 'remote') return asset.source.url;
		return null;
	};

	#tryAutoResolveEmbeddedAsset(assetId: string) {
		if (this.#pendingAssetLoads.has(assetId) || this.#assetCache.has(assetId)) return;
		const asset = docStore.doc.assets[assetId];
		if (!asset || asset.kind !== 'model' || asset.source.type !== 'embedded') return;
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
		if (obj.userData.nodeKind && obj.userData.nodeKind !== node.kind) {
			detachObject3D(obj);
			this.threeObjects.delete(node.id);
			this.requestSync();
			return;
		}
		if (isPrimitive(node)) {
			const mesh = obj as THREE.Mesh;
			const sig = JSON.stringify(node.geometry);
			if (mesh.userData.geoSig !== sig) {
				mesh.geometry.dispose();
				mesh.geometry = GEO_DEFS[node.type].build(node.geometry);
				mesh.userData.geoSig = sig;
			}
			const material = docStore.doc.materials[node.materialId] ?? defaultMaterial();
			updateMaterialInPlace(mesh.material as THREE.MeshStandardMaterial, material, editorStore.wireAll, this.#resolveTextureUrl);
			mesh.castShadow = node.castShadow;
			mesh.receiveShadow = node.receiveShadow;
			return;
		}
		if (isAuthoredMesh(node)) {
			const mesh = obj as THREE.Mesh;
			const gen = this.#meshGen.get(node.assetId) ?? 0;
			if (mesh.userData.meshAssetId !== node.assetId || mesh.userData.meshGen !== gen) {
				const src = this.#geometryForMeshAsset(node.assetId);
				if (mesh.geometry) mesh.geometry.dispose();
				mesh.geometry = src ? src.clone() : new THREE.BoxGeometry(0.6, 0.6, 0.6);
				mesh.userData.meshAssetId = node.assetId;
				mesh.userData.meshGen = gen;
			}
			const material = docStore.doc.materials[node.materialId] ?? defaultMaterial();
			updateMaterialInPlace(
				mesh.material as THREE.MeshStandardMaterial,
				material,
				editorStore.wireAll,
				this.#resolveTextureUrl
			);
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
				if (spec && mat) updateMaterialInPlace(mat, spec, editorStore.wireAll, this.#resolveTextureUrl);
			}
			this.#applyShadowFlags(obj, node.castShadow, node.receiveShadow);
		}
	}

	// ---- selection --------------------------------------------------------
	setSelection(ids: string[]) {
		if (editorStore.isolatedId) {
			ids = [editorStore.isolatedId];
		}
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
		if (editorStore.isolatedId && !docStore.node(editorStore.isolatedId)) this.exitIsolation(false);
		this.requestSync();
	}
	redo() {
		docStore.redo();
		if (editorStore.isolatedId && !docStore.node(editorStore.isolatedId)) this.exitIsolation(false);
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
		this.exitIsolation(false);
		this.requestSync();
	}

	#clearIsolationDim(mesh: THREE.Mesh) {
		const clone = mesh.userData.dimClone as THREE.Material | undefined;
		const orig = mesh.userData.dimOrig as THREE.Material | THREE.Material[] | undefined;
		if (!clone) return;
		clone.dispose();
		if (orig) mesh.material = orig;
		mesh.userData.dimClone = null;
		mesh.userData.dimOrig = null;
	}

	#applyIsolationLook() {
		const iso = editorStore.isolatedId;
		if (iso && !docStore.node(iso)) {
			editorStore.isolatedId = null;
		}
		const isolated = editorStore.isolatedId;
		for (const [id, obj] of this.threeObjects) {
			const dim = !!isolated && id !== isolated;
			obj.traverse((o) => {
				const mesh = o as THREE.Mesh;
				if (!mesh.isMesh) return;
				this.#clearIsolationDim(mesh);
				if (!dim) return;
				const orig = mesh.material;
				const src = Array.isArray(orig) ? orig[0] : orig;
				if (!src) return;
				const clone = src.clone();
				clone.transparent = true;
				clone.opacity = 0.14;
				clone.depthWrite = false;
				mesh.userData.dimOrig = orig;
				mesh.userData.dimClone = clone;
				mesh.material = clone;
			});
		}
	}

	exitIsolation(toast = true) {
		if (!editorStore.isolatedId) return;
		editorStore.isolatedId = null;
		editorStore.isolationTool = 'model';
		editorStore.editSelectMode = 'vertex';
		this.#disposeEditOverlay();
		this.requestSync();
		if (toast) editorStore.toast('Back to the scene');
	}

	async isolateSelection() {
		if (editorStore.isolatedId) {
			this.exitIsolation();
			return;
		}
		const roots = docStore.selectionRoots();
		if (roots.length !== 1) {
			editorStore.toast('Select one object to isolate');
			return;
		}
		let node = roots[0];
		if (isGroup(node)) {
			editorStore.toast('Isolation is one object at a time — pick a child, not the group');
			return;
		}
		if (isPrimitive(node)) {
			if (docStore.isLocked(node.id)) {
				editorStore.toast('Unlock this object before converting it to a mesh');
				return;
			}
			const label = GEO_DEFS[node.type].label;
			const choice = await editorStore.prompt({
				title: 'Convert to mesh?',
				body: `"${node.name}" will stop being a parametric ${label}. The size sliders go away. You can undo. Isolation needs a mesh to model and paint.`,
				choices: [
					{ label: 'Cancel', value: 'cancel' },
					{ label: 'Convert and isolate', value: 'ok', primary: true }
				]
			});
			if (choice !== 'ok') return;
			const converted = this.convertPrimitiveToMesh(node);
			if (!converted) return;
			node = converted;
		}
		editorStore.isolatedId = node.id;
		editorStore.isolationTool = 'model';
		this.setSelection([node.id]);
		this.focusOnSelection();
		this.requestSync();
		editorStore.toast(`Isolating ${node.name} — 1/2/3 vertex edge face · Esc back`);
	}

	convertPrimitiveToMesh(node: PrimitiveNode): MeshNode | null {
		const live = this.threeObjects.get(node.id) as THREE.Mesh | undefined;
		const raw = live?.isMesh ? live.geometry : GEO_DEFS[node.type].build(node.geometry);
		const baked = bmeshToGeometry(bmeshFromGeometry(raw));
		const payload = geometryToPayload(baked.geometry);
		const assetId = docStore.newId('mesh');
		const asset: Asset = {
			id: assetId,
			name: `${node.name} mesh`,
			kind: 'mesh',
			format: 'meshjson',
			source: { type: 'embedded', dataUrl: payloadToDataUrl(payload) }
		};
		const verts = baked.geometry.getAttribute('position').count;
		const meshNode: MeshNode = {
			id: node.id,
			name: node.name,
			parentId: node.parentId,
			visible: node.visible,
			locked: node.locked,
			dataLink: node.dataLink,
			transform: { ...node.transform, position: { ...node.transform.position }, rotation: { ...node.transform.rotation }, scale: { ...node.transform.scale } },
			kind: 'mesh',
			assetId,
			materialId: node.materialId,
			castShadow: node.castShadow,
			receiveShadow: node.receiveShadow,
			stats: { vertices: verts, triangles: triangleCount(payload) }
		};
		docStore.mark(null);
		docStore.doc.assets[assetId] = asset;
		this.#meshGeoCache.set(assetId, baked.geometry);
		this.#meshGen.set(assetId, 1);
		const i = docStore.doc.nodes.findIndex((n) => n.id === node.id);
		if (i < 0) return null;
		docStore.doc.nodes[i] = meshNode;
		const obj = this.threeObjects.get(node.id);
		if (obj) {
			detachObject3D(obj);
			this.threeObjects.delete(node.id);
		}
		if (meshNode.dataLink) {
			const stats = meshNode.stats;
			for (const n of [...docStore.doc.nodes]) {
				if (n.id === meshNode.id || n.dataLink !== meshNode.dataLink || !isPrimitive(n)) continue;
				const sibling: MeshNode = {
					id: n.id,
					name: n.name,
					parentId: n.parentId,
					visible: n.visible,
					locked: n.locked,
					dataLink: n.dataLink,
					transform: {
						...n.transform,
						position: { ...n.transform.position },
						rotation: { ...n.transform.rotation },
						scale: { ...n.transform.scale }
					},
					kind: 'mesh',
					assetId,
					materialId: n.materialId,
					castShadow: n.castShadow,
					receiveShadow: n.receiveShadow,
					stats: { ...stats }
				};
				const si = docStore.doc.nodes.findIndex((x) => x.id === n.id);
				if (si >= 0) docStore.doc.nodes[si] = sibling;
				const so = this.threeObjects.get(n.id);
				if (so) {
					detachObject3D(so);
					this.threeObjects.delete(n.id);
				}
			}
		}
		this.syncScene();
		return meshNode;
	}

	#modelling(): boolean {
		return (
			!!editorStore.isolatedId &&
			editorStore.isolationTool === 'model' &&
			!!this.#edit
		);
	}

	#disposeEditOverlay() {
		if (!this.#edit) return;
		this.#edit.overlay.parent?.remove(this.#edit.overlay);
		this.#edit.overlay.traverse((o) => {
			const m = o as THREE.Mesh;
			if (m.geometry) m.geometry.dispose();
			const mat = (m as THREE.Mesh).material;
			if (mat && !Array.isArray(mat) && 'dispose' in mat) (mat as THREE.Material).dispose();
		});
		this.#edit = null;
		this.modelSelCount = 0;
		this.modelVertCount = 0;
		this.modelFaceCount = 0;
	}

	#assetSig(assetId: string): string {
		const asset = docStore.doc.assets[assetId];
		if (!asset || asset.source.type !== 'embedded') return assetId;
		const d = asset.source.dataUrl;
		return assetId + ':' + d.length + ':' + d.slice(d.length - 24);
	}

	#syncEditSession() {
		const iso = editorStore.isolatedId;
		const node = iso ? docStore.node(iso) : null;
		if (!iso || !node || !isAuthoredMesh(node) || editorStore.isolationTool !== 'model') {
			if (this.#edit) this.#edit.overlay.visible = false;
			if (!iso || !node || !isAuthoredMesh(node)) this.#disposeEditOverlay();
			return;
		}
		const sig = this.#assetSig(node.assetId);
		const obj = this.threeObjects.get(node.id);
		if (!this.#edit || this.#edit.assetId !== node.assetId || this.#edit.sig !== sig) {
			const src = this.#geometryForMeshAsset(node.assetId);
			if (!src) return;
			const overlay = this.#edit?.overlay ?? buildOverlay({ verts: [], faces: [] });
			if (this.#edit && this.#edit.assetId !== node.assetId) {
				this.#edit.overlay.parent?.remove(this.#edit.overlay);
			}
			const bm = bmeshFromGeometry(src);
			const baked = bmeshToGeometry(bm);
			this.#edit = {
				bmesh: bm,
				triToFace: baked.triToFace,
				assetId: node.assetId,
				sig,
				overlay,
				verts: new Set(),
				edges: new Set(),
				faces: new Set(),
				grab: null,
				pick: null
			};
			const live = obj as THREE.Mesh | undefined;
			if (live?.isMesh) {
				live.geometry.dispose();
				live.geometry = baked.geometry.clone();
			} else {
				baked.geometry.dispose();
			}
		}
		if (obj && this.#edit.overlay.parent !== obj) obj.add(this.#edit.overlay);
		this.#edit.overlay.visible = true;
		this.#paintEditOverlay();
	}

	#paintEditOverlay() {
		if (!this.#edit) return;
		syncOverlay(
			this.#edit.overlay,
			this.#edit.bmesh,
			editorStore.editSelectMode,
			this.#edit.verts,
			this.#edit.edges,
			this.#edit.faces
		);
		this.modelSelCount =
			editorStore.editSelectMode === 'vertex'
				? this.#edit.verts.size
				: editorStore.editSelectMode === 'edge'
					? this.#edit.edges.size
					: this.#edit.faces.size;
		this.modelVertCount = this.#edit.bmesh.verts.length;
		this.modelFaceCount = this.#edit.bmesh.faces.length;
	}

	#coreVerts(): Set<number> {
		if (!this.#edit) return new Set();
		return selectedVertSet(
			this.#edit.bmesh,
			editorStore.editSelectMode,
			this.#edit.verts,
			this.#edit.edges,
			this.#edit.faces
		);
	}

	hasModelSelection() {
		return this.modelSelCount > 0;
	}

	clearModelSelection() {
		if (!this.#edit) return;
		this.#edit.verts.clear();
		this.#edit.edges.clear();
		this.#edit.faces.clear();
		this.#paintEditOverlay();
	}

	setEditSelectMode(mode: EditSelectMode) {
		editorStore.editSelectMode = mode;
		this.#paintEditOverlay();
	}

	selectAllModel() {
		if (!this.#edit) return;
		this.#edit.verts = new Set(this.#edit.bmesh.verts.map((_, i) => i));
		this.#edit.edges = new Set();
		for (const [a, b] of edgesOf(this.#edit.bmesh)) this.#edit.edges.add(edgeKey(a, b));
		this.#edit.faces = new Set(this.#edit.bmesh.faces.map((_, i) => i));
		if (editorStore.editSelectMode === 'vertex') {
			this.#edit.edges.clear();
			this.#edit.faces.clear();
		} else if (editorStore.editSelectMode === 'edge') {
			this.#edit.verts.clear();
			this.#edit.faces.clear();
		} else {
			this.#edit.verts.clear();
			this.#edit.edges.clear();
		}
		this.#paintEditOverlay();
	}

	#commitMesh(opts?: { coalesce?: string }) {
		if (!this.#edit) return;
		const node = editorStore.isolatedId ? docStore.node(editorStore.isolatedId) : null;
		if (!node || !isAuthoredMesh(node)) return;
		if (opts?.coalesce) docStore.mark(opts.coalesce);
		else docStore.mark(null);
		const baked = bmeshToGeometry(this.#edit.bmesh);
		const payload = geometryToPayload(baked.geometry);
		const asset = docStore.doc.assets[node.assetId];
		if (asset && asset.source.type === 'embedded') {
			// Replace the source object rather than mutating its dataUrl in
			// place: undo entries hold these by reference (see
			// DocumentStore.#snapshot), so an in-place edit would silently
			// rewrite the mesh bytes inside every earlier history step too,
			// making undo of a model edit a no-op.
			asset.source = { type: 'embedded', dataUrl: payloadToDataUrl(payload) };
		}
		const old = this.#meshGeoCache.get(node.assetId);
		if (old && old !== baked.geometry) old.dispose();
		this.#meshGeoCache.set(node.assetId, baked.geometry);
		this.#meshGen.set(node.assetId, (this.#meshGen.get(node.assetId) ?? 0) + 1);
		this.#edit.triToFace = baked.triToFace;
		this.#edit.sig = this.#assetSig(node.assetId);
		node.stats = { vertices: this.#edit.bmesh.verts.length, triangles: triangleCount(payload) };
		this.syncLinked(node);
		const live = this.threeObjects.get(node.id) as THREE.Mesh | undefined;
		if (live?.isMesh) {
			live.geometry.dispose();
			live.geometry = baked.geometry.clone();
			live.userData.meshGen = this.#meshGen.get(node.assetId);
		}
		this.#paintEditOverlay();
		this.requestSync();
	}

	#applyLivePositions() {
		if (!this.#edit) return;
		const node = editorStore.isolatedId ? docStore.node(editorStore.isolatedId) : null;
		if (!node) return;
		const live = this.threeObjects.get(node.id) as THREE.Mesh | undefined;
		const geo = live?.geometry;
		const pos = geo?.getAttribute('position');
		if (!geo || !pos || pos.count !== this.#edit.bmesh.verts.length) {
			this.#commitMesh({ coalesce: 'model-grab' });
			return;
		}
		for (let i = 0; i < this.#edit.bmesh.verts.length; i++) {
			const v = this.#edit.bmesh.verts[i];
			pos.setXYZ(i, v[0], v[1], v[2]);
		}
		pos.needsUpdate = true;
		geo.computeVertexNormals();
		this.#paintEditOverlay();
	}

	#editPointerDown(e: PointerEvent): boolean {
		if (!this.#edit) this.#syncEditSession();
		if (!this.#edit || this.#edit.grab) return false;
		const hit = this.#pickAt(e);
		if (!hit) return false;
		this.#editConsumedClick = true;
		this.#edit.pick = {
			x: e.clientX,
			y: e.clientY,
			additive: e.shiftKey || e.ctrlKey || e.metaKey,
			hit
		};
		window.addEventListener('pointermove', this.#onEditPickMove);
		window.addEventListener('pointerup', this.#onEditPickUp);
		return true;
	}

	#onEditPickMove = (e: PointerEvent) => {
		const p = this.#edit?.pick;
		if (!p || !this.#edit) return;
		if (p.additive) return;
		if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
		window.removeEventListener('pointermove', this.#onEditPickMove);
		window.removeEventListener('pointerup', this.#onEditPickUp);
		if (p.hit && !this.#hitSelected(p.hit)) this.#applyPick(p.hit, false);
		this.#edit.pick = null;
		this.#beginGrab(e, false);
	};

	#onEditPickUp = () => {
		window.removeEventListener('pointermove', this.#onEditPickMove);
		window.removeEventListener('pointerup', this.#onEditPickUp);
		const p = this.#edit?.pick;
		if (!this.#edit) return;
		this.#edit.pick = null;
		if (p?.hit) this.#applyPick(p.hit, p.additive);
	};

	#pickAt(e: PointerEvent) {
		if (!this.#edit) return null;
		const node = editorStore.isolatedId ? docStore.node(editorStore.isolatedId) : null;
		if (!node) return null;
		const obj = this.threeObjects.get(node.id);
		if (!obj) return null;
		const rect = this.renderer.domElement.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		const mode = editorStore.editSelectMode;
		if (mode === 'vertex') {
			const id = pickVertex(this.#edit.bmesh, obj, this.camera, sx, sy, rect.width, rect.height);
			return id === null ? null : { kind: mode, id };
		}
		if (mode === 'edge') {
			const id = pickEdge(this.#edit.bmesh, obj, this.camera, sx, sy, rect.width, rect.height);
			return id === null ? null : { kind: mode, id };
		}
		this.raycaster.setFromCamera(this.#pointerNDC(e), this.camera);
		const id = pickFace(this.raycaster, obj, this.#edit.triToFace);
		return id === null ? null : { kind: mode, id };
	}

	#applyPick(hit: { kind: EditSelectMode; id: string | number }, additive: boolean) {
		if (!this.#edit) return;
		if (!additive) {
			this.#edit.verts.clear();
			this.#edit.edges.clear();
			this.#edit.faces.clear();
		}
		if (hit.kind === 'vertex') {
			const i = hit.id as number;
			if (this.#edit.verts.has(i) && additive) this.#edit.verts.delete(i);
			else this.#edit.verts.add(i);
		} else if (hit.kind === 'edge') {
			const k = hit.id as string;
			if (this.#edit.edges.has(k) && additive) this.#edit.edges.delete(k);
			else this.#edit.edges.add(k);
		} else {
			const i = hit.id as number;
			if (this.#edit.faces.has(i) && additive) this.#edit.faces.delete(i);
			else this.#edit.faces.add(i);
		}
		this.#paintEditOverlay();
	}

	#hitSelected(hit: { kind: EditSelectMode; id: string | number }) {
		if (!this.#edit) return false;
		if (hit.kind === 'vertex') return this.#edit.verts.has(hit.id as number);
		if (hit.kind === 'edge') return this.#edit.edges.has(hit.id as string);
		return this.#edit.faces.has(hit.id as number);
	}

	#beginGrab(e: PointerEvent, alongNormal: boolean) {
		if (!this.#edit) return false;
		const core = this.#coreVerts();
		if (!core.size) return false;
		const node = editorStore.isolatedId ? docStore.node(editorStore.isolatedId) : null;
		if (!node) return false;
		const obj = this.threeObjects.get(node.id);
		if (!obj) return false;
		obj.updateWorldMatrix(true, false);
		const local = selectionCentroid(this.#edit.bmesh, core);
		const origin = local.clone().applyMatrix4(obj.matrixWorld);
		let axis: THREE.Vector3 | null = null;
		if (alongNormal && editorStore.editSelectMode === 'face' && this.#edit.faces.size) {
			axis = averageNormal(this.#edit.bmesh, [...this.#edit.faces]).transformDirection(
				obj.matrixWorld
			);
			axis.normalize();
		}
		const plane = axis
			? new THREE.Plane().setFromNormalAndCoplanarPoint(
					new THREE.Vector3().crossVectors(axis, this.camera.getWorldDirection(new THREE.Vector3())).cross(axis).normalize(),
					origin
				)
			: this.#cameraFacingPlane(origin);
		this.raycaster.setFromCamera(this.#pointerNDC(e), this.camera);
		const p0 = new THREE.Vector3();
		if (!this.raycaster.ray.intersectPlane(plane, p0)) return false;
		docStore.mark('model-grab');
		this.#edit.grab = {
			startVerts: this.#edit.bmesh.verts.map((v) => [v[0], v[1], v[2]] as [number, number, number]),
			weights: grabWeights(
				this.#edit.bmesh,
				core,
				editorStore.modelProportional,
				editorStore.modelPropRadius
			),
			plane,
			p0,
			axis,
			nodeId: node.id
		};
		this.gizmoWasDragging = true;
		window.addEventListener('pointermove', this.#onEditGrabMove);
		window.addEventListener('pointerup', this.#onEditGrabUp);
		return true;
	}

	#onEditGrabMove = (e: PointerEvent) => {
		const grab = this.#edit?.grab;
		if (!grab || !this.#edit) return;
		const obj = this.threeObjects.get(grab.nodeId);
		if (!obj) return;
		this.raycaster.setFromCamera(this.#pointerNDC(e), this.camera);
		const p = new THREE.Vector3();
		if (!this.raycaster.ray.intersectPlane(grab.plane, p)) return;
		let worldDelta = p.clone().sub(grab.p0);
		if (grab.axis) worldDelta = grab.axis.clone().multiplyScalar(worldDelta.dot(grab.axis));
		obj.updateWorldMatrix(true, false);
		const o = obj.worldToLocal(grab.p0.clone());
		const n = obj.worldToLocal(grab.p0.clone().add(worldDelta));
		let dx = n.x - o.x;
		let dy = n.y - o.y;
		let dz = n.z - o.z;
		if (editorStore.snapEnabled) {
			dx = editorStore.snapVal(dx);
			dy = editorStore.snapVal(dy);
			dz = editorStore.snapVal(dz);
		}
		for (let i = 0; i < this.#edit.bmesh.verts.length; i++) {
			const w = grab.weights[i];
			const s = grab.startVerts[i];
			this.#edit.bmesh.verts[i] = [s[0] + dx * w, s[1] + dy * w, s[2] + dz * w];
		}
		this.#applyLivePositions();
	};

	#onEditGrabUp = () => {
		window.removeEventListener('pointermove', this.#onEditGrabMove);
		window.removeEventListener('pointerup', this.#onEditGrabUp);
		if (this.#edit) this.#edit.grab = null;
		this.#commitMesh({ coalesce: 'model-grab' });
	};

	startModelGrab() {
		if (!this.#modelling() || !this.#coreVerts().size) {
			editorStore.toast('Select something to move');
			return;
		}
		const rect = this.renderer.domElement.getBoundingClientRect();
		const fake = {
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2
		} as PointerEvent;
		this.#beginGrab(fake, editorStore.editSelectMode === 'face');
		editorStore.toast('Move — drag, release to confirm');
	}

	modelExtrude() {
		if (!this.#ensureFaces('Extrude')) return;
		docStore.mark(null);
		const caps = extrudeFaces(this.#edit!.bmesh, [...this.#edit!.faces], 0);
		this.#edit!.faces = new Set(caps);
		this.#commitMesh();
		this.startModelGrab();
	}

	modelInset(amount = 0.2) {
		if (!this.#ensureFaces('Inset')) return;
		docStore.mark(null);
		insetFaces(this.#edit!.bmesh, [...this.#edit!.faces], amount);
		this.#commitMesh();
		editorStore.toast('Inset');
	}

	modelLoopCut() {
		if (!this.#edit) return;
		if (editorStore.editSelectMode !== 'edge' || this.#edit.edges.size !== 1) {
			editorStore.toast('Select one edge, then loop cut');
			return;
		}
		const [a, b] = parseEdge([...this.#edit.edges][0]);
		docStore.mark(null);
		if (!loopCut(this.#edit.bmesh, a, b, 0.5)) {
			editorStore.toast('Loop cut needs a ring of quads');
			return;
		}
		this.clearModelSelection();
		this.#commitMesh();
		editorStore.toast('Loop cut');
	}

	modelBevel(amount = 0.15) {
		if (!this.#edit) return;
		const edges =
			editorStore.editSelectMode === 'edge'
				? [...this.#edit.edges].map(parseEdge)
				: editorStore.editSelectMode === 'face'
					? [...this.#edit.faces].flatMap((fi) => {
							const f = this.#edit!.bmesh.faces[fi];
							const e: [number, number][] = [];
							for (let i = 0; i < f.length; i++) e.push([f[i], f[(i + 1) % f.length]]);
							return e;
						})
					: [];
		if (!edges.length) {
			editorStore.toast('Select edges (or faces) to bevel');
			return;
		}
		docStore.mark(null);
		bevelEdges(this.#edit.bmesh, edges, amount);
		this.clearModelSelection();
		this.#commitMesh();
		editorStore.toast('Bevel');
	}

	modelMerge() {
		if (!this.#edit) return;
		const verts = [...this.#coreVerts()];
		if (verts.length < 2) {
			editorStore.toast('Select at least two vertices to merge');
			return;
		}
		docStore.mark(null);
		if (!mergeVerts(this.#edit.bmesh, verts)) return;
		this.clearModelSelection();
		this.#commitMesh();
		editorStore.toast('Merged');
	}

	modelDelete() {
		if (!this.#edit || !this.hasModelSelection()) {
			editorStore.toast('Select something to delete');
			return;
		}
		const backup = cloneBMesh(this.#edit.bmesh);
		docStore.mark(null);
		let ok = false;
		if (editorStore.editSelectMode === 'face') ok = deleteFaces(this.#edit.bmesh, [...this.#edit.faces]);
		else if (editorStore.editSelectMode === 'edge')
			ok = deleteEdges(this.#edit.bmesh, [...this.#edit.edges].map(parseEdge));
		else ok = deleteVerts(this.#edit.bmesh, [...this.#edit.verts]);
		if (!ok) {
			this.#edit.bmesh = backup;
			editorStore.toast("Can't delete the last faces");
			return;
		}
		this.clearModelSelection();
		this.#commitMesh();
		editorStore.toast('Deleted');
	}

	#ensureFaces(op: string): boolean {
		if (!this.#edit) return false;
		if (editorStore.editSelectMode !== 'face' || !this.#edit.faces.size) {
			editorStore.toast(`${op} needs a face selection (3)`);
			return false;
		}
		return true;
	}

	/**
	 * Push everything a link group shares — shape *and* paint — from `source`
	 * onto its fellow members, and return how many were changed.
	 *
	 * Membership is symmetric, so this runs from whichever copy you happened
	 * to edit; there is no privileged original. Transform is pointedly not
	 * included: two instances that couldn't be moved apart would be pointless.
	 */
	propagateLinked(source: SceneNode): number {
		if (!source.dataLink) return 0;
		const link = source.dataLink;
		let touched = 0;
		for (const n of docStore.doc.nodes) {
			if (n.id === source.id || n.dataLink !== link) continue;
			if (isPrimitive(source) && isPrimitive(n)) {
				// Type can drift if a member was converted; re-point it so the
				// group can't silently split in half.
				n.type = source.type;
				n.geometry = copyOf(source.geometry);
				n.materialId = source.materialId;
			} else if (isAuthoredMesh(source) && isAuthoredMesh(n)) {
				n.assetId = source.assetId;
				n.stats = { ...source.stats };
				n.materialId = source.materialId;
			} else if (isImported(source) && isImported(n)) {
				n.assetId = source.assetId;
				n.materialOverride = source.materialOverride;
				n.part = source.part
					? { index: source.part.index, name: source.part.name, center: { ...source.part.center } }
					: null;
			} else {
				continue;
			}
			touched++;
		}
		return touched;
	}

	/**
	 * Say — at most once every few seconds, so a slider drag doesn't machine-gun
	 * the toast — that the edit just made reached the rest of the link group.
	 * The Inspector carries the standing explanation; this is the nudge for
	 * someone who is dragging a slider and hasn't looked at the panel.
	 */
	#lastLinkNoticeAt = 0;
	noticeLinkedEdit(count: number) {
		if (count <= 0) return;
		const now = Date.now();
		if (now - this.#lastLinkNoticeAt < 4000) return;
		this.#lastLinkNoticeAt = now;
		editorStore.toast(`Updated ${count + 1} linked copies — unlink one to edit it on its own`);
	}

	/** Convenience for UI edit handlers: propagate, then notify. */
	syncLinked(node: SceneNode) {
		this.noticeLinkedEdit(this.propagateLinked(node));
	}

	/**
	 * Break one object out of its link group. Deliberately a single explicit
	 * act covering both halves of the link — shape and paint — because a link
	 * that's half-broken is the confusing state, not a useful one.
	 */
	unlinkNode(node: SceneNode) {
		if (!node.dataLink) {
			editorStore.toast('This object is already independent');
			return;
		}
		docStore.mark(null);
		const others = docStore.unlink(node);
		this.requestSync();
		editorStore.toast(
			others > 0
				? `${node.name} is now independent — the other ${others} ${others === 1 ? 'copy is' : 'copies are'} unaffected`
				: `${node.name} is now independent`
		);
	}

	#refreshSelectionHighlight() {
		this.selectionHelpers.forEach((bh) => {
			this.helpersGroup.remove(bh);
			bh.geometry.dispose();
			(bh.material as THREE.Material).dispose();
		});
		this.selectionHelpers.clear();
		if (editorStore.isolatedId) return;
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
			// Listen on window, not the canvas: releasing the button outside the
			// viewport (very easy to do now that shift-drag box-selects) meant
			// this never fired and never unregistered, so handlers piled up and
			// all fired together on some later click.
			window.removeEventListener('pointerup', up);
			// Both the gizmo and the marquee release on window and register
			// before this handler does, so by the time we get here they've
			// already flagged that this pointerup closed a drag, not a click.
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
			let id = hits.length ? this.#nodeIdFor(hits[0].object) : null;
			if (editorStore.isolatedId) {
				if (id && id !== editorStore.isolatedId) id = null;
				if (id) this.setSelection([id]);
			if (moved <= 4 && this.#edit && !this.#editConsumedClick && !(ev.shiftKey || ev.ctrlKey || ev.metaKey)) {
					this.clearModelSelection();
				}
				this.#editConsumedClick = false;
				return;
			}
			if (id) {
				if (ev.shiftKey || ev.ctrlKey || ev.metaKey) this.toggleSelection(id);
				else this.setSelection([id]);
			} else if (!(ev.shiftKey || ev.ctrlKey || ev.metaKey)) {
				this.setSelection([]);
			}
		};
		window.addEventListener('pointerup', up);
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
		// Measured along the object's own axes for a single selection: the world
		// box grows when you rotate something, which makes it look like the
		// object changed size when it didn't. A multi-selection has no shared
		// set of axes, so there the world box genuinely is the extent.
		const own = single ? this.dimensionsOf(single) : null;
		this.selectionDims = own ? { x: own.x, y: own.y, z: own.z } : null;
		const rows: [string, string][] = [];
		if (single) {
			const typeLabel = isGroup(single)
				? 'group'
				: isPrimitive(single)
					? GEO_DEFS[single.type].label
					: isAuthoredMesh(single)
						? 'mesh'
						: 'model';
			rows.push(['type', typeLabel]);
			if (isGroup(single) || isImported(single)) rows.push(['meshes', String(meshes.length)]);
		} else {
			rows.push(['selected', `${docStore.selectedIds.length} objects`]);
			rows.push(['meshes', String(meshes.length)]);
		}
		rows.push(['tris', String(tris)]);
		const shown = own ?? size;
		rows.push(['size', `${shown.x.toFixed(2)} × ${shown.y.toFixed(2)} × ${shown.z.toFixed(2)}`]);
		if (single) {
			const p = single.transform.position;
			rows.push(['pos', `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`]);
		}
		this.specPlate = { title: single ? single.name : `${docStore.selectedIds.length} selected`, rows };
	}

	// ---- CRUD ---------------------------------------------------------------
	addPrimitive(type: PrimitiveType) {
		if (editorStore.isolatedId) {
			editorStore.toast('Exit isolation (Esc) to add shapes');
			return;
		}
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
			dataLink: null,
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
		if (editorStore.isolatedId) {
			editorStore.toast('Exit isolation (Esc) to add a group');
			return;
		}
		docStore.mark(null);
		const node: GroupNode = {
			id: docStore.newId(),
			parentId: null,
			name: 'Group',
			kind: 'group',
			visible: true,
			locked: false,
			dataLink: null,
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
		if (editorStore.isolatedId) {
			editorStore.toast('Exit isolation (Esc) to add a model');
			return;
		}
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
			dataLink: null,
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
		if (editorStore.isolatedId) {
			editorStore.toast('Exit isolation (Esc) to add a model');
			return;
		}
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
			dataLink: null,
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
			dataLink: null,
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
		const ids = docStore.selectedIds.filter((id) => !docStore.isLocked(id));
		if (!ids.length) {
			if (docStore.selectedIds.length) editorStore.toast('Selection is locked');
			return;
		}
		docStore.mark(null);
		docStore.remove(ids);
		this.requestSync();
	}

	selectGroupContents() {
		const next: string[] = [];
		for (const id of docStore.selectedIds) {
			const n = docStore.node(id);
			if (n && isGroup(n)) {
				for (const d of docStore.descendants(id)) next.push(d.id);
			} else {
				next.push(id);
			}
		}
		if (!next.length) {
			editorStore.toast('This group is empty');
			return;
		}
		this.setSelection(next);
	}

	materialUserCount(id: string): number {
		let n = 0;
		for (const node of docStore.doc.nodes) {
			if ((isPrimitive(node) || isAuthoredMesh(node)) && node.materialId === id) n++;
			else if (isImported(node) && node.materialOverride === id) n++;
		}
		return n;
	}

	#editableRoots() {
		return docStore.selectionRoots().filter((n) => !docStore.isLocked(n.id));
	}

	/** Bounding-box width of a live object, used to space duplicates apart. */
	widthOf(id: string): number {
		const o = this.threeObjects.get(id);
		if (!o) return 0.5;
		o.updateWorldMatrix(true, true);
		const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
		return isFinite(s.x) && s.x > 0.01 ? s.x : 0.5;
	}

	duplicateSelection(linked = false) {
		if (editorStore.isolatedId) {
			editorStore.toast('Exit isolation (Esc) to duplicate');
			return;
		}
		if (!docStore.selectedIds.length) return;
		docStore.mark(null);
		const snap = editorStore.snapEnabled ? editorStore.snapStep : 0;
		// Roots only. Duplicating a group *and* something inside it would clone
		// that child twice — once via its parent's subtree, once on its own —
		// which is easy to hit now that "select group contents" exists.
		const newIds = docStore
			.selectionRoots()
			.map((n) => docStore.duplicate(n.id, (nid) => this.widthOf(nid), snap, linked))
			.filter((id): id is string => !!id);
		this.syncScene();
		this.setSelection(newIds);
		const n = newIds.length;
		editorStore.toast(
			linked
				? `Linked ${n === 1 ? 'copy' : 'copies'} — shape and colour stay in sync; move each one freely`
				: `Copied ${n === 1 ? '1 object' : n + ' objects'} — fully independent`
		);
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
			dataLink: null,
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
		const worlds = new Map<string, THREE.Matrix4>();
		for (const n of moving) {
			const obj = this.threeObjects.get(n.id);
			if (!obj) continue;
			obj.updateWorldMatrix(true, false);
			worlds.set(n.id, obj.matrixWorld.clone());
		}

		for (const n of moving) {
			n.parentId = newParentId;
			docStore.moveInOrder(n.id, beforeId);
		}

		this.syncScene();
		let sheared = 0;
		for (const n of moving) {
			const world = worlds.get(n.id);
			if (!world) continue;
			const obj = this.threeObjects.get(n.id);
			const parent = obj?.parent ?? this.sceneRoot;
			const res = this.#localTransformIn(world, parent);
			n.transform = res.transform;
			if (res.sheared) sheared++;
		}

		this.requestSync();
		if (sheared) {
			editorStore.toast(
				`Moved \u2014 but ${sheared === 1 ? 'one object' : sheared + ' objects'} changed shape: a rotated object can't keep its exact form under a non-uniformly scaled parent`
			);
		} else {
			editorStore.toast(moving.length === 1 ? 'Moved in hierarchy' : `Moved ${moving.length} objects`);
		}
	}

	/**
	 * Express a world matrix in `parentObj`'s space as a position/rotation/scale
	 * triple.
	 *
	 * Reparenting is an organizational act, not a spatial one: dragging a row in
	 * the tree must not move the object on screen. That means the *whole* matrix
	 * has to make the trip. Capturing world position alone (what this used to do)
	 * left rotation and scale as raw local values, so a child dragged out of a
	 * rotated group kept its old local rotation while inheriting the new parent's
	 * on top of it, and visibly jumped by the difference between the two.
	 *
	 * Same maths as groupSelection(), which already got this right.
	 */
	#localTransformIn(world: THREE.Matrix4, parentObj: THREE.Object3D) {
		parentObj.updateWorldMatrix(true, false);
		const local = new THREE.Matrix4().copy(parentObj.matrixWorld).invert().multiply(world);
		const pos = new THREE.Vector3();
		const quat = new THREE.Quaternion();
		const scl = new THREE.Vector3();
		local.decompose(pos, quat, scl);
		const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
		// A position/rotation/scale triple cannot express shear, and shear is
		// exactly what a rotated object under a non-uniformly scaled parent
		// needs. decompose() approximates silently in that case, so recompose
		// and compare: if the round trip doesn't land back where it started,
		// the object really did change shape and the caller should say so.
		const rebuilt = new THREE.Matrix4().compose(pos, quat, scl);
		let sheared = false;
		for (let i = 0; i < 16; i++) {
			if (Math.abs(rebuilt.elements[i] - local.elements[i]) > 1e-3) {
				sheared = true;
				break;
			}
		}
		return {
			transform: {
				position: { x: round3(pos.x), y: round3(pos.y), z: round3(pos.z) },
				rotation: { x: round3(R2D(euler.x)), y: round3(R2D(euler.y)), z: round3(R2D(euler.z)) },
				scale: { x: round3(scl.x), y: round3(scl.y), z: round3(scl.z) }
			},
			sheared
		};
	}

	/** One reparent path, not two. This used to carry its own copy of the
	 *  world-transform maths, and its own copy of the bug in it. */
	reparentNode(id: string, newParentId: string | null) {
		this.moveNodes([id], newParentId);
	}

	// ---- dimensions -----------------------------------------------------------
	/**
	 * The node's bounding box in its *own* local space — its own transform
	 * removed, its children's kept. Multiplied by the node's scale this is what
	 * a person means by "how big is this thing", which is why it is the basis
	 * for the Dimensions field rather than the world box.
	 *
	 * The world box is the wrong number for that job: rotate a 1x1x1 box by 45
	 * degrees and its world box grows to 1.41 wide without the object changing
	 * size at all. Measuring along the object's own axes keeps the reading
	 * stable under rotation, which matches what Blender's N-panel shows.
	 */
	localSizeOf(node: SceneNode): THREE.Vector3 | null {
		const obj = this.threeObjects.get(node.id);
		if (!obj) return null;
		obj.updateWorldMatrix(true, true);
		const toLocal = new THREE.Matrix4().copy(obj.matrixWorld).invert();
		const box = new THREE.Box3();
		obj.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return;
			if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
			const b = mesh.geometry.boundingBox;
			if (!b) return;
			box.union(
				b.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld))
			);
		});
		if (box.isEmpty()) return null;
		return box.getSize(new THREE.Vector3());
	}

	/** What the Dimensions field shows: local size scaled by the node's own
	 *  scale. Null when the node has no drawable geometry (an empty group). */
	dimensionsOf(node: SceneNode): THREE.Vector3 | null {
		const local = this.localSizeOf(node);
		if (!local) return null;
		const t = node.transform.scale;
		return new THREE.Vector3(
			local.x * Math.abs(t.x),
			local.y * Math.abs(t.y),
			local.z * Math.abs(t.z)
		);
	}

	/**
	 * Drive one axis to an exact size by solving for scale. This is the whole
	 * point of the field: you know the number you want, so type it instead of
	 * working out the factor that produces it.
	 *
	 * Sign is preserved so a mirrored object stays mirrored, and a zero-extent
	 * axis (a plane has no thickness) is left alone rather than dividing by it.
	 */
	setDimension(node: SceneNode, axis: Axis, value: number) {
		const local = this.localSizeOf(node);
		if (!local || !Number.isFinite(value) || value <= 0) return;
		const base = local[axis];
		if (base <= 1e-6) {
			editorStore.toast(`${node.name} has no measurable size on ${axis.toUpperCase()}`);
			return;
		}
		docStore.mark(`dim:${node.id}:${axis}`);
		const sign = node.transform.scale[axis] < 0 ? -1 : 1;
		node.transform.scale[axis] = round3((value / base) * sign);
		this.syncLinked(node);
		this.requestSync();
	}

	/**
	 * Fold each selected primitive's scale into its own geometry parameters and
	 * reset the scale to 1. Blender's Apply Scale, except a parametric
	 * primitive can carry the result as a bigger number instead of baking it
	 * into mesh data, so the shape stays editable and the exported constructor
	 * arguments stay honest.
	 *
	 * Primitives that cannot express the scale they were given are left exactly
	 * as they are and named in the toast, rather than being quietly
	 * approximated into a slightly wrong shape.
	 */
	applyScaleToSelection() {
		const targets = docStore.selectionRoots();
		if (!targets.length) return;
		const skipped: string[] = [];
		let applied = 0;
		docStore.mark(null);
		for (const node of targets) {
			const s = node.transform.scale;
			if (near1(s.x) && near1(s.y) && near1(s.z)) continue;
			if (!isPrimitive(node)) {
				skipped.push(`${node.name} is ${isGroup(node) ? 'a group' : 'not parametric'}`);
				continue;
			}
			const geo = copyOf(node.geometry);
			const fail = absorbScale(node.type, geo, s);
			if (fail) {
				skipped.push(`${node.name} ${ABSORB_REASON[fail]}`);
				continue;
			}
			node.geometry = geo;
			node.transform.scale = { x: 1, y: 1, z: 1 };
			this.propagateLinked(node);
			applied++;
		}
		this.requestSync();
		if (!applied && !skipped.length) {
			editorStore.toast('Nothing to apply — scale is already 1');
		} else if (!skipped.length) {
			editorStore.toast(`Applied scale to ${applied} object${applied === 1 ? '' : 's'}`);
		} else {
			editorStore.toast(
				`${applied ? `Applied to ${applied}. ` : ''}Skipped: ${skipped.slice(0, 2).join('; ')}${skipped.length > 2 ? ` (+${skipped.length - 2} more)` : ''}`
			);
		}
	}

	/** Read a size off the object that already fits, so it can be put on the
	 *  one that has to fit beside it. */
	copyDimensionsFrom(node: SceneNode) {
		const d = this.dimensionsOf(node);
		if (!d) {
			editorStore.toast(`${node.name} has no measurable size`);
			return;
		}
		editorStore.dimensionClipboard = {
			x: round3(d.x),
			y: round3(d.y),
			z: round3(d.z),
			from: node.name
		};
		editorStore.toast(`Copied ${round3(d.x)} x ${round3(d.y)} x ${round3(d.z)} from ${node.name}`);
	}

	/** Paste only the axes that are ticked — matching a cylinder's radius
	 *  without also forcing its height is the common case, not the exception. */
	pasteDimensionsToSelection(axes: { x: boolean; y: boolean; z: boolean }) {
		const clip = editorStore.dimensionClipboard;
		if (!clip) return;
		if (!axes.x && !axes.y && !axes.z) {
			editorStore.toast('Pick at least one axis to paste');
			return;
		}
		const targets = docStore.selectionRoots();
		if (!targets.length) return;
		docStore.mark(null);
		let n = 0;
		for (const node of targets) {
			const local = this.localSizeOf(node);
			if (!local) continue;
			let touched = false;
			for (const a of ['x', 'y', 'z'] as Axis[]) {
				if (!axes[a] || local[a] <= 1e-6) continue;
				const sign = node.transform.scale[a] < 0 ? -1 : 1;
				node.transform.scale[a] = round3((clip[a] / local[a]) * sign);
				touched = true;
			}
			if (touched) {
				this.propagateLinked(node);
				n++;
			}
		}
		this.requestSync();
		editorStore.toast(n ? `Sized ${n} object${n === 1 ? '' : 's'} to match ${clip.from}` : 'Nothing resized');
	}

	/**
	 * Round each selected object's dimensions to the nearest snap step. The
	 * point is kit pieces that actually tile: a palisade section measured at
	 * 1.97 units leaves a seam every time it repeats, and no amount of careful
	 * placement fixes a length that isn't a whole number of steps.
	 */
	roundDimensionsToStep() {
		const step = editorStore.snapStep;
		if (!(step > 0)) return;
		const targets = docStore.selectionRoots();
		if (!targets.length) return;
		docStore.mark(null);
		let n = 0;
		for (const node of targets) {
			const local = this.localSizeOf(node);
			if (!local) continue;
			let touched = false;
			for (const a of ['x', 'y', 'z'] as Axis[]) {
				if (local[a] <= 1e-6) continue;
				const current = local[a] * Math.abs(node.transform.scale[a]);
				// Never round a real object down to nothing.
				const target = Math.max(step, Math.round(current / step) * step);
				if (near1(target / current)) continue;
				const sign = node.transform.scale[a] < 0 ? -1 : 1;
				node.transform.scale[a] = round3((target / local[a]) * sign);
				touched = true;
			}
			if (touched) {
				this.propagateLinked(node);
				n++;
			}
		}
		this.requestSync();
		editorStore.toast(
			n ? `Rounded ${n} object${n === 1 ? '' : 's'} to ${step}-unit steps` : `Already on ${step}-unit steps`
		);
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
		const movable = roots.filter((n) => !docStore.isLocked(n.id));
		if (!movable.length) {
			editorStore.toast('Selection is locked');
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
		items.forEach((x, i) => {
			if (!docStore.isLocked(x.n.id)) this.nudgeWorld(x.n, axis, target - vals[i]);
		});
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
		items.forEach((it, i) => {
			if (!docStore.isLocked(it.n.id)) this.nudgeWorld(it.n, axis, first + step * i - it.v);
		});
		this.requestSync();
		editorStore.toast('Distributed along ' + axis.toUpperCase());
	}

	/** "Ground" is whichever axis Settings nominates as down — Y for a normal
	 *  scene, but a wall layout may want X or Z instead. */
	dropToGround() {
		const roots = this.#editableRoots();
		if (!roots.length) {
			editorStore.toast(docStore.selectedIds.length ? 'Selection is locked' : 'Nothing selected');
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
		const roots = this.#editableRoots();
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
		const roots = this.#editableRoots();
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
		const roots = this.#editableRoots();
		if (!roots.length) {
			editorStore.toast(docStore.selectedIds.length ? 'Selection is locked' : 'Nothing selected');
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
		if (!isPrimitive(node) && !isAuthoredMesh(node)) return;
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
		const meshes = docStore.selectionMeshes(true).filter((n) => isPrimitive(n) || isAuthoredMesh(n)) as (PrimitiveNode | MeshNode)[];
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
	unlinkMaterial(node: PrimitiveNode | MeshNode) {
		const current = docStore.doc.materials[node.materialId];
		if (!current) return;
		docStore.mark(null);
		const id = docStore.newId('m');
		docStore.doc.materials[id] = copyOf(current);
		node.materialId = id;
		this.requestSync();
		editorStore.toast('Make unique — this object keeps its colour');
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
			if (isPrimitive(n) || isAuthoredMesh(n)) add(n.materialId, (id) => (n.materialId = id));
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
			const id =
				isPrimitive(n) || isAuthoredMesh(n) ? n.materialId : isImported(n) ? n.materialOverride : null;
			if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		let shared = 0;
		for (const c of counts.values()) if (c > 1) shared += c - 1;
		return shared;
	}

	// ---- keyboard nudge -------------------------------------------------------
	nudgeByKey(e: KeyboardEvent) {
		const roots = this.#editableRoots();
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
		if (editorStore.isolatedId || !docStore.selectedIds.length) {
			gizmoGroup.visible = false;
			return;
		}
		const roots = this.#editableRoots();
		if (!roots.length) {
			gizmoGroup.visible = false;
			return;
		}
		const pivot = this.#selectionPivot(roots);
		if (!isFinite(pivot.x)) {
			gizmoGroup.visible = false;
			return;
		}
		gizmoGroup.position.copy(pivot);
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
		gizmoGroup.scale.setScalar(Math.max(0.35, this.camera.position.distanceTo(pivot) * 0.15));
	}

	#selectionPivot(roots: SceneNode[]): THREE.Vector3 {
		const box = new THREE.Box3();
		let any = false;
		for (const nd of roots) {
			const o = this.threeObjects.get(nd.id);
			if (!o) continue;
			o.updateWorldMatrix(true, true);
			const b = new THREE.Box3().setFromObject(o);
			if (!isFinite(b.min.x)) continue;
			if (!any) {
				box.copy(b);
				any = true;
			} else box.union(b);
		}
		return any ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(NaN, NaN, NaN);
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
		if (editorStore.isolatedId && editorStore.isolationTool === 'model') {
			if (e.shiftKey) {
				this.#beginMarquee(e, true);
				return this.#editPointerDown(e);
			}
			return this.#editPointerDown(e);
		}
		if (editorStore.isolatedId) return false;
		if (this.#gizmoDrag) return false;
		const gizmoGroup = this.#gizmoGroup;
		if (gizmoGroup?.visible) {
			this.raycaster.setFromCamera(this.#pointerNDC(e), this.camera);
			const hits = this.raycaster.intersectObjects(this.#gizmoHandles[editorStore.gizmoMode], false);
			if (hits.length) return this.#grabGizmo(e, hits[0].object);
		}
		if (e.shiftKey) {
			this.#beginMarquee(e, false);
			return true;
		}
		return false;
	};

	#grabGizmo(e: PointerEvent, h: THREE.Object3D): boolean {
		const gizmoGroup = this.#gizmoGroup!;
		const origin = gizmoGroup.position.clone();
		const roots = this.#editableRoots();
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
				obj.updateWorldMatrix(true, true);
				t.startWorldPos = obj.getWorldPosition(new THREE.Vector3());
				t.startWorldQ = obj.getWorldQuaternion(new THREE.Quaternion());
				t.parentWorldQInv = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
				// "Each" turns an object about the same thing the gizmo points
				// at for a single selection — its own visible centre. Using the
				// object's origin instead would spin an import around whatever
				// arbitrary point its exporter happened to use, which reads as a
				// swing rather than a rotation.
				const ownBox = new THREE.Box3().setFromObject(obj);
				t.ownCentre = isFinite(ownBox.min.x) && !ownBox.isEmpty()
					? ownBox.getCenter(new THREE.Vector3())
					: t.startWorldPos.clone();
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
	}

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
			const each = editorStore.transformStyle === 'each';
			drag.targets.forEach((t) => {
				if (!t.startWorldQ || !t.startWorldPos) return;
				const worldQ = dq.clone().multiply(t.startWorldQ);
				const localQ = t.parentWorldQInv!.clone().multiply(worldQ);
				const eul = new THREE.Euler().setFromQuaternion(localQ, 'XYZ');
				t.node.transform.rotation = { x: round3(R2D(eul.x)), y: round3(R2D(eul.y)), z: round3(R2D(eul.z)) };
				// Together turns everything around the shared pivot; Each turns
				// every object around its own centre. Both still have to move
				// the object, because rotating about any point other than its
				// origin displaces it — "in place" is a statement about the
				// pivot, not about the position staying untouched.
				const pivot = each ? t.ownCentre ?? t.startWorldPos : drag.origin;
				const rel = t.startWorldPos.clone().sub(pivot).applyQuaternion(dq).add(pivot);
				t.parent.updateWorldMatrix(true, false);
				const local = t.parent.worldToLocal(rel);
				t.node.transform.position = { x: round3(local.x), y: round3(local.y), z: round3(local.z) };
			});
		} else {
			const cur = p.clone().sub(drag.origin);
			const proj = cur.dot(drag.axisDir!);
			let f = proj / drag.startProj;
			if (!isFinite(f)) return;
			f = Math.max(0.02, Math.min(40, f));
			if (editorStore.snapEnabled) f = Math.round(f * 10) / 10 || 0.1;
			const cmd = e.metaKey || e.ctrlKey;
			const pinEdge = drag.scaleAxis !== 'uniform' && e.shiftKey;
			const pinMax = pinEdge && cmd;
			const each = editorStore.transformStyle === 'each';
			const scaleAxes: Axis[] =
				drag.scaleAxis === 'uniform'
					? ['x', 'y', 'z']
					: editorStore.linkedScaleAxes(drag.scaleAxis as Axis);
			drag.targets.forEach((t) => {
				let groupPos = t.start;
				// Anchoring an edge and orbiting the group pivot are two different
				// answers to "where does this object end up", and adding them
				// together lands on neither. When an edge is pinned, that wins:
				// the object stays put except for the shift that keeps its edge
				// in place. (Without this, shift-scaling anything whose origin
				// isn't its bounding-box centre — a group, an import — visibly
				// slid the "anchored" edge.)
				const pivot = each ? t.ownCentre ?? t.startWorldPos : drag.origin;
				if (!pinEdge && t.startWorldPos && pivot) {
					const offset = t.startWorldPos.clone().sub(pivot);
					const newOffset =
						drag.scaleAxis === 'uniform'
							? offset.clone().multiplyScalar(f)
							: offset.clone().addScaledVector(drag.axisDir!, offset.dot(drag.axisDir!) * (f - 1));
					t.parent.updateWorldMatrix(true, false);
					const local = t.parent.worldToLocal(pivot.clone().add(newOffset));
					groupPos = { x: local.x, y: local.y, z: local.z };
				}
				for (const axis of scaleAxes) {
					t.node.transform.scale[axis] = round3(t.startScale[axis] * f);
				}
				const pinAxis = drag.scaleAxis === 'uniform' ? null : (drag.scaleAxis as Axis);
				const edgeLocal =
					pinEdge && pinAxis && t.localBox
						? pinMax
							? t.localBox.max[pinAxis]
							: t.localBox.min[pinAxis]
						: undefined;
				if (pinAxis && edgeLocal !== undefined && isFinite(edgeLocal)) {
					const shift = new THREE.Vector3();
					shift[pinAxis] = edgeLocal * t.startScale[pinAxis] * (1 - f);
					if (t.startLocalQ) shift.applyQuaternion(t.startLocalQ);
					t.node.transform.position.x = round3(groupPos.x + shift.x);
					t.node.transform.position.y = round3(groupPos.y + shift.y);
					t.node.transform.position.z = round3(groupPos.z + shift.z);
				} else {
					t.node.transform.position.x = round3(groupPos.x);
					t.node.transform.position.y = round3(groupPos.y);
					t.node.transform.position.z = round3(groupPos.z);
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

	#marqueeStart: { x0: number; y0: number; model: boolean } | null = null;

	#beginMarquee(e: PointerEvent, model: boolean) {
		const rect = this.renderer.domElement.getBoundingClientRect();
		this.#marqueeStart = { x0: e.clientX, y0: e.clientY, model };
		editorStore.marquee = { x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 };
		window.addEventListener('pointermove', this.#onMarqueeMove);
		window.addEventListener('pointerup', this.#onMarqueeUp);
	}

	#onMarqueeMove = (e: PointerEvent) => {
		const start = this.#marqueeStart;
		if (!start) return;
		const rect = this.renderer.domElement.getBoundingClientRect();
		const x = Math.min(start.x0, e.clientX) - rect.left;
		const y = Math.min(start.y0, e.clientY) - rect.top;
		editorStore.marquee = {
			x,
			y,
			w: Math.abs(e.clientX - start.x0),
			h: Math.abs(e.clientY - start.y0)
		};
	};

	#onMarqueeUp = () => {
		window.removeEventListener('pointermove', this.#onMarqueeMove);
		window.removeEventListener('pointerup', this.#onMarqueeUp);
		const start = this.#marqueeStart;
		const box = editorStore.marquee;
		this.#marqueeStart = null;
		editorStore.marquee = null;
		if (!start || !box) return;
		if (box.w < 5 && box.h < 5) return;
		// The click-to-select handler also releases on window and registers
		// after this one, so flagging here is seen by it on this same event.
		// It self-clears on the next task, so it can't leak into a later click.
		this.gizmoWasDragging = true;
		if (this.#edit) this.#edit.pick = null;
		if (start.model) this.#marqueeSelectModel(box);
		else this.#marqueeSelectObjects(box);
		setTimeout(() => {
			this.gizmoWasDragging = false;
		}, 0);
	};

	/**
	 * True when any of a capped, evenly-spread sample of `obj`'s surface
	 * vertices projects inside the marquee. Capped because a dense import has
	 * hundreds of thousands of vertices and box-select has to stay interactive;
	 * spread by stride rather than taking the first N so the sample covers the
	 * whole model instead of one corner of it.
	 */
	#sampleInBox(obj: THREE.Object3D, inBox: (x: number, y: number) => boolean): boolean {
		const rect = this.renderer.domElement.getBoundingClientRect();
		const v = new THREE.Vector3();
		const BUDGET = 240;
		let hit = false;
		obj.traverse((o) => {
			if (hit) return;
			const mesh = o as THREE.Mesh;
			const pos = mesh.isMesh ? (mesh.geometry?.getAttribute('position') as THREE.BufferAttribute) : null;
			if (!pos || !pos.count) return;
			const stride = Math.max(1, Math.floor(pos.count / BUDGET));
			for (let i = 0; i < pos.count; i += stride) {
				v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
				const s = worldToScreen(v, this.camera, rect.width, rect.height);
				if (s.z <= 1 && inBox(s.x, s.y)) {
					hit = true;
					return;
				}
			}
		});
		return hit;
	}

	#rectOverlap(a: { x: number; y: number; w: number; h: number }, bx: number, by: number, bw: number, bh: number) {
		return a.x < bx + bw && a.x + a.w > bx && a.y < by + bh && a.y + a.h > by;
	}

	#marqueeSelectObjects(box: { x: number; y: number; w: number; h: number }) {
		const rect = this.renderer.domElement.getBoundingClientRect();
		const ids: string[] = [];
		const corner = new THREE.Vector3();
		const inBox = (sx: number, sy: number) =>
			sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h;
		for (const [id, obj] of this.threeObjects) {
			const node = docStore.node(id);
			if (!node || isGroup(node) || docStore.isLocked(id) || !node.visible) continue;
			obj.updateWorldMatrix(true, true);
			const b = new THREE.Box3().setFromObject(obj);
			if (!isFinite(b.min.x)) continue;

			// Cheap reject first: if the box doesn't even reach the object's
			// screen-space bounds, it can't have caught any of it.
			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity,
				any = false;
			for (let i = 0; i < 8; i++) {
				corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
				const s = worldToScreen(corner, this.camera, rect.width, rect.height);
				if (s.z > 1) continue;
				any = true;
				minX = Math.min(minX, s.x);
				minY = Math.min(minY, s.y);
				maxX = Math.max(maxX, s.x);
				maxY = Math.max(maxY, s.y);
			}
			if (!any || !this.#rectOverlap(box, minX, minY, maxX - minX, maxY - minY)) continue;

			// Then confirm against actual surface points. A bounding box is a
			// bad stand-in for a long diagonal or an L-shaped model — testing it
			// alone selected things nowhere near the box the user drew.
			if (this.#sampleInBox(obj, inBox)) ids.push(id);
		}
		if (!ids.length) return;
		this.setSelection([...new Set([...docStore.selectedIds, ...ids])]);
	}

	#marqueeSelectModel(box: { x: number; y: number; w: number; h: number }) {
		if (!this.#edit) return;
		const node = editorStore.isolatedId ? docStore.node(editorStore.isolatedId) : null;
		if (!node) return;
		const obj = this.threeObjects.get(node.id);
		if (!obj) return;
		obj.updateWorldMatrix(true, false);
		const rect = this.renderer.domElement.getBoundingClientRect();
		const mode = editorStore.editSelectMode;
		const inBox = (sx: number, sy: number) =>
			sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h;
		if (mode === 'vertex') {
			for (let i = 0; i < this.#edit.bmesh.verts.length; i++) {
				const v = this.#edit.bmesh.verts[i];
				const s = worldToScreen(
					new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(obj.matrixWorld),
					this.camera,
					rect.width,
					rect.height
				);
				if (s.z <= 1 && inBox(s.x, s.y)) this.#edit.verts.add(i);
			}
		} else if (mode === 'edge') {
			for (const [a, b] of edgesOf(this.#edit.bmesh)) {
				const va = this.#edit.bmesh.verts[a];
				const vb = this.#edit.bmesh.verts[b];
				const sa = worldToScreen(
					new THREE.Vector3(va[0], va[1], va[2]).applyMatrix4(obj.matrixWorld),
					this.camera,
					rect.width,
					rect.height
				);
				const sb = worldToScreen(
					new THREE.Vector3(vb[0], vb[1], vb[2]).applyMatrix4(obj.matrixWorld),
					this.camera,
					rect.width,
					rect.height
				);
				if ((sa.z <= 1 && inBox(sa.x, sa.y)) || (sb.z <= 1 && inBox(sb.x, sb.y))) {
					this.#edit.edges.add(edgeKey(a, b));
				}
			}
		} else {
			this.#edit.bmesh.faces.forEach((f, i) => {
				const c = new THREE.Vector3();
				for (const vi of f) {
					const v = this.#edit!.bmesh.verts[vi];
					c.add(new THREE.Vector3(v[0], v[1], v[2]));
				}
				if (!f.length) return;
				c.multiplyScalar(1 / f.length).applyMatrix4(obj.matrixWorld);
				const s = worldToScreen(c, this.camera, rect.width, rect.height);
				if (s.z <= 1 && inBox(s.x, s.y)) this.#edit!.faces.add(i);
			});
		}
		this.#paintEditOverlay();
	}
}
