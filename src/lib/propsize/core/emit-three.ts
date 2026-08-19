/**
 * three.js code emitter — walks the document tree and produces a standalone
 * `createX()` function a user can paste into their own project. Ported from
 * the prototype's generateThreeCode(), adapted to the new document model
 * (shared materials keyed by materialId, instead of one inline object per
 * mesh).
 *
 * Imported (GLB/OBJ) nodes aren't code-generatable the same way a primitive
 * is — the geometry lives in an external file, not in a THREE.*Geometry
 * constructor call — so they emit a loader stub with a TODO comment instead
 * of silently vanishing from the output.
 */
import { GEO_DEFS } from './geometry';
import { shadeColor } from './materials';
import { degToRadCode, f } from './utils';
import { isGroup, isPrimitive, isImported } from './types';
import type { SceneNode, MaterialSpec, TextureSpec } from './types';
import { docStore } from './document.svelte';

function usedTextureHelpers(nodeIds: string[]): Set<TextureSpec['type']> {
	const helpers = new Set<TextureSpec['type']>();
	const allIds = nodeIds.concat(nodeIds.flatMap((id) => docStore.descendants(id).map((n) => n.id)));
	for (const id of allIds) {
		const n = docStore.node(id);
		if (!n || !isPrimitive(n)) continue;
		const tex = docStore.doc.materials[n.materialId]?.texture;
		if (tex && tex.type !== 'none' && tex.type !== 'image') helpers.add(tex.type);
	}
	return helpers;
}

const TEXTURE_HELPER_SRC: Record<string, string> = {
	checker: `function makeCheckerTexture(colorA, colorB, tiles) {
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cell = size / tiles;
  for (let y = 0; y < tiles; y++) for (let x = 0; x < tiles; x++) {
    ctx.fillStyle = ((x + y) % 2 === 0) ? colorA : colorB;
    ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}`,
	stripes: `function makeStripeTexture(colorA, colorB, tiles) {
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cell = size / tiles;
  ctx.fillStyle = colorA; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = colorB;
  for (let x = 0; x < tiles; x += 2) ctx.fillRect(x * cell, 0, cell, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}`,
	speckle: `function makeSpeckleTexture(colorA, colorB, density) {
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorA; ctx.fillRect(0, 0, size, size);
  const n = Math.round(60 + density * 40);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 1 + Math.random() * 3.2;
    ctx.globalAlpha = 0.35 + Math.random() * 0.55;
    ctx.fillStyle = colorB;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}`
};

function toVarName(name: string, used: Set<string>): string {
	let base = (name || 'obj')
		.replace(/[^a-zA-Z0-9]+/g, ' ')
		.trim()
		.split(' ')
		.map((w, i) => (w ? (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)) : ''))
		.join('');
	if (!base) base = 'obj';
	if (!/^[a-zA-Z_]/.test(base)) base = 'o' + base;
	let out = base,
		n = 2;
	while (used.has(out)) {
		out = base + n;
		n++;
	}
	used.add(out);
	return out;
}

function emitTransformLines(node: SceneNode, varName: string, ind: string, lines: string[]) {
	const t = node.transform,
		D = 1e-4;
	if (Math.abs(t.position.x) > D || Math.abs(t.position.y) > D || Math.abs(t.position.z) > D)
		lines.push(`${ind}${varName}.position.set(${f(t.position.x)}, ${f(t.position.y)}, ${f(t.position.z)});`);
	if (Math.abs(t.rotation.x) > D || Math.abs(t.rotation.y) > D || Math.abs(t.rotation.z) > D)
		lines.push(
			`${ind}${varName}.rotation.set(${degToRadCode(t.rotation.x)}, ${degToRadCode(t.rotation.y)}, ${degToRadCode(t.rotation.z)});`
		);
	if (Math.abs(t.scale.x - 1) > D || Math.abs(t.scale.y - 1) > D || Math.abs(t.scale.z - 1) > D)
		lines.push(`${ind}${varName}.scale.set(${f(t.scale.x)}, ${f(t.scale.y)}, ${f(t.scale.z)});`);
}

function materialObjectLiteral(m: MaterialSpec, ind: string): string {
	const parts = [
		`color: ${'0x' + m.color.replace('#', '').toUpperCase()}`,
		`roughness: ${f(m.roughness)}`,
		`metalness: ${f(m.metalness)}`,
		`flatShading: ${m.flatShading}`
	];
	if (m.wireframe) parts.push(`wireframe: true`);
	if (m.transparent) {
		parts.push(`transparent: true`);
		parts.push(`opacity: ${f(m.opacity)}`);
	}
	if (m.emissiveIntensity > 0) {
		parts.push(`emissive: ${'0x' + m.emissive.replace('#', '').toUpperCase()}`);
		parts.push(`emissiveIntensity: ${f(m.emissiveIntensity)}`);
	}
	if (m.side !== 'front') parts.push(`side: THREE.${m.side === 'double' ? 'DoubleSide' : 'BackSide'}`);
	return `{\n${ind}  ${parts.join(`,\n${ind}  `)}\n${ind}}`;
}

function genNodeCode(node: SceneNode, parentVar: string, used: Set<string>, lines: string[], depth: number) {
	const ind = '  '.repeat(depth);
	const varName = toVarName(node.name, used);

	if (isGroup(node)) {
		lines.push(`${ind}const ${varName} = new THREE.Group();`);
		lines.push(`${ind}${varName}.name = ${JSON.stringify(node.name)};`);
		emitTransformLines(node, varName, ind, lines);
		lines.push(`${ind}${parentVar}.add(${varName});`);
		lines.push('');
		docStore.children(node.id).forEach((child) => genNodeCode(child, varName, used, lines, depth));
		return;
	}

	if (isImported(node)) {
		const partNote = node.part ? `, part "${node.part.name}"` : '';
		lines.push(`${ind}// TODO: "${node.name}" is an imported model (${node.assetId}${partNote}).`);
		lines.push(`${ind}// Propsize doesn't inline external model bytes into generated code —`);
		lines.push(`${ind}// load it the way you load the rest of your assets, then apply:`);
		const varName2 = varName + 'Group';
		lines.push(`${ind}const ${varName2} = new THREE.Group(); // replace with your loaded model`);
		lines.push(`${ind}${varName2}.name = ${JSON.stringify(node.name)};`);
		emitTransformLines(node, varName2, ind, lines);
		lines.push(`${ind}${parentVar}.add(${varName2});`);
		lines.push('');
		return;
	}

	const gdef = GEO_DEFS[node.type];
	const material = docStore.doc.materials[node.materialId];
	lines.push(`${ind}const ${varName}Geo = ${gdef.code(node.geometry)};`);
	lines.push(`${ind}const ${varName}Mat = new THREE.MeshStandardMaterial(${materialObjectLiteral(material, ind)});`);
	const tex = material.texture;
	if (tex.type === 'checker' || tex.type === 'stripes' || tex.type === 'speckle') {
		const fn = tex.type === 'checker' ? 'makeCheckerTexture' : tex.type === 'stripes' ? 'makeStripeTexture' : 'makeSpeckleTexture';
		const colorA = tex.colorA || material.color;
		const colorB = tex.colorB || shadeColor(material.color, -0.22);
		lines.push(`${ind}${varName}Mat.map = ${fn}(${JSON.stringify(colorA)}, ${JSON.stringify(colorB)}, ${tex.tiles});`);
		lines.push(`${ind}${varName}Mat.map.repeat.set(${f(tex.repeatX)}, ${f(tex.repeatY)});`);
		lines.push(`${ind}${varName}Mat.map.wrapS = ${varName}Mat.map.wrapT = THREE.RepeatWrapping;`);
	}
	lines.push(`${ind}const ${varName} = new THREE.Mesh(${varName}Geo, ${varName}Mat);`);
	lines.push(`${ind}${varName}.name = ${JSON.stringify(node.name)};`);
	emitTransformLines(node, varName, ind, lines);
	lines.push(`${ind}${varName}.castShadow = ${node.castShadow};`);
	lines.push(`${ind}${varName}.receiveShadow = ${node.receiveShadow};`);
	lines.push(`${ind}${parentVar}.add(${varName});`);
	lines.push('');
}

export function generateThreeCode(exportName: string): string {
	const roots = docStore.children(null);
	const used = new Set(['g', 'g0']);
	const helperTypes = usedTextureHelpers(roots.map((r) => r.id));
	const lines: string[] = [];
	lines.push(`// Generated by Propsize — assumes THREE is already imported in this file`);
	if (helperTypes.size) {
		lines.push('');
		helperTypes.forEach((t) => {
			lines.push(TEXTURE_HELPER_SRC[t]);
			lines.push('');
		});
	}
	lines.push(`export function create${exportName}() {`);
	lines.push(`  const g = new THREE.Group();`);
	lines.push(`  g.name = ${JSON.stringify(exportName)};`);
	lines.push('');
	if (!roots.length) {
		lines.push(`  // (empty scene — add some objects in Propsize first)`);
	} else {
		roots.forEach((r) => genNodeCode(r, 'g', used, lines, 1));
	}
	lines.push(`  return g;`);
	lines.push(`}`);
	return lines.join('\n');
}
