import * as THREE from 'three';
import type { MaterialSpec, TextureSpec } from './types';

export function defaultMaterial(colorHex = '#96897c'): MaterialSpec {
	return {
		color: colorHex,
		roughness: 0.85,
		metalness: 0.04,
		flatShading: true,
		wireframe: false,
		transparent: false,
		opacity: 1,
		emissive: '#000000',
		emissiveIntensity: 0,
		side: 'front',
		texture: {
			type: 'none',
			colorA: null,
			colorB: null,
			tiles: 8,
			repeatX: 1,
			repeatY: 1,
			assetId: null
		}
	};
}

export function defaultTexture(): TextureSpec {
	return {
		type: 'none',
		colorA: null,
		colorB: null,
		tiles: 8,
		repeatX: 1,
		repeatY: 1,
		assetId: null
	};
}

export function shadeColor(hex: string, amt: number) {
	const c = new THREE.Color(hex);
	const h = { h: 0, s: 0, l: 0 };
	c.getHSL(h);
	c.setHSL(h.h, h.s, Math.max(0, Math.min(1, h.l + amt)));
	return '#' + c.getHexString();
}

function makeCheckerTexture(colorA: string, colorB: string, tiles: number) {
	const size = 256;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const cell = size / tiles;
	for (let y = 0; y < tiles; y++)
		for (let x = 0; x < tiles; x++) {
			ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
			ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
		}
	return new THREE.CanvasTexture(canvas);
}

function makeStripeTexture(colorA: string, colorB: string, tiles: number) {
	const size = 256;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const cell = size / tiles;
	ctx.fillStyle = colorA;
	ctx.fillRect(0, 0, size, size);
	ctx.fillStyle = colorB;
	for (let x = 0; x < tiles; x += 2) ctx.fillRect(x * cell, 0, cell, size);
	return new THREE.CanvasTexture(canvas);
}

function makeSpeckleTexture(colorA: string, colorB: string, density: number) {
	const size = 256;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = colorA;
	ctx.fillRect(0, 0, size, size);
	const n = Math.round(60 + density * 40);
	for (let i = 0; i < n; i++) {
		const x = Math.random() * size;
		const y = Math.random() * size;
		const r = 1 + Math.random() * 3.2;
		ctx.globalAlpha = 0.35 + Math.random() * 0.55;
		ctx.fillStyle = colorB;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	return new THREE.CanvasTexture(canvas);
}

export type TextureResolver = (assetId: string) => string | null;

export function buildTexture(material: MaterialSpec, resolveAsset?: TextureResolver) {
	const t = material.texture;
	if (!t || t.type === 'none') return null;
	let tex: THREE.Texture | null = null;
	const colorA = t.colorA || material.color;
	const colorB = t.colorB || shadeColor(material.color, -0.22);
	if (t.type === 'checker') tex = makeCheckerTexture(colorA, colorB, t.tiles);
	else if (t.type === 'stripes') tex = makeStripeTexture(colorA, colorB, t.tiles);
	else if (t.type === 'speckle') tex = makeSpeckleTexture(colorA, colorB, t.tiles);
	else if (t.type === 'image' && t.assetId && resolveAsset) {
		const url = resolveAsset(t.assetId);
		if (url) tex = new THREE.TextureLoader().load(url, (tx) => { tx.needsUpdate = true; });
	}
	if (tex) {
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(t.repeatX, t.repeatY);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
	}
	return tex;
}

export function buildThreeMaterial(
	material: MaterialSpec,
	wireAll: boolean,
	resolveAsset?: TextureResolver
) {
	const mat = new THREE.MeshStandardMaterial({
		color: new THREE.Color(material.color),
		roughness: material.roughness,
		metalness: material.metalness,
		flatShading: material.flatShading,
		wireframe: material.wireframe || wireAll,
		transparent: material.transparent,
		opacity: material.opacity,
		emissive: new THREE.Color(material.emissive),
		emissiveIntensity: material.emissiveIntensity,
		side:
			material.side === 'double'
				? THREE.DoubleSide
				: material.side === 'back'
					? THREE.BackSide
					: THREE.FrontSide
	});
	mat.map = buildTexture(material, resolveAsset);
	(mat as THREE.MeshStandardMaterial & { _texSig?: string })._texSig =
		JSON.stringify(material.texture) + material.color;
	return mat;
}

export function updateMaterialInPlace(
	mat: THREE.MeshStandardMaterial,
	material: MaterialSpec,
	wireAll: boolean,
	resolveAsset?: TextureResolver
) {
	mat.color.set(material.color);
	mat.roughness = material.roughness;
	mat.metalness = material.metalness;
	mat.flatShading = material.flatShading;
	mat.wireframe = material.wireframe || wireAll;
	mat.transparent = material.transparent;
	mat.opacity = material.opacity;
	mat.emissive.set(material.emissive);
	mat.emissiveIntensity = material.emissiveIntensity;
	mat.side =
		material.side === 'double'
			? THREE.DoubleSide
			: material.side === 'back'
				? THREE.BackSide
				: THREE.FrontSide;
	const sig = JSON.stringify(material.texture) + material.color;
	const tagged = mat as THREE.MeshStandardMaterial & { _texSig?: string };
	if (sig !== tagged._texSig) {
		if (mat.map) mat.map.dispose();
		mat.map = buildTexture(material, resolveAsset);
		tagged._texSig = sig;
	}
	mat.needsUpdate = true;
}
