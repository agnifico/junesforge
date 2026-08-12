<script lang="ts">
	/**
	 * The gallery's single live preview. Exactly one of these exists, and only
	 * while a model is selected — every other tile in the grid is a static
	 * thumbnail image. That keeps us to one extra WebGL context no matter how
	 * many models the folder holds.
	 *
	 * Orbit and zoom only: panning is disabled so the model can't be dragged
	 * out of frame in a viewport this small.
	 */
	import { onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { SimpleOrbitControls } from '$lib/propsize/core/orbit-controls';
	import { importModel } from '$lib/propsize/import/loaders';
	import { disposeTree } from '$lib/propsize/core/three-utils';
	import { libraryStore } from '$lib/propsize/library/library-store.svelte';
	import type { LibraryEntry } from '$lib/propsize/library/fs';

	let { entry }: { entry: LibraryEntry } = $props();

	let holder = $state<HTMLDivElement | null>(null);
	let status = $state<'loading' | 'ready' | 'error'>('loading');

	let renderer: THREE.WebGLRenderer | null = null;
	let controls: SimpleOrbitControls | null = null;
	let model: THREE.Object3D | null = null;
	let raf = 0;
	let token = 0;

	function teardown() {
		token++;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		controls?.dispose();
		controls = null;
		if (model) {
			disposeTree(model);
			model = null;
		}
		renderer?.dispose();
		if (renderer?.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
		renderer = null;
	}

	// Rebuilds whenever the selected entry changes; teardown runs first so we
	// never hold two contexts at once.
	$effect(() => {
		const current = entry;
		const el = holder;
		if (!el) return;
		teardown();
		const mine = ++token;
		status = 'loading';

		let cancelled = false;
		(async () => {
			try {
				const file = await libraryStore.library.read(current);
				const result = await importModel(file, libraryStore.library.siblingResolver(current));
				if (cancelled || mine !== token) {
					disposeTree(result.object);
					return;
				}

				const scene = new THREE.Scene();
				scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
				const key = new THREE.DirectionalLight(0xffffff, 1.5);
				key.position.set(3, 5, 4);
				scene.add(key);

				model = result.object;
				scene.add(model);

				const box = new THREE.Box3().setFromObject(model);
				const sphere = box.getBoundingSphere(new THREE.Sphere());
				const radius = sphere.radius || 1;

				const w = el.clientWidth || 240;
				const h = el.clientHeight || 160;
				const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 1000);
				camera.position.copy(sphere.center).add(new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(radius * 2.6));

				renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
				renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
				renderer.setSize(w, h);
				renderer.outputColorSpace = THREE.SRGBColorSpace;
				el.appendChild(renderer.domElement);

				controls = new SimpleOrbitControls(camera, renderer.domElement, undefined, { allowPan: false });
				controls.target.copy(sphere.center);
				controls.minDistance = radius * 1.2;
				controls.maxDistance = radius * 8;

				status = 'ready';
				const tick = () => {
					if (mine !== token) return;
					controls?.update();
					renderer?.render(scene, camera);
					raf = requestAnimationFrame(tick);
				};
				tick();
			} catch (e) {
				console.warn('Propsize: preview failed', current.path, e);
				if (!cancelled && mine === token) status = 'error';
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	onDestroy(teardown);
</script>

<div class="lib-preview">
	<div class="lib-preview-canvas" bind:this={holder}></div>
	{#if status !== 'ready'}
		<div class="lib-preview-status">
			{status === 'loading' ? 'Loading preview…' : 'No preview available'}
		</div>
	{/if}
	<div class="lib-preview-caption">{entry.name}<span>drag to orbit · scroll to zoom</span></div>
</div>
