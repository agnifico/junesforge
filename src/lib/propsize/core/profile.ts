/**
 * Profile maths for the lathe (and, later, shape/extrude — they consume the
 * same outline).
 *
 * A lathe profile is a silhouette in the XY half-plane that three.js revolves
 * around the Y axis: x is the radius at that height, y is the height. Two
 * consequences shape everything here. x must never go negative, or the surface
 * turns inside out; and a profile whose ends don't touch the axis produces an
 * open shell — a bottomless vase you can see straight through. Both are worth
 * catching in the editor rather than leaving to be discovered.
 */

import * as THREE from 'three';
import type { Profile, ProfileSegment, Vec2 } from './types';
import { round3 } from './utils';

export const v2 = (x: number, y: number): Vec2 => ({ x: round3(x), y: round3(y) });

/** Every on-curve point, start included — what the editor puts handles on. */
export function anchors(profile: Profile): Vec2[] {
	return [profile.start, ...profile.segments.map((s) => s.to)];
}

// Anchor n is reached by segment n-1, so anchor 0 is the profile's `start` and
// has no incoming segment. Every index shuffle below hangs off that mapping.

/** Move one anchor, then re-derive any handles it or its neighbours rely on. */
export function moveAnchor(profile: Profile, index: number, to: Vec2): Profile {
	let next: Profile;
	if (index === 0) {
		next = { ...profile, start: to };
	} else {
		const segments = [...profile.segments];
		if (!segments[index - 1]) return profile;
		segments[index - 1] = { ...segments[index - 1], to };
		next = { ...profile, segments };
	}
	return reflowSmoothness(next, index);
}

/**
 * Turn the outline into a three.js curve path. Shape/extrude will hand this
 * straight to THREE.Shape; lathe samples it.
 */
export function toCurvePath(profile: Profile): THREE.CurvePath<THREE.Vector2> {
	const path = new THREE.CurvePath<THREE.Vector2>();
	let cur = new THREE.Vector2(profile.start.x, profile.start.y);
	for (const seg of profile.segments) {
		const to = new THREE.Vector2(seg.to.x, seg.to.y);
		if (seg.type === 'line') {
			path.add(new THREE.LineCurve(cur.clone(), to.clone()));
		} else if (seg.type === 'quad') {
			path.add(
				new THREE.QuadraticBezierCurve(cur.clone(), new THREE.Vector2(seg.ctrl.x, seg.ctrl.y), to.clone())
			);
		} else {
			path.add(
				new THREE.CubicBezierCurve(
					cur.clone(),
					new THREE.Vector2(seg.c1.x, seg.c1.y),
					new THREE.Vector2(seg.c2.x, seg.c2.y),
					to.clone()
				)
			);
		}
		cur = to;
	}
	return path;
}

/**
 * Flatten to the point list LatheGeometry wants. Straight runs contribute
 * their endpoints only — subdividing a line costs triangles and buys nothing —
 * while curved segments get `curveSegments` samples each.
 */
export function profileToPoints(profile: Profile, curveSegments = 12): THREE.Vector2[] {
	const out: THREE.Vector2[] = [new THREE.Vector2(profile.start.x, profile.start.y)];
	let cur = new THREE.Vector2(profile.start.x, profile.start.y);
	for (const seg of profile.segments) {
		const to = new THREE.Vector2(seg.to.x, seg.to.y);
		if (seg.type === 'line') {
			out.push(to.clone());
		} else {
			const curve =
				seg.type === 'quad'
					? new THREE.QuadraticBezierCurve(cur.clone(), new THREE.Vector2(seg.ctrl.x, seg.ctrl.y), to.clone())
					: new THREE.CubicBezierCurve(
							cur.clone(),
							new THREE.Vector2(seg.c1.x, seg.c1.y),
							new THREE.Vector2(seg.c2.x, seg.c2.y),
							to.clone()
						);
			const pts = curve.getPoints(Math.max(2, Math.round(curveSegments)));
			out.push(...pts.slice(1));
		}
		cur = to;
	}
	// A negative radius folds the surface through the axis; clamp rather than
	// render something inside out.
	return out.map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
}

/**
 * Give an anchor smooth tangents by converting the segments either side into
 * cubics, with control points from the Catmull-Rom construction: the handle
 * length is a sixth of the span between an anchor's neighbours, which is the
 * standard conversion and what "smooth" means in any pen tool.
 *
 * The handles are written into the document rather than derived at build time,
 * so a later pen tool edits exactly what's stored.
 */
export function setAnchorSmooth(profile: Profile, index: number, smooth: boolean): Profile {
	const pts = anchors(profile);
	if (index < 0 || index >= pts.length) return profile;
	const segments = profile.segments.map((s) => ({ ...s }) as ProfileSegment);

	const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
	const incoming = index - 1; // segment ending at `index`
	const outgoing = index; // segment starting at `index`

	if (!smooth) {
		if (segments[incoming]) segments[incoming] = { type: 'line', to: pts[index] };
		if (segments[outgoing]) segments[outgoing] = { type: 'line', to: segments[outgoing].to };
		return { ...profile, segments };
	}

	// Tangent through this anchor, from its neighbours.
	const prev = at(index - 1);
	const next = at(index + 1);
	const tangent = { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 };
	const here = pts[index];

	if (segments[incoming]) {
		const from = pts[index - 1];
		const prevPrev = at(index - 2);
		const inTangent = { x: (here.x - prevPrev.x) / 6, y: (here.y - prevPrev.y) / 6 };
		segments[incoming] = {
			type: 'cubic',
			c1: v2(from.x + inTangent.x, from.y + inTangent.y),
			c2: v2(here.x - tangent.x, here.y - tangent.y),
			to: here
		};
	}
	if (segments[outgoing]) {
		const to = pts[index + 1];
		const nextNext = at(index + 2);
		const outTangent = { x: (nextNext.x - here.x) / 6, y: (nextNext.y - here.y) / 6 };
		segments[outgoing] = {
			type: 'cubic',
			c1: v2(here.x + tangent.x, here.y + tangent.y),
			c2: v2(to.x - outTangent.x, to.y - outTangent.y),
			to
		};
	}
	return { ...profile, segments };
}

/** Whether an anchor currently carries curve handles. */
export function isAnchorSmooth(profile: Profile, index: number): boolean {
	const incoming = profile.segments[index - 1];
	const outgoing = profile.segments[index];
	return (incoming?.type ?? 'line') !== 'line' || (outgoing?.type ?? 'line') !== 'line';
}

/** Recompute handles around an anchor that moved, so smoothness survives a drag. */
export function reflowSmoothness(profile: Profile, index: number): Profile {
	let out = profile;
	for (const i of [index - 1, index, index + 1]) {
		if (i >= 0 && i < anchors(profile).length && isAnchorSmooth(profile, i)) {
			out = setAnchorSmooth(out, i, true);
		}
	}
	return out;
}

/** Split the segment leaving `afterIndex`, putting a new anchor partway along
 *  it. Past the last anchor there's nothing to split, so it appends instead. */
export function insertAnchor(profile: Profile, afterIndex: number, at: Vec2): Profile {
	const segments = [...profile.segments];
	const split = segments[afterIndex];
	if (!split) segments.push({ type: 'line', to: at });
	else segments.splice(afterIndex, 1, { type: 'line', to: at }, { type: 'line', to: split.to });
	return { ...profile, segments };
}

export function removeAnchor(profile: Profile, index: number): Profile {
	if (anchors(profile).length <= 2) return profile; // a profile needs at least a line
	if (index === 0) {
		const [first, ...rest] = profile.segments;
		return { ...profile, start: first.to, segments: rest };
	}
	// Drop the segment arriving at this anchor; the one after it now starts
	// from the previous anchor and keeps its own endpoint.
	const segments = [...profile.segments];
	segments.splice(index - 1, 1);
	return { ...profile, segments };
}

export function profileBounds(profile: Profile) {
	const pts = profileToPoints(profile, 12);
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (const p of pts) {
		minX = Math.min(minX, p.x);
		maxX = Math.max(maxX, p.x);
		minY = Math.min(minY, p.y);
		maxY = Math.max(maxY, p.y);
	}
	return { minX, maxX, minY, maxY };
}

/** True when the outline doesn't meet the axis at both ends, which leaves the
 *  revolved surface open at top and/or bottom. */
export function openEnds(profile: Profile) {
	const pts = anchors(profile);
	return { bottom: (pts[0]?.x ?? 0) > 1e-4, top: (pts[pts.length - 1]?.x ?? 0) > 1e-4 };
}

const line = (x: number, y: number): ProfileSegment => ({ type: 'line', to: v2(x, y) });

/**
 * Starting shapes. A lathe is hard to picture from an empty canvas, so the
 * tray drops in a recognisable turned object and presets swap between a few
 * more — every one of them a real prop in a medieval set.
 */
export const PROFILE_PRESETS: { id: string; label: string; make: () => Profile }[] = [
	{
		id: 'goblet',
		label: 'Goblet',
		make: () => ({
			start: v2(0, 0),
			segments: [line(0.34, 0), line(0.34, 0.06), line(0.08, 0.12), line(0.08, 0.5), line(0.4, 0.72), line(0.44, 1.1), line(0.4, 1.12), line(0, 1.12)]
		})
	},
	{
		id: 'vase',
		label: 'Vase',
		make: () => ({
			start: v2(0, 0),
			segments: [line(0.3, 0), line(0.46, 0.34), line(0.34, 0.78), line(0.44, 1.0), line(0.4, 1.06), line(0, 1.06)]
		})
	},
	{
		id: 'column',
		label: 'Column',
		make: () => ({
			start: v2(0, 0),
			segments: [line(0.5, 0), line(0.5, 0.1), line(0.36, 0.18), line(0.32, 1.5), line(0.44, 1.6), line(0.52, 1.7), line(0.52, 1.8), line(0, 1.8)]
		})
	},
	{
		id: 'bell',
		label: 'Bell',
		make: () => ({
			start: v2(0, 0),
			segments: [line(0.5, 0), line(0.46, 0.1), line(0.3, 0.34), line(0.22, 0.62), line(0.22, 0.76), line(0.1, 0.8), line(0.1, 0.92), line(0, 0.94)]
		})
	}
];

export function defaultProfile(): Profile {
	return PROFILE_PRESETS[0].make();
}
