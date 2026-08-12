/**
 * Minimal self-contained orbit/pan/zoom controls â no external deps, ported
 * from the prototype as-is. `onPointerDownExtra` lets the gizmo claim a
 * left-button press before it's interpreted as an orbit drag.
 */
import * as THREE from 'three';

export class SimpleOrbitControls {
	camera: THREE.PerspectiveCamera;
	dom: HTMLElement;
	target = new THREE.Vector3(0, 0, 0);
	minDistance = 1.2;
	maxDistance = 80;
	spherical = new THREE.Spherical();

	#rotating = false;
	#panning = false;
	#px = 0;
	#py = 0;
	#onPointerDownExtra?: (e: PointerEvent) => boolean;
	#allowPan: boolean;

	constructor(
		camera: THREE.PerspectiveCamera,
		dom: HTMLElement,
		onPointerDownExtra?: (e: PointerEvent) => boolean,
		opts?: { allowPan?: boolean }
	) {
		this.camera = camera;
		this.dom = dom;
		this.#onPointerDownExtra = onPointerDownExtra;
		this.#allowPan = opts?.allowPan !== false;
		const offset = new THREE.Vector3().copy(camera.position).sub(this.target);
		this.spherical.setFromVector3(offset);

		dom.style.touchAction = 'none';
		dom.addEventListener('contextmenu', this.#onContextMenu);
		dom.addEventListener('pointerdown', this.#onPointerDown);
		window.addEventListener('pointerup', this.#onPointerUp);
		dom.addEventListener('pointermove', this.#onPointerMove);
		dom.addEventListener('wheel', this.#onWheel, { passive: false });
	}

	#onContextMenu = (e: Event) => e.preventDefault();

	#onPointerDown = (e: PointerEvent) => {
		if (e.button === 0 && this.#onPointerDownExtra?.(e)) return; // gizmo drag wins
		if (e.button === 0) this.#rotating = true;
		else if ((e.button === 2 || e.button === 1) && this.#allowPan) this.#panning = true;
		this.#px = e.clientX;
		this.#py = e.clientY;
		this.dom.setPointerCapture(e.pointerId);
	};

	#onPointerUp = () => {
		this.#rotating = false;
		this.#panning = false;
	};

	#onPointerMove = (e: PointerEvent) => {
		const dx = e.clientX - this.#px;
		const dy = e.clientY - this.#py;
		this.#px = e.clientX;
		this.#py = e.clientY;
		if (this.#rotating) {
			this.spherical.theta -= dx * 0.0055;
			this.spherical.phi -= dy * 0.0055;
			this.spherical.phi = Math.max(0.06, Math.min(Math.PI - 0.06, this.spherical.phi));
		} else if (this.#panning) {
			const panX = -dx * 0.0022 * this.spherical.radius;
			const panY = dy * 0.0022 * this.spherical.radius;
			const te = this.camera.matrix.elements;
			const xAxis = new THREE.Vector3(te[0], te[1], te[2]);
			const yAxis = new THREE.Vector3(te[4], te[5], te[6]);
			this.target.addScaledVector(xAxis, panX).addScaledVector(yAxis, panY);
		}
	};

	#onWheel = (e: WheelEvent) => {
		e.preventDefault();
		const scale = Math.pow(0.95, e.deltaY * 0.012);
		this.spherical.radius = Math.max(
			this.minDistance,
			Math.min(this.maxDistance, this.spherical.radius / scale)
		);
	};

	update() {
		const off = new THREE.Vector3().setFromSpherical(this.spherical);
		this.camera.position.copy(this.target).add(off);
		this.camera.lookAt(this.target);
	}

	dispose() {
		this.dom.removeEventListener('contextmenu', this.#onContextMenu);
		this.dom.removeEventListener('pointerdown', this.#onPointerDown);
		window.removeEventListener('pointerup', this.#onPointerUp);
		this.dom.removeEventListener('pointermove', this.#onPointerMove);
		this.dom.removeEventListener('wheel', this.#onWheel);
	}
}
