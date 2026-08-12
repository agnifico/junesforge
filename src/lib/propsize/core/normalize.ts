/**
 * Defensive normalization for documents that arrive from outside this session:
 * a .json the user opens, a localStorage entry written by an older build, or a
 * scene someone (or something) authored by hand.
 *
 * This matters because the inspector reads deep paths straight off the
 * document — `material.texture.type`, `geometry.wSeg`, `node.transform.scale.x`.
 * A document missing any one of them doesn't degrade, it throws mid-render and
 * takes the whole editor down with it. So every document entering the store
 * from outside is filled out against the same defaults the editor itself uses,
 * and anything unsalvageable is dropped rather than left to crash later.
 *
 * The repairs are reported, not silent: a file that needed patching is worth
 * telling the user about, because re-saving will rewrite it in full form.
 */

import { GEO_DEFS } from './geometry';
import { defaultMaterial, defaultTexture } from './materials';
import { defaultTransform } from './utils';
import type {
	Asset,
	GeometryParams,
	MaterialSpec,
	Profile,
	ProfileSegment,
	PropsizeDoc,
	SceneNode,
	TextureSpec,
	Vec2,
	Vec3
} from './types';

export type NormalizeResult = { doc: PropsizeDoc; repairs: string[] };

const isObj = (v: unknown): v is Record<string, unknown> =>
	!!v && typeof v === 'object' && !Array.isArray(v);

const num = (v: unknown, fallback: number) =>
	typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

const str = (v: unknown, fallback: string) =>
	typeof v === 'string' && v.length > 0 ? v : fallback;

const colorOr = (v: unknown, fallback: string) =>
	typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : fallback;

function vec3(v: unknown, fallback: Vec3): Vec3 {
	if (!isObj(v)) return fallback;
	return { x: num(v.x, fallback.x), y: num(v.y, fallback.y), z: num(v.z, fallback.z) };
}

const TEXTURE_TYPES = new Set<TextureSpec['type']>(['none', 'checker', 'stripes', 'speckle', 'image']);
const SIDES = new Set<MaterialSpec['side']>(['front', 'back', 'double']);

function normalizeTexture(raw: unknown): TextureSpec {
	const d = defaultTexture();
	if (!isObj(raw)) return d;
	const type = raw.type as TextureSpec['type'];
	return {
		type: TEXTURE_TYPES.has(type) ? type : d.type,
		colorA: typeof raw.colorA === 'string' ? raw.colorA : d.colorA,
		colorB: typeof raw.colorB === 'string' ? raw.colorB : d.colorB,
		tiles: num(raw.tiles, d.tiles),
		repeatX: num(raw.repeatX, d.repeatX),
		repeatY: num(raw.repeatY, d.repeatY),
		assetId: typeof raw.assetId === 'string' ? raw.assetId : d.assetId
	};
}

function normalizeMaterial(raw: unknown): MaterialSpec {
	const d = defaultMaterial();
	if (!isObj(raw)) return d;
	const side = raw.side as MaterialSpec['side'];
	return {
		color: colorOr(raw.color, d.color),
		roughness: num(raw.roughness, d.roughness),
		metalness: num(raw.metalness, d.metalness),
		flatShading: bool(raw.flatShading, d.flatShading),
		wireframe: bool(raw.wireframe, d.wireframe),
		transparent: bool(raw.transparent, d.transparent),
		opacity: num(raw.opacity, d.opacity),
		emissive: colorOr(raw.emissive, d.emissive),
		emissiveIntensity: num(raw.emissiveIntensity, d.emissiveIntensity),
		side: SIDES.has(side) ? side : d.side,
		texture: normalizeTexture(raw.texture)
	};
}

function normalizeTransform(raw: unknown) {
	const d = defaultTransform();
	const t = isObj(raw) ? raw : {};
	return {
		position: vec3(t.position, d.position),
		rotation: vec3(t.rotation, d.rotation),
		scale: vec3(t.scale, d.scale)
	};
}

/**
 * Propsize abbreviates its geometry parameters (`radialSeg`, `wSeg`), but
 * three.js spells them out (`radialSegments`, `widthSegments`) — and anything
 * generating a scene reads from three.js's constructors, so that's the spelling
 * it writes. Treating those as unknown and substituting a default is not a
 * cosmetic loss: a cylinder meant to have 3 radial segments is a triangular
 * prism (a roof gable), and the default 8 turns it into a dome.
 *
 * Only the abbreviations that can't be derived by rule need listing; the
 * general `…Segments` → `…Seg` rule covers the rest. Each entry is a list
 * because the same three.js name maps to different keys per shape —
 * heightSegments is `heightSeg` on a cylinder but `hSeg` on a box.
 */
const GEO_KEY_ALIASES: Record<string, string[]> = {
	widthsegments: ['wSeg', 'widthSegments'],
	heightsegments: ['heightSeg', 'hSeg', 'heightSegments'],
	depthsegments: ['dSeg'],
	radiussegments: ['radialSeg', 'radialSegments'],
	widthseg: ['wSeg', 'widthSegments'],
	heightseg: ['heightSeg', 'hSeg', 'heightSegments'],
	depthseg: ['dSeg'],
	wseg: ['wSeg', 'widthSegments'],
	hseg: ['hSeg', 'heightSegments'],
	dseg: ['dSeg']
};

/** Maps a written parameter name onto the key this shape actually uses, or
 *  null if it names nothing this shape has. */
function resolveGeoKey(key: string, defaults: GeometryParams): string | null {
	if (key in defaults) return key;

	const lower = key.toLowerCase();
	const canonical = Object.keys(defaults);
	const ci = canonical.find((k) => k.toLowerCase() === lower);
	if (ci) return ci;

	// Both directions: three.js spells them out (radialSegments), Propsize's
	// older shapes abbreviate (radialSeg), and newer ones use the three.js name.
	// Either spelling should reach either shape.
	if (lower.endsWith('segments')) {
		const short = lower.slice(0, -'segments'.length) + 'seg';
		const match = canonical.find((k) => k.toLowerCase() === short);
		if (match) return match;
	}
	if (lower.endsWith('seg')) {
		const long = lower + 'ments';
		const match = canonical.find((k) => k.toLowerCase() === long);
		if (match) return match;
	}

	for (const candidate of GEO_KEY_ALIASES[lower] ?? []) {
		if (candidate in defaults) return candidate;
	}
	return null;
}

/**
 * Profiles are the one piece of structured data inside `geometry`, so they get
 * validated rather than merely defaulted. A malformed outline can't be
 * salvaged into a sensible shape, and a half-valid one would throw inside
 * three.js — so anything that doesn't parse falls back to the shape's default
 * profile, which is at least something the user can then edit.
 */
function normalizeProfile(raw: unknown, fallback: Profile): Profile {
	if (!isObj(raw) || !Array.isArray(raw.segments)) return fallback;
	const pt = (v: unknown, dflt: Vec2): Vec2 =>
		isObj(v) ? { x: num(v.x, dflt.x), y: num(v.y, dflt.y) } : dflt;

	const start = pt(raw.start, { x: 0, y: 0 });
	const segments: ProfileSegment[] = [];
	let cur = start;
	for (const s of raw.segments) {
		if (!isObj(s)) continue;
		const to = pt(s.to, cur);
		if (s.type === 'cubic') {
			segments.push({ type: 'cubic', c1: pt(s.c1, cur), c2: pt(s.c2, to), to });
		} else if (s.type === 'quad') {
			segments.push({ type: 'quad', ctrl: pt(s.ctrl, cur), to });
		} else {
			segments.push({ type: 'line', to });
		}
		cur = to;
	}
	// One segment is the minimum that describes anything at all.
	if (!segments.length) return fallback;
	return { start, segments, ...(raw.closed === true ? { closed: true } : {}) };
}

/** A document may name a kind, or we infer one from the fields it carries. */
function inferKind(raw: Record<string, unknown>): SceneNode['kind'] {
	const k = raw.kind;
	if (k === 'primitive' || k === 'group' || k === 'imported') return k;
	if (typeof raw.assetId === 'string') return 'imported';
	if (typeof raw.type === 'string' || isObj(raw.geometry)) return 'primitive';
	return 'group';
}

export function normalizeDoc(input: unknown): NormalizeResult | null {
	if (!isObj(input) || !Array.isArray(input.nodes)) return null;

	const repairs: string[] = [];
	const materials: Record<string, MaterialSpec> = {};
	let patchedMaterials = 0;

	if (isObj(input.materials)) {
		for (const [id, raw] of Object.entries(input.materials)) {
			const m = normalizeMaterial(raw);
			// `texture` is the field hand-written documents most often omit, and
			// the one the surface tab dereferences first.
			if (!isObj(raw) || !isObj((raw as Record<string, unknown>).texture)) patchedMaterials++;
			materials[id] = m;
		}
	}

	const nodes: SceneNode[] = [];
	const seenIds = new Set<string>();
	let dropped = 0;
	let addedMaterials = 0;
	let aliasedGeoKeys = 0;
	let unknownGeoKeys = 0;

	for (const raw of input.nodes) {
		if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id) {
			dropped++;
			continue;
		}
		if (seenIds.has(raw.id)) {
			dropped++;
			continue;
		}
		seenIds.add(raw.id);

		const kind = inferKind(raw);
		const base = {
			id: raw.id,
			name: str(raw.name, raw.id),
			parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
			visible: bool(raw.visible, true),
			locked: bool(raw.locked, false),
			transform: normalizeTransform(raw.transform)
		};

		if (kind === 'group') {
			nodes.push({ ...base, kind: 'group' });
			continue;
		}

		if (kind === 'imported') {
			const stats = isObj(raw.stats) ? raw.stats : {};
			nodes.push({
				...base,
				kind: 'imported',
				assetId: str(raw.assetId, ''),
				materialOverride: typeof raw.materialOverride === 'string' ? raw.materialOverride : null,
				castShadow: bool(raw.castShadow, true),
				receiveShadow: bool(raw.receiveShadow, true),
				stats: { meshes: num(stats.meshes, 0), triangles: num(stats.triangles, 0) }
			});
			continue;
		}

		const type = (typeof raw.type === 'string' && raw.type in GEO_DEFS ? raw.type : 'box') as
			keyof typeof GEO_DEFS;
		// Merge over the shape's defaults so every field the inspector's sliders
		// bind to exists, resolving three.js parameter names on the way in.
		const geometry = { ...GEO_DEFS[type].defaults };
		if (isObj(raw.geometry)) {
			for (const [k, v] of Object.entries(raw.geometry)) {
				if (k === 'profile' && GEO_DEFS[type].profile) {
					geometry.profile = normalizeProfile(v, GEO_DEFS[type].defaults.profile as Profile);
					continue;
				}
				if (typeof v !== 'number' && typeof v !== 'boolean') continue;
				const key = resolveGeoKey(k, GEO_DEFS[type].defaults);
				if (!key) {
					unknownGeoKeys++;
					continue;
				}
				if (key !== k) aliasedGeoKeys++;
				geometry[key] = v;
			}
		}

		// A primitive whose material is missing gets one minted under the id it
		// asked for, so nodes that shared a material still share the repair.
		let materialId = str(raw.materialId, '');
		if (!materialId) materialId = `m_${raw.id}`;
		if (!materials[materialId]) {
			materials[materialId] = defaultMaterial();
			addedMaterials++;
		}

		nodes.push({
			...base,
			kind: 'primitive',
			type,
			geometry,
			materialId,
			castShadow: bool(raw.castShadow, true),
			receiveShadow: bool(raw.receiveShadow, true)
		});
	}

	// Parent links: drop references to nodes that aren't here, and break cycles.
	// Either would send the scene builder into infinite recursion.
	const byId = new Map(nodes.map((n) => [n.id, n]));
	let rewiredParents = 0;
	for (const n of nodes) {
		if (n.parentId !== null && !byId.has(n.parentId)) {
			n.parentId = null;
			rewiredParents++;
			continue;
		}
		const seen = new Set<string>([n.id]);
		let cur = n.parentId ? byId.get(n.parentId) : undefined;
		while (cur) {
			if (seen.has(cur.id)) {
				n.parentId = null;
				rewiredParents++;
				break;
			}
			seen.add(cur.id);
			cur = cur.parentId ? byId.get(cur.parentId) : undefined;
		}
	}

	const assets: Record<string, Asset> = {};
	if (isObj(input.assets)) {
		for (const [id, raw] of Object.entries(input.assets)) {
			if (isObj(raw) && isObj(raw.source) && typeof raw.source.type === 'string') {
				assets[id] = raw as unknown as Asset;
			}
		}
	}

	const highestId = nodes.reduce((max, n) => {
		const idNum = parseInt(n.id.replace(/^\D+/, ''), 10);
		return Number.isFinite(idNum) && idNum > max ? idNum : max;
	}, 0);

	if (patchedMaterials) repairs.push(`filled in ${patchedMaterials} incomplete material${patchedMaterials === 1 ? '' : 's'}`);
	if (addedMaterials) repairs.push(`added ${addedMaterials} missing material${addedMaterials === 1 ? '' : 's'}`);
	if (aliasedGeoKeys) repairs.push(`matched ${aliasedGeoKeys} three.js geometry parameter${aliasedGeoKeys === 1 ? '' : 's'}`);
	if (unknownGeoKeys) repairs.push(`ignored ${unknownGeoKeys} unknown geometry parameter${unknownGeoKeys === 1 ? '' : 's'}`);
	if (dropped) repairs.push(`skipped ${dropped} unreadable node${dropped === 1 ? '' : 's'}`);
	if (rewiredParents) repairs.push(`re-parented ${rewiredParents} orphaned node${rewiredParents === 1 ? '' : 's'}`);

	return {
		doc: {
			version: 2,
			nodes,
			materials,
			assets,
			nextId: Math.max(num(input.nextId, 0), highestId + 1, 1)
		},
		repairs
	};
}
