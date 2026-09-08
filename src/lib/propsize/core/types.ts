/**
 * Propsize document model.
 *
 * The single most important decision here: binary data never lives in the
 * document. An imported GLB is an *asset* referenced by id; the node only
 * stores that id plus its own transform. That keeps documents small enough to
 * URL-encode (needed for share links and the SEO preset pages), keeps undo
 * snapshots cheap, and means a scene can be saved with references to files in
 * the user's own model folder instead of a 40 MB blob.
 */

export type Vec3 = { x: number; y: number; z: number };

export type PrimitiveType =
	| 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'torusKnot'
	| 'tetra' | 'octa' | 'icosa' | 'dodeca' | 'plane'
	| 'circle' | 'ring' | 'capsule' | 'lathe' | 'extrude';

export type Vec2 = { x: number; y: number };

/**
 * A 2D outline, stored as typed segments rather than a bare point list.
 *
 * Segments carry their curve type from the start even though the editor
 * currently only draws lines and computed-tangent cubics: the data model is
 * the expensive thing to change later, the interface isn't. Adding a pen tool
 * with draggable handles becomes pure UI work rather than a document
 * migration, because the handles it would edit are already here.
 *
 * Consumers differ in what they can take. three.js `Shape` (and so
 * ShapeGeometry / ExtrudeGeometry) understands curves directly; LatheGeometry
 * only accepts flat points, so its profile gets sampled — see profileToPoints.
 */
export type ProfileSegment =
	| { type: 'line'; to: Vec2 }
	| { type: 'quad'; ctrl: Vec2; to: Vec2 }
	| { type: 'cubic'; c1: Vec2; c2: Vec2; to: Vec2 };

export type Profile = {
	/** Where the outline begins; every segment continues from the previous end. */
	start: Vec2;
	segments: ProfileSegment[];
	/** Join the last point back to the first. Unused by lathe, needed by shape/extrude. */
	closed?: boolean;
};

/**
 * Geometry parameters. Mostly scalars, but profile-based shapes keep their
 * outline here too so a primitive stays one self-contained node.
 */
export type GeometryParams = Record<string, number | boolean | Profile>;

export const isProfile = (v: unknown): v is Profile =>
	!!v && typeof v === 'object' && Array.isArray((v as Profile).segments) && !!(v as Profile).start;

export type TextureSpec = {
	type: 'none' | 'checker' | 'stripes' | 'speckle' | 'image';
	colorA: string | null;
	colorB: string | null;
	tiles: number;
	repeatX: number;
	repeatY: number;
	/** Image textures reference an asset rather than inlining a data URL. */
	assetId: string | null;
};

export type MaterialSpec = {
	color: string;
	roughness: number;
	metalness: number;
	flatShading: boolean;
	wireframe: boolean;
	transparent: boolean;
	opacity: number;
	emissive: string;
	emissiveIntensity: number;
	side: 'front' | 'back' | 'double';
	texture: TextureSpec;
};

type NodeBase = {
	id: string;
	name: string;
	parentId: string | null;
	visible: boolean;
	locked: boolean;
	transform: { position: Vec3; rotation: Vec3; scale: Vec3 };
	/**
	 * Shared data with other nodes of the same link. Transform stays per-object.
	 * Shape / mesh asset edits on any member update the rest. Null = independent.
	 */
	dataLink: string | null;
};

export type PrimitiveNode = NodeBase & {
	kind: 'primitive';
	type: PrimitiveType;
	geometry: GeometryParams;
	/** Points into doc.materials — shared, so one edit can repaint many props. */
	materialId: string;
	castShadow: boolean;
	receiveShadow: boolean;
};

export type GroupNode = NodeBase & { kind: 'group' };

/**
 * A baked, authored mesh. Geometry lives in an asset (same rule as imports);
 * the node keeps transform + a shared materialId. Convert-from-primitive
 * writes one of these; isolation Model/Paint will edit that asset.
 */
export type MeshNode = NodeBase & {
	kind: 'mesh';
	assetId: string;
	materialId: string;
	castShadow: boolean;
	receiveShadow: boolean;
	stats: { vertices: number; triangles: number };
};

/**
 * An imported OBJ/GLB. Its geometry and materials come from the file, so it has
 * no parametric fields and no materialId — overriding an imported material is a
 * separate, explicit action (see materialOverride).
 */
export type ImportedNode = NodeBase & {
	kind: 'imported';
	assetId: string;
	/** Optional: replace every material in the imported subtree with this one. */
	materialOverride: string | null;
	castShadow: boolean;
	receiveShadow: boolean;
	/** Cached at import time so the inspector can show stats without a scene walk. */
	stats: { meshes: number; triangles: number };
	/** Set when this node is one constituent object split out of a
	 *  multi-object import, rather than the whole file. `name` is matched
	 *  first against the cached template's children (stable across a
	 *  re-import that reorders children); `index` is the fallback. `center`
	 *  is this part's own geometry centroid (see ImportPart) — it's what lets
	 *  the live object be built as a wrapper whose *own* transform (driven by
	 *  this node's transform, and what the gizmo pivots on) sits at the
	 *  part's own centre rather than the whole file's shared origin. */
	part: { index: number; name: string; center: Vec3 } | null;
};

export type SceneNode = PrimitiveNode | GroupNode | ImportedNode | MeshNode;

/**
 * Where an asset's bytes come from.
 *  - library: a file in a folder the user granted access to. Nothing is copied;
 *    we re-read it on load. Path is relative to the library root.
 *  - embedded: a data URL carried inside the document. Only for small textures
 *    and for exports that must be self-contained.
 *  - remote: a URL, used by the preset/SEO pages that ship their own models.
 */
export type AssetSource =
	| { type: 'library'; path: string }
	| { type: 'embedded'; dataUrl: string }
	| { type: 'remote'; url: string };

export type Asset = {
	id: string;
	name: string;
	kind: 'model' | 'texture' | 'mesh';
	format: 'glb' | 'gltf' | 'obj' | 'fbx' | 'stl' | 'ply' | 'png' | 'jpg' | 'webp' | 'meshjson';
	source: AssetSource;
	/** Data URL of a small render, cached in IndexedDB, not in the document. */
	thumbnail?: string;
};

export type PropsizeDoc = {
	version: 2;
	nodes: SceneNode[];
	materials: Record<string, MaterialSpec>;
	/** Assets referenced by this document. Bytes are NOT stored here. */
	assets: Record<string, Asset>;
	nextId: number;
};

export const isPrimitive = (n: SceneNode): n is PrimitiveNode => n.kind === 'primitive';
export const isGroup = (n: SceneNode): n is GroupNode => n.kind === 'group';
export const isImported = (n: SceneNode): n is ImportedNode => n.kind === 'imported';
export const isAuthoredMesh = (n: SceneNode): n is MeshNode => n.kind === 'mesh';

/** Nodes that own drawable geometry — everything except groups. */
export const isMeshNode = (
	n: SceneNode
): n is PrimitiveNode | ImportedNode | MeshNode => n.kind !== 'group';

export function emptyDoc(): PropsizeDoc {
	return { version: 2, nodes: [], materials: {}, assets: {}, nextId: 1 };
}
