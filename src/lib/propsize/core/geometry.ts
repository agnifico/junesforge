import * as THREE from 'three';
import type { GeometryParams, PrimitiveType, Profile } from './types';
import { isProfile } from './types';
import { degToRadCode, f } from './utils';
import { ICONS } from './icons';
import { defaultProfile, defaultShapeProfile, profileToPoints, profileToShape } from './profile';

export type GeoField = {
	key: string;
	label: string;
	// Sliders require these; bool fields (rendered as a toggle) don't.
	min?: number;
	max?: number;
	step?: number;
	int?: boolean;
	bool?: boolean;
	unit?: string;
};

export type GeoDef = {
	label: string;
	icon: string;
	defaults: GeometryParams;
	fields: GeoField[];
	build: (p: GeometryParams) => THREE.BufferGeometry;
	code: (p: GeometryParams) => string;
	/** Authored from a 2D outline — the inspector shows the profile editor. */
	profile?: boolean;
	/** Lathe silhouettes are radii; extrude outlines are a closed XY shape. */
	profileKind?: 'lathe' | 'shape';
};

// Angles live in the document as degrees, matching rotation and torus `arc`;
// three.js wants radians, so every angular parameter converts on the way out.
const n = (p: GeometryParams, key: string) => p[key] as number;
const rad = (p: GeometryParams, key: string) => ((p[key] as number) * Math.PI) / 180;
const prof = (p: GeometryParams): Profile => (isProfile(p.profile) ? p.profile : defaultProfile());
const shapeProf = (p: GeometryParams): Profile =>
	isProfile(p.profile) ? p.profile : defaultShapeProfile();

function emitShapeConstructor(profile: Profile): string {
	const lines = ['(() => {', '  const s = new THREE.Shape();', `  s.moveTo(${f(profile.start.x)}, ${f(profile.start.y)});`];
	for (const seg of profile.segments) {
		if (seg.type === 'line') {
			lines.push(`  s.lineTo(${f(seg.to.x)}, ${f(seg.to.y)});`);
		} else if (seg.type === 'quad') {
			lines.push(
				`  s.quadraticCurveTo(${f(seg.ctrl.x)}, ${f(seg.ctrl.y)}, ${f(seg.to.x)}, ${f(seg.to.y)});`
			);
		} else {
			lines.push(
				`  s.bezierCurveTo(${f(seg.c1.x)}, ${f(seg.c1.y)}, ${f(seg.c2.x)}, ${f(seg.c2.y)}, ${f(seg.to.x)}, ${f(seg.to.y)});`
			);
		}
	}
	if (profile.closed !== false) lines.push('  s.closePath();');
	lines.push('  return s;', '})()');
	return lines.join('\n');
}

/** Shared trailing fields for the shapes that can be swept through part of a turn. */
const ARC_FIELDS: GeoField[] = [
	{ key: 'thetaStart', label: 'Sweep start', min: 0, max: 360, step: 1, unit: '°' },
	{ key: 'thetaLength', label: 'Sweep', min: 1, max: 360, step: 1, unit: '°' }
];

export const GEO_DEFS: Record<PrimitiveType, GeoDef> = {
	box: {
		label: 'Cube',
		icon: ICONS.box,
		defaults: { width: 1, height: 1, depth: 1, wSeg: 1, hSeg: 1, dSeg: 1 },
		fields: [
			{ key: 'width', label: 'Width', min: 0.05, max: 8, step: 0.05 },
			{ key: 'height', label: 'Height', min: 0.05, max: 8, step: 0.05 },
			{ key: 'depth', label: 'Depth', min: 0.05, max: 8, step: 0.05 },
			{ key: 'wSeg', label: 'Width segs', min: 1, max: 16, step: 1, int: true },
			{ key: 'hSeg', label: 'Height segs', min: 1, max: 16, step: 1, int: true },
			{ key: 'dSeg', label: 'Depth segs', min: 1, max: 16, step: 1, int: true }
		],
		build: (p) =>
			new THREE.BoxGeometry(
				p.width as number,
				p.height as number,
				p.depth as number,
				p.wSeg as number,
				p.hSeg as number,
				p.dSeg as number
			),
		code: (p) =>
			`new THREE.BoxGeometry(${f(p.width as number)}, ${f(p.height as number)}, ${f(p.depth as number)}, ${p.wSeg}, ${p.hSeg}, ${p.dSeg})`
	},
	sphere: {
		label: 'Sphere',
		icon: ICONS.sphere,
		// phi sweeps around the equator, theta from pole to pole — together they
		// give orange slices, hemispheres and domes from one primitive.
		defaults: { radius: 0.75, wSeg: 8, hSeg: 6, phiStart: 0, phiLength: 360, thetaStart: 0, thetaLength: 180 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 6, step: 0.05 },
			{ key: 'wSeg', label: 'Width segs', min: 3, max: 48, step: 1, int: true },
			{ key: 'hSeg', label: 'Height segs', min: 2, max: 32, step: 1, int: true },
			{ key: 'phiStart', label: 'Sweep start', min: 0, max: 360, step: 1, unit: '°' },
			{ key: 'phiLength', label: 'Sweep', min: 1, max: 360, step: 1, unit: '°' },
			{ key: 'thetaStart', label: 'From pole', min: 0, max: 180, step: 1, unit: '°' },
			{ key: 'thetaLength', label: 'Pole span', min: 1, max: 180, step: 1, unit: '°' }
		],
		build: (p) =>
			new THREE.SphereGeometry(
				n(p, 'radius'), n(p, 'wSeg'), n(p, 'hSeg'),
				rad(p, 'phiStart'), rad(p, 'phiLength'), rad(p, 'thetaStart'), rad(p, 'thetaLength')
			),
		code: (p) =>
			`new THREE.SphereGeometry(${f(n(p, 'radius'))}, ${p.wSeg}, ${p.hSeg}, ${degToRadCode(n(p, 'phiStart'))}, ${degToRadCode(n(p, 'phiLength'))}, ${degToRadCode(n(p, 'thetaStart'))}, ${degToRadCode(n(p, 'thetaLength'))})`
	},
	icosa: {
		label: 'Icosahedron',
		icon: ICONS.icosa,
		defaults: { radius: 0.75, detail: 0 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 6, step: 0.05 },
			{ key: 'detail', label: 'Detail', min: 0, max: 4, step: 1, int: true }
		],
		build: (p) => new THREE.IcosahedronGeometry(p.radius as number, p.detail as number),
		code: (p) => `new THREE.IcosahedronGeometry(${f(p.radius as number)}, ${p.detail})`
	},
	octa: {
		label: 'Octahedron',
		icon: ICONS.octa,
		defaults: { radius: 0.75, detail: 0 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 6, step: 0.05 },
			{ key: 'detail', label: 'Detail', min: 0, max: 4, step: 1, int: true }
		],
		build: (p) => new THREE.OctahedronGeometry(p.radius as number, p.detail as number),
		code: (p) => `new THREE.OctahedronGeometry(${f(p.radius as number)}, ${p.detail})`
	},
	dodeca: {
		label: 'Dodecahedron',
		icon: ICONS.dodeca,
		defaults: { radius: 0.75, detail: 0 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 6, step: 0.05 },
			{ key: 'detail', label: 'Detail', min: 0, max: 4, step: 1, int: true }
		],
		build: (p) => new THREE.DodecahedronGeometry(p.radius as number, p.detail as number),
		code: (p) => `new THREE.DodecahedronGeometry(${f(p.radius as number)}, ${p.detail})`
	},
	tetra: {
		label: 'Tetrahedron',
		icon: ICONS.tetra,
		defaults: { radius: 0.75, detail: 0 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 6, step: 0.05 },
			{ key: 'detail', label: 'Detail', min: 0, max: 4, step: 1, int: true }
		],
		build: (p) => new THREE.TetrahedronGeometry(p.radius as number, p.detail as number),
		code: (p) => `new THREE.TetrahedronGeometry(${f(p.radius as number)}, ${p.detail})`
	},
	torus: {
		label: 'Torus',
		icon: ICONS.torus,
		defaults: { radius: 0.6, tube: 0.25, radialSeg: 8, tubularSeg: 20, arc: 360 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 6, step: 0.05 },
			{ key: 'tube', label: 'Tube', min: 0.02, max: 2, step: 0.02 },
			{ key: 'radialSeg', label: 'Radial segs', min: 3, max: 32, step: 1, int: true },
			{ key: 'tubularSeg', label: 'Tubular segs', min: 3, max: 64, step: 1, int: true },
			{ key: 'arc', label: 'Arc', min: 10, max: 360, step: 5, unit: '°' }
		],
		build: (p) =>
			new THREE.TorusGeometry(
				p.radius as number,
				p.tube as number,
				p.radialSeg as number,
				p.tubularSeg as number,
				((p.arc as number) * Math.PI) / 180
			),
		code: (p) =>
			`new THREE.TorusGeometry(${f(p.radius as number)}, ${f(p.tube as number)}, ${p.radialSeg}, ${p.tubularSeg}, ${degToRadCode(p.arc as number)})`
	},
	torusKnot: {
		label: 'Torus knot',
		icon: ICONS.torusKnot,
		defaults: { radius: 0.5, tube: 0.18, tubularSeg: 64, radialSeg: 8, p: 2, q: 3 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 5, step: 0.05 },
			{ key: 'tube', label: 'Tube', min: 0.02, max: 1.5, step: 0.02 },
			{ key: 'tubularSeg', label: 'Tubular segs', min: 8, max: 200, step: 1, int: true },
			{ key: 'radialSeg', label: 'Radial segs', min: 3, max: 32, step: 1, int: true },
			{ key: 'p', label: 'P (winds)', min: 1, max: 10, step: 1, int: true },
			{ key: 'q', label: 'Q (winds)', min: 1, max: 10, step: 1, int: true }
		],
		build: (p) =>
			new THREE.TorusKnotGeometry(
				p.radius as number,
				p.tube as number,
				p.tubularSeg as number,
				p.radialSeg as number,
				p.p as number,
				p.q as number
			),
		code: (p) =>
			`new THREE.TorusKnotGeometry(${f(p.radius as number)}, ${f(p.tube as number)}, ${p.tubularSeg}, ${p.radialSeg}, ${p.p}, ${p.q})`
	},
	cylinder: {
		label: 'Cylinder',
		icon: ICONS.cylinder,
		defaults: { radiusTop: 0.5, radiusBottom: 0.5, height: 1.2, radialSeg: 8, heightSeg: 1, openEnded: false, thetaStart: 0, thetaLength: 360 },
		fields: [
			{ key: 'radiusTop', label: 'Radius top', min: 0, max: 5, step: 0.05 },
			{ key: 'radiusBottom', label: 'Radius bottom', min: 0, max: 5, step: 0.05 },
			{ key: 'height', label: 'Height', min: 0.05, max: 8, step: 0.05 },
			{ key: 'radialSeg', label: 'Radial segs', min: 3, max: 32, step: 1, int: true },
			{ key: 'heightSeg', label: 'Height segs', min: 1, max: 16, step: 1, int: true },
			{ key: 'openEnded', label: 'Open ended', bool: true },
			...ARC_FIELDS
		],
		build: (p) =>
			new THREE.CylinderGeometry(
				n(p, 'radiusTop'), n(p, 'radiusBottom'), n(p, 'height'),
				n(p, 'radialSeg'), n(p, 'heightSeg'), p.openEnded as boolean,
				rad(p, 'thetaStart'), rad(p, 'thetaLength')
			),
		code: (p) =>
			`new THREE.CylinderGeometry(${f(n(p, 'radiusTop'))}, ${f(n(p, 'radiusBottom'))}, ${f(n(p, 'height'))}, ${p.radialSeg}, ${p.heightSeg}, ${p.openEnded}, ${degToRadCode(n(p, 'thetaStart'))}, ${degToRadCode(n(p, 'thetaLength'))})`
	},
	cone: {
		label: 'Cone',
		icon: ICONS.cone,
		defaults: { radius: 0.6, height: 1.3, radialSeg: 8, heightSeg: 1, openEnded: false, thetaStart: 0, thetaLength: 360 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 5, step: 0.05 },
			{ key: 'height', label: 'Height', min: 0.05, max: 8, step: 0.05 },
			{ key: 'radialSeg', label: 'Radial segs', min: 3, max: 32, step: 1, int: true },
			{ key: 'heightSeg', label: 'Height segs', min: 1, max: 16, step: 1, int: true },
			{ key: 'openEnded', label: 'Open ended', bool: true },
			...ARC_FIELDS
		],
		build: (p) =>
			new THREE.ConeGeometry(
				n(p, 'radius'), n(p, 'height'), n(p, 'radialSeg'), n(p, 'heightSeg'),
				p.openEnded as boolean, rad(p, 'thetaStart'), rad(p, 'thetaLength')
			),
		code: (p) =>
			`new THREE.ConeGeometry(${f(n(p, 'radius'))}, ${f(n(p, 'height'))}, ${p.radialSeg}, ${p.heightSeg}, ${p.openEnded}, ${degToRadCode(n(p, 'thetaStart'))}, ${degToRadCode(n(p, 'thetaLength'))})`
	},
	plane: {
		label: 'Plane',
		icon: ICONS.plane,
		defaults: { width: 1.5, height: 1.5, wSeg: 1, hSeg: 1 },
		fields: [
			{ key: 'width', label: 'Width', min: 0.05, max: 10, step: 0.05 },
			{ key: 'height', label: 'Height', min: 0.05, max: 10, step: 0.05 },
			{ key: 'wSeg', label: 'Width segs', min: 1, max: 32, step: 1, int: true },
			{ key: 'hSeg', label: 'Height segs', min: 1, max: 32, step: 1, int: true }
		],
		build: (p) =>
			new THREE.PlaneGeometry(p.width as number, p.height as number, p.wSeg as number, p.hSeg as number),
		code: (p) =>
			`new THREE.PlaneGeometry(${f(p.width as number)}, ${f(p.height as number)}, ${p.wSeg}, ${p.hSeg})`
	},
	circle: {
		label: 'Disc',
		icon: ICONS.circle,
		defaults: { radius: 0.75, segments: 24, thetaStart: 0, thetaLength: 360 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.05, max: 6, step: 0.05 },
			{ key: 'segments', label: 'Segments', min: 3, max: 64, step: 1, int: true },
			...ARC_FIELDS
		],
		build: (p) =>
			new THREE.CircleGeometry(n(p, 'radius'), n(p, 'segments'), rad(p, 'thetaStart'), rad(p, 'thetaLength')),
		code: (p) =>
			`new THREE.CircleGeometry(${f(n(p, 'radius'))}, ${p.segments}, ${degToRadCode(n(p, 'thetaStart'))}, ${degToRadCode(n(p, 'thetaLength'))})`
	},
	ring: {
		label: 'Ring',
		icon: ICONS.ring,
		// A partial sweep turns this into an arch band or a clock face wedge.
		defaults: { innerRadius: 0.35, outerRadius: 0.75, thetaSegments: 24, phiSegments: 1, thetaStart: 0, thetaLength: 360 },
		fields: [
			{ key: 'innerRadius', label: 'Inner radius', min: 0, max: 6, step: 0.05 },
			{ key: 'outerRadius', label: 'Outer radius', min: 0.05, max: 6, step: 0.05 },
			{ key: 'thetaSegments', label: 'Segments', min: 3, max: 64, step: 1, int: true },
			{ key: 'phiSegments', label: 'Radial segs', min: 1, max: 16, step: 1, int: true },
			...ARC_FIELDS
		],
		build: (p) =>
			new THREE.RingGeometry(
				n(p, 'innerRadius'), n(p, 'outerRadius'), n(p, 'thetaSegments'), n(p, 'phiSegments'),
				rad(p, 'thetaStart'), rad(p, 'thetaLength')
			),
		code: (p) =>
			`new THREE.RingGeometry(${f(n(p, 'innerRadius'))}, ${f(n(p, 'outerRadius'))}, ${p.thetaSegments}, ${p.phiSegments}, ${degToRadCode(n(p, 'thetaStart'))}, ${degToRadCode(n(p, 'thetaLength'))})`
	},
	capsule: {
		label: 'Capsule',
		icon: ICONS.capsule,
		defaults: { radius: 0.35, height: 0.8, capSegments: 6, radialSegments: 12, heightSegments: 1 },
		fields: [
			{ key: 'radius', label: 'Radius', min: 0.02, max: 4, step: 0.05 },
			{ key: 'height', label: 'Body height', min: 0, max: 8, step: 0.05 },
			{ key: 'capSegments', label: 'Cap segs', min: 1, max: 24, step: 1, int: true },
			{ key: 'radialSegments', label: 'Radial segs', min: 3, max: 48, step: 1, int: true },
			{ key: 'heightSegments', label: 'Height segs', min: 1, max: 16, step: 1, int: true }
		],
		build: (p) =>
			new THREE.CapsuleGeometry(
				n(p, 'radius'), n(p, 'height'), n(p, 'capSegments'), n(p, 'radialSegments'), n(p, 'heightSegments')
			),
		code: (p) =>
			`new THREE.CapsuleGeometry(${f(n(p, 'radius'))}, ${f(n(p, 'height'))}, ${p.capSegments}, ${p.radialSegments}, ${p.heightSegments})`
	},
	lathe: {
		label: 'Lathe',
		icon: ICONS.lathe,
		profile: true,
		profileKind: 'lathe',
		// The outline is revolved around Y, so a partial sweep leaves a cutaway —
		// useful for showing a vessel's inside, or for half a column against a wall.
		defaults: { profile: defaultProfile(), segments: 16, curveSegments: 12, phiStart: 0, phiLength: 360 },
		fields: [
			{ key: 'segments', label: 'Revolve segs', min: 3, max: 64, step: 1, int: true },
			{ key: 'curveSegments', label: 'Curve detail', min: 2, max: 32, step: 1, int: true },
			{ key: 'phiStart', label: 'Sweep start', min: 0, max: 360, step: 1, unit: '°' },
			{ key: 'phiLength', label: 'Sweep', min: 1, max: 360, step: 1, unit: '°' }
		],
		build: (p) =>
			new THREE.LatheGeometry(
				profileToPoints(prof(p), n(p, 'curveSegments')).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y)),
				n(p, 'segments'),
				rad(p, 'phiStart'),
				rad(p, 'phiLength')
			),
		code: (p) => {
			const pts = profileToPoints(prof(p), n(p, 'curveSegments'))
				.map((v) => `new THREE.Vector2(${f(Math.max(0, v.x))}, ${f(v.y)})`)
				.join(', ');
			return `new THREE.LatheGeometry([${pts}], ${p.segments}, ${degToRadCode(n(p, 'phiStart'))}, ${degToRadCode(n(p, 'phiLength'))})`;
		}
	},
	extrude: {
		label: 'Extrude',
		icon: ICONS.extrude,
		profile: true,
		profileKind: 'shape',
		defaults: {
			profile: defaultShapeProfile(),
			depth: 0.35,
			steps: 1,
			bevelEnabled: true,
			bevelThickness: 0.04,
			bevelSize: 0.04,
			bevelSegments: 1,
			curveSegments: 8
		},
		fields: [
			{ key: 'depth', label: 'Depth', min: 0.02, max: 4, step: 0.02 },
			{ key: 'steps', label: 'Steps', min: 1, max: 12, step: 1, int: true },
			{ key: 'bevelEnabled', label: 'Bevel', bool: true },
			{ key: 'bevelThickness', label: 'Bevel thick', min: 0, max: 0.4, step: 0.01 },
			{ key: 'bevelSize', label: 'Bevel size', min: 0, max: 0.4, step: 0.01 },
			{ key: 'bevelSegments', label: 'Bevel segs', min: 1, max: 8, step: 1, int: true },
			{ key: 'curveSegments', label: 'Curve detail', min: 2, max: 32, step: 1, int: true }
		],
		build: (p) =>
			new THREE.ExtrudeGeometry(profileToShape(shapeProf(p)), {
				depth: n(p, 'depth'),
				steps: n(p, 'steps'),
				bevelEnabled: !!p.bevelEnabled,
				bevelThickness: n(p, 'bevelThickness'),
				bevelSize: n(p, 'bevelSize'),
				bevelSegments: n(p, 'bevelSegments'),
				curveSegments: n(p, 'curveSegments')
			}),
		code: (p) =>
			`new THREE.ExtrudeGeometry(${emitShapeConstructor(shapeProf(p))}, { depth: ${f(n(p, 'depth'))}, steps: ${p.steps}, bevelEnabled: ${!!p.bevelEnabled}, bevelThickness: ${f(n(p, 'bevelThickness'))}, bevelSize: ${f(n(p, 'bevelSize'))}, bevelSegments: ${p.bevelSegments}, curveSegments: ${p.curveSegments} })`
	}
};

export const PRIMITIVE_TYPES = Object.keys(GEO_DEFS) as PrimitiveType[];

export function defaultGroundY(type: PrimitiveType) {
	// A lathe profile is authored upward from y = 0, so it already sits on the
	// grid — lifting it would float the object.
	if (type === 'lathe' || type === 'extrude') return 0;
	const def = GEO_DEFS[type].defaults;
	if ('height' in def && typeof def.height === 'number') return def.height / 2;
	if ('radius' in def && typeof def.radius === 'number') return def.radius * 0.75;
	return 0.6;
}
