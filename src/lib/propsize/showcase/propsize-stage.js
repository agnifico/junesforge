// @ts-nocheck — vendored as plain JS (shared with the standalone showcase build);
// kept loose rather than annotated to strict-TS standards.
// <propsize-stage> — a lightweight live viewer for Propsize documents.
// All stages on the page share ONE WebGL context: the shared renderer draws each
// stage in turn and the result is blitted into that stage's own 2D canvas, so a
// marquee of ten models costs one context instead of ten.
import * as THREE from 'three';
import { buildGroup } from './propsize-doc.js';

const DPR = Math.min(window.devicePixelRatio || 1, 2);
const docCache = new Map();

function loadDoc(url) {
	if (!docCache.has(url)) docCache.set(url, fetch(url).then((r) => r.json()));
	return docCache.get(url);
}

const engine = {
	renderer: null,
	sizeKey: '',
	stages: new Set(),
	running: false,
	last: 0,
	get gl() {
		if (!this.renderer) {
			this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
			this.renderer.setPixelRatio(1); // we size in device px ourselves
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.shadowMap.enabled = false;
		}
		return this.renderer;
	},
	add(s) {
		this.stages.add(s);
		if (!this.running) {
			this.running = true;
			requestAnimationFrame(this.tick);
		}
	},
	remove(s) {
		this.stages.delete(s);
	},
	tick: (t) => {
		const e = engine;
		const dt = Math.min((t - e.last) / 1000 || 0, 0.1);
		e.last = t;
		e.frameNo = (e.frameNo || 0) + 1;
		if (e.frameNo % 8 === 1) e.stages.forEach((s) => s.checkVisible());
		const list = [...e.stages].filter((s) => s.visible && s.model);
		list.sort((a, b) => a.sizeKey.localeCompare(b.sizeKey));
		for (let i = 0; i < list.length; i++) {
			const s = list[i];
			s.step(dt);
			// Small stages take turns: half the list per frame keeps a ten-card
			// marquee at ~30fps of drawing instead of 60.
			if (!s.hasAttribute('priority') && (e.frameNo + i) % 2 === 0) continue;
			const w = s.pxW, h = s.pxH;
			if (!w || !h) continue;
			const key = w + 'x' + h;
			if (key !== e.sizeKey) {
				e.gl.setSize(w, h, false);
				e.sizeKey = key;
			}
			e.gl.render(s.scene, s.camera);
			s.blit(e.gl.domElement);
		}
		requestAnimationFrame(e.tick);
	}
};

function groundShadow() {
	const c = document.createElement('canvas');
	c.width = c.height = 128;
	const g = c.getContext('2d');
	const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	grad.addColorStop(0, 'rgba(0,0,0,0.5)');
	grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
	grad.addColorStop(1, 'rgba(0,0,0,0)');
	g.fillStyle = grad;
	g.fillRect(0, 0, 128, 128);
	const tex = new THREE.CanvasTexture(c);
	return tex;
}

class PropsizeStage extends HTMLElement {
	connectedCallback() {
		if (this._built) return;
		this._built = true;

		this.style.display = 'block';
		this.style.position = this.style.position || 'relative';
		this.canvas = document.createElement('canvas');
		this.canvas.style.cssText = 'display:block;width:100%;height:100%;opacity:0;transition:opacity .45s ease';
		this.ctx = this.canvas.getContext('2d');
		this.appendChild(this.canvas);

		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 200);
		this.pivot = new THREE.Group();
		this.scene.add(this.pivot);

		const hemi = new THREE.HemisphereLight(0xd9e2ea, 0x2a2320, 0.85);
		const key = new THREE.DirectionalLight(0xffe9cf, 2.1);
		key.position.set(3, 5, 2.4);
		const fill = new THREE.DirectionalLight(0x9fb6c9, 0.6);
		fill.position.set(-3.4, 1.6, -2.2);
		const rim = new THREE.DirectionalLight(0xe2a35f, 0.55);
		rim.position.set(-1.2, 2.2, -3.6);
		this.scene.add(hemi, key, fill, rim);

		this.shadow = new THREE.Mesh(
			new THREE.PlaneGeometry(1, 1),
			new THREE.MeshBasicMaterial({ map: groundShadow(), transparent: true, depthWrite: false })
		);
		this.shadow.rotation.x = -Math.PI / 2;
		this.scene.add(this.shadow);

		this.az = Number(this.getAttribute('start-az') ?? 0.7);
		this.el = Number(this.getAttribute('start-el') ?? 0.34);
		this.spin = Number(this.getAttribute('autorotate') ?? 0.16);
		this.zoom = Number(this.getAttribute('zoom') ?? 1);
		this.visible = true;
		this.pxW = this.pxH = 0;
		this.sizeKey = '';
		this.paused = false;

		new ResizeObserver(() => this.resize()).observe(this);
		this.resize();

		if (this.hasAttribute('orbit')) this.enableOrbit();
		engine.add(this);

		const cycle = (this.getAttribute('cycle') || '').split(',').map((s) => s.trim()).filter(Boolean);
		this.queue = cycle.length ? cycle : [this.getAttribute('model')].filter(Boolean);
		this.qi = 0;
		if (this.queue.length) {
			this.show(this.queue[0]);
			if (this.queue.length > 1) {
				const every = Number(this.getAttribute('cycle-ms') ?? 6500);
				this._timer = setInterval(() => this.next(), every);
			}
		}
	}

	disconnectedCallback() {
		engine.remove(this);
		clearInterval(this._timer);
	}

	get base() {
		return this.getAttribute('base') || '/showcase/models/';
	}

	next(dir = 1) {
		this.qi = (this.qi + dir + this.queue.length) % this.queue.length;
		this.show(this.queue[this.qi]);
	}

	async show(slug) {
		this.slug = slug;
		const doc = await loadDoc(this.base + slug + '.json');
		if (this.slug !== slug) return;
		if (this.model) {
			this.pivot.remove(this.model);
			this.model.traverse((o) => {
				if (o.geometry) o.geometry.dispose();
			});
		}
		this.canvas.style.opacity = '0';
		const group = buildGroup(THREE, doc);
		const box = new THREE.Box3().setFromObject(group);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		group.position.set(-center.x, -box.min.y, -center.z);
		this.model = group;
		this.pivot.add(group);

		this.radius = Math.max(size.x, size.z, size.y) * 0.5;
		this.height = size.y;
		const foot = Math.max(size.x, size.z) * 1.9;
		this.shadow.scale.set(foot, foot, 1);
		this.shadow.position.y = 0.004;
		this.frame();
		this.dispatchEvent(new CustomEvent('model-change', { bubbles: true, detail: { slug, name: doc.name } }));
		requestAnimationFrame(() => (this.canvas.style.opacity = '1'));
	}

	frame() {
		const fov = (this.camera.fov * Math.PI) / 180;
		const r = Math.max(this.radius, 0.4);
		this.dist = (r / Math.sin(fov / 2)) * 1.28 / this.zoom;
		this.pivot.position.y = -this.height * 0.42;
		this.shadow.position.y = -this.height * 0.42 + 0.004;
	}

	// Cheap own-viewport check: an IntersectionObserver reports nothing useful when
	// the page is hosted inside a scaled/transformed container.
	checkVisible() {
		const r = this.getBoundingClientRect();
		const vh = window.innerHeight || 800;
		this.visible = r.bottom > -160 && r.top < vh + 160 && r.width > 0 && this.offsetParent !== null;
	}

	resize() {
		const r = this.getBoundingClientRect();
		const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
		this.cssW = w;
		this.cssH = h;
		this.pxW = Math.round(w * DPR);
		this.pxH = Math.round(h * DPR);
		this.sizeKey = this.pxW + 'x' + this.pxH;
		this.canvas.width = this.pxW;
		this.canvas.height = this.pxH;
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}

	step(dt) {
		if (!this.paused && !this.dragging) this.az += this.spin * dt;
		const d = this.dist || 4;
		const ce = Math.cos(this.el);
		this.camera.position.set(Math.sin(this.az) * ce * d, Math.sin(this.el) * d, Math.cos(this.az) * ce * d);
		this.camera.lookAt(0, 0, 0);
	}

	blit(src) {
		this.ctx.clearRect(0, 0, this.pxW, this.pxH);
		this.ctx.drawImage(src, 0, 0, this.pxW, this.pxH);
	}

	enableOrbit() {
		this.style.touchAction = 'none';
		this.style.cursor = 'grab';
		let px = 0, py = 0;
		const down = (e) => {
			this.dragging = true;
			px = e.clientX;
			py = e.clientY;
			this.style.cursor = 'grabbing';
			this.setPointerCapture?.(e.pointerId);
		};
		const move = (e) => {
			if (!this.dragging) return;
			this.az -= (e.clientX - px) * 0.008;
			this.el = Math.max(-0.25, Math.min(1.2, this.el + (e.clientY - py) * 0.006));
			px = e.clientX;
			py = e.clientY;
		};
		const up = () => {
			this.dragging = false;
			this.style.cursor = 'grab';
		};
		this.addEventListener('pointerdown', down);
		this.addEventListener('pointermove', move);
		this.addEventListener('pointerup', up);
		this.addEventListener('pointercancel', up);
	}
}

if (!customElements.get('propsize-stage')) customElements.define('propsize-stage', PropsizeStage);
window.PropsizeStage = PropsizeStage;
