<script>
	/* =========================================================
	   01 · HOME — two words and the board behind them.
	   "Integrated" and "Unified" sit on top; behind them, tilted,
	   is everything a brand needs drawn as one circuit board (data:
	   brand-graph.js; layout and drawing: ../board/), in line art
	   after the Technics exploded-view poster, with the processor at
	   its centre lettered with what it is: marketing.
	   Three layers: deep space at the back, the circuit tilted in it
	   (no board under it: it fades out into space round the
	   processor), and the words flat on top.
	   The board is off: nothing moves until the page scrolls or the
	   board is opened. The button bottom right opens it, from either
	   screen: the page stops scrolling, the rest goes dark, and the
	   whole circuit turns to face you. Every chip on it shows its
	   parameters, and each pillar's name opens a card saying what it
	   is. Esc, the button again, or a click off the board closes it.
	   Scrolling on, the screen stays pinned while the circuit moves
	   right and comes apart where it stands (board/explode.js), with
	   the claim on the left (Claim.svelte); then the page scrolls on
	   as usual. Copy lives in content.js.
	   Where the board sits, how big and at what angle, at rest, open
	   and taken apart, is set in CSS: "where the board sits".
	   ========================================================= */
	import { onMount } from 'svelte';
	import { board as c, hero, enquiry, identity } from '../content.js';
	import { NODES, RINGS } from '../brand-graph.js';
	import { buildBoard, noise } from '../board/layout.js';
	import { makeView, project, fitBoard, hitCell, onBoard } from '../board/draw.js';
	import { drawExploded, extents, LETTER } from '../board/explode.js';
	import Claim from './Claim.svelte';

	// `ready` turns true once the curtain has lifted.
	let { goto = () => {}, ready = true } = $props();

	/* The scroll scene, as how far through it (0–1) each step runs. */
	const LEAVE = [0.02, 0.18]; // the words and the nav fade out
	const LAND = [0.01, 0.16]; // MARKETING flies onto the die and becomes its name
	const MORPH = [0.06, 0.4]; // the circuit moves into place
	const APART = [0.34, 0.8]; // its parts lift off the board
	const CLAIM = [0.5, 0.76]; // the claim comes in on the left

	// Outlines the rest, open and apart boxes, for placing them.
	const SHOW_POSES = false;

	/* Where each part's name sits when the board is open, by ring, so
	   no name lands on a neighbour: 'above' its top-left corner, 'left'
	   of it halfway down, or 'under' it in the middle.
	   Brand, Substance, Material, Rules, Form, Signal. */
	const TAG_AT = ['under', 'above', 'above', 'above', 'left', 'left'];
	const GAP = 8; // between a name's patch and its part, px

	/* The colour on the drawing, each on or off, to compare:
	   die     the processor's die lit in the accent at rest (open, it
	           always lights)
	   wired   the processor's own traces in the accent
	   fills   faces in three flat greys, so parts read as solid, with
	           port slots and module chips as fills and contacts in
	           the accent in place of fine lines */
	const LOOK = { die: true, wired: true, fills: true };

	const model = buildBoard();
	const ids = new Map(NODES.map((n, i) => [n.id, i]));
	const ringOf = (r) => RINGS.find((x) => x.id === r);
	const reach = extents(model); // everything taken apart, to fit the drawing
	// the processor and the parts round it: what the resting pose frames
	const heart = model.parts
		.filter((p) => p.ring <= 3)
		.reduce(
			(b, p) => ({
				x0: Math.min(b.x0, p.x0 - 1),
				x1: Math.max(b.x1, p.x1 + 1),
				z0: Math.min(b.z0, p.z0 - 1),
				z1: Math.max(b.z1, p.z1 + 1)
			}),
			{ x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
		);
	// every chip on a pillar, to light them together when its card is open
	const ringCells = new Map(
		RINGS.map((r) => [r.id, new Set(NODES.flatMap((n, i) => (n.ring === r.id ? [i] : [])))])
	);

	let scene;
	let root;
	let stage;
	let lands; // the word that flies onto the die
	let canvas;
	let sky;
	let partsBox;
	let claim;
	let expand;
	const marks = []; // each part's name on the drawing
	let restBox;
	let focusBox;
	let callout = $state(null); // only exists while a chip is in focus
	let card = $state(null); // only exists while a pillar's card is open
	const tags = [];
	// set once mounted
	let show = () => {};
	let shut = () => {};
	let repaint = () => {};

	let open = $state(false);
	let hover = $state(-1);
	let pinned = $state(-1);
	let mod = $state(-1); // the pillar whose card is open
	const pick = $derived(pinned >= 0 ? pinned : hover);
	const shown = $derived(pick >= 0 ? NODES[pick] : null);
	const pillar = $derived(shown && shown.ring ? ringOf(shown.ring) : null);
	const modRing = $derived(mod > 0 ? ringOf(mod) : null);
	const takes = $derived(
		shown ? shown.from.map((id) => NODES[ids.get(id)]?.label).filter(Boolean) : []
	);

	// a chip or card changing repaints, once Svelte has put its callout or card in
	$effect(() => {
		pick;
		mod;
		repaint();
	});

	onMount(() => {
		const ctx = canvas.getContext('2d');
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const css = getComputedStyle(stage);
		const em = accent(css.getPropertyValue('--em'));
		const font = css.getPropertyValue('--grotesk').trim() || 'sans-serif';
		const space = getComputedStyle(root).getPropertyValue('--space').trim() || '#050506';
		const A = [0, 0];
		const glow = halo(em); // the die's light, drawn once
		let logo = null; // the logo in the lid's ink, once it has loaded
		if (c.chip.lid === 'logo') {
			const img = new Image();
			img.onload = () => {
				logo = tint(img, LETTER);
				paint();
			};
			img.src = identity.brand.logo;
		}

		let W = 0;
		let H = 0;
		let dpr = 1;
		let rest = null; // the three poses, fitted to their boxes
		let near = null;
		let apart = null;
		let behind = 0; // how much of the words shows behind it open, from --words-behind
		let seen = false; // whether the stage is on screen
		let focus = 0; // 0: resting (or apart); 1: open, facing you
		let target = 0;
		let front = false;
		let clear = false;
		let edge = -1; // the fade's strength as last written
		let last = 0;
		let raf = 0;
		let press = null;
		let view = null;
		let cursor = '';
		let home = null; // where the flying word sits before it flies
		const out = { named: null }; // where the die's name is drawn

		function resize() {
			W = stage.clientWidth;
			H = stage.clientHeight;
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			stars();
			const s = stage.getBoundingClientRect();
			rest = pose(restBox, s, heart);
			near = pose(focusBox, s, model.bounds);
			apart = drawing(partsBox, s);
			behind = parseFloat(getComputedStyle(root).getPropertyValue('--words-behind')) || 0;
			if (lands) {
				lands.style.transform = 'none';
				const r = lands.getBoundingClientRect();
				home = { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2, w: r.width };
			}
			// the fade centres on the processor where it rests, and stays there
			project(makeView({ ...rest, px: 0, pz: 0, pull: 1 }), model.core.x, 0, model.core.z, 1, A);
			root.style.setProperty('--mx', `${A[0].toFixed(1)}px`);
			root.style.setProperty('--my', `${A[1].toFixed(1)}px`);
			paint();
		}

		// `b` of the board fitted into one of the pose boxes, at that
		// box's angles, then zoomed by its --zoom about the box's middle.
		function pose(box, s, b) {
			const r = box.getBoundingClientRect();
			const k = getComputedStyle(box);
			const az = deg(k.getPropertyValue('--az'));
			const el = deg(k.getPropertyValue('--el'));
			const zoom = parseFloat(k.getPropertyValue('--zoom')) || 1;
			const fit = fitBoard(model, az, el, r.width, r.height, b);
			const mx = r.width / 2;
			const my = r.height / 2;
			return {
				az,
				el,
				scale: fit.scale * zoom,
				cx: r.left - s.left + mx + (fit.cx - mx) * zoom,
				cy: r.top - s.top + my + (fit.cy - my) * zoom,
				fx: fit.fx,
				fz: fit.fz
			};
		}

		// The circuit fully apart, fitted into .pose.parts at its angles.
		function drawing(box, s) {
			const r = box.getBoundingClientRect();
			const k = getComputedStyle(box);
			const az = deg(k.getPropertyValue('--az'));
			const el = deg(k.getPropertyValue('--el'));
			const b = model.bounds;
			const fx = (b.x0 + b.x1) / 2;
			const fz = (b.z0 + b.z1) / 2;
			const v = makeView({ az, el, scale: 1, cx: 0, cy: 0, fx, fz, px: 0, pz: 0, pull: 1 });
			let x0 = Infinity;
			let x1 = -Infinity;
			let y0 = Infinity;
			let y1 = -Infinity;
			for (const [x, y, z] of reach) {
				project(v, x, y, z, 1, A);
				x0 = Math.min(x0, A[0]);
				x1 = Math.max(x1, A[0]);
				y0 = Math.min(y0, A[1]);
				y1 = Math.max(y1, A[1]);
			}
			const scale = Math.min(r.width / (x1 - x0), r.height / (y1 - y0));
			return {
				az,
				el,
				scale,
				fx,
				fz,
				cx: r.left - s.left + r.width / 2 - (scale * (x0 + x1)) / 2,
				cy: r.top - s.top + r.height / 2 - (scale * (y0 + y1)) / 2
			};
		}

		// How far through the scene the page has scrolled, 0–1.
		function through() {
			const r = scene.getBoundingClientRect();
			const run = r.height - innerHeight;
			return run > 0 ? clamp(-r.top / run, 0, 1) : 0;
		}

		// The back layer: a still field of stars, a few of them green.
		function stars() {
			const g = sky.getContext('2d');
			sky.width = Math.round(W * dpr);
			sky.height = Math.round(H * dpr);
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
			const n = Math.round((W * H) / 4200);
			for (let k = 0; k < n; k++) {
				const r = noise(k * 4 + 3);
				const a = 0.08 + 0.5 * noise(k * 4 + 2) ** 3;
				g.beginPath();
				g.arc(noise(k * 4) * W, noise(k * 4 + 1) * H, r > 0.96 ? 1.3 : 0.4 + 0.5 * r, 0, Math.PI * 2);
				g.fillStyle = r > 0.9 ? `rgba(${em.join(', ')}, ${a + 0.1})` : `rgba(244, 244, 241, ${a})`;
				g.fill();
			}
		}

		/* One frame of the drawing, for where the page is scrolled to
		   and how far open the board is. Runs on scroll, on resize,
		   when the chip or card in focus changes, and every frame only
		   while the board is opening or closing. */
		function paint() {
			if (!W || !H || !rest) return;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W, H);
			const t = through();
			// with reduced motion the scene jumps between its two ends
			const at = (a) => (still ? (t > 0.3 ? 1 : 0) : smooth(a[0], a[1], t));
			const m = at(MORPH);
			const x = at(APART);
			const e = ease(focus);
			const land = still ? (t > 0.15 ? 1 : 0) : smooth(LAND[0], LAND[1], t);
			root.style.setProperty('--claim', at(CLAIM).toFixed(3));
			if (claim) claim.inert = open || at(CLAIM) < 0.5;
			// where the scroll has it, then from there to facing you as it opens
			view = makeView({
				...blend(blend(rest, apart, ease(m)), near, e),
				px: model.core.x,
				pz: model.core.z,
				pull: 1
			});
			// a chip in focus lights its own traces; an open card lights its pillar
			let lit = null;
			if (focus > 0.6 && pick >= 0) lit = { cell: pick, ...model.touch[pick] };
			else if (focus > 0.6 && mod > 0) lit = { cell: -1, lanes: [], cells: ringCells.get(mod) };
			// opened from the second screen, the parts settle back onto the board
			const guides = smooth(0.3, 0.9, x) * (1 - e);
			out.named = null;
			const anchors = drawExploded(ctx, view, model, {
				p: ease(x) * (1 - e),
				guides,
				lit,
				power: LOOK.die ? 1 : e,
				glow,
				wired: LOOK.wired ? 1 : 0,
				fills: LOOK.fills,
				// the die's name shows once the word has landed on it, or opened
				mark: { ...c.chip, logo, shown: Math.max(smooth(0.82, 1, land), e) },
				out,
				font,
				em,
				dpr,
				bg: space
			});
			for (const a of anchors) {
				const el = marks[a.ring];
				if (!el) continue;
				el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) translateY(-50%)`;
				el.style.opacity = String(guides);
			}
			// the fade round the processor lets go as the circuit moves off or opens
			const fade = Math.max(e, smooth(0, 0.6, m));
			if (Math.abs(fade - edge) > 0.0005) {
				edge = fade;
				root.style.setProperty('--edge', fade.toFixed(3));
			}
			if (fade > 0.999 !== clear) {
				clear = fade > 0.999;
				root.toggleAttribute('data-clear', clear);
			}
			overlays(e, 1 - at(LEAVE));
			fly(land, e);

			const want = focus > 0.6 && hover >= 0 ? 'pointer' : '';
			if (want !== cursor) root.style.cursor = cursor = want;
		}

		/* MARKETING, the third word, flies onto the die and becomes the
		   name on it: it moves and shrinks until its width lies along the
		   name's, takes the die's tilt, turns from the accent to the die's
		   ink as it crosses onto it, and fades as the name comes up. With
		   reduced motion it only fades, and the name comes up. */
		function fly(land, e) {
			const n = out.named;
			if (!lands || !home) return;
			const q = still || !n ? 0 : ease(land);
			if (n) {
				const k = n.span / home.w;
				const m = [lerp(1, n.ux * k, q), lerp(0, n.uy * k, q), lerp(0, n.nx * k, q), lerp(1, n.ny * k, q)];
				const dx = lerp(0, n.x - home.x, q);
				const dy = lerp(0, n.y - home.y, q);
				lands.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) matrix(${m.map((v) => v.toFixed(4)).join(', ')}, 0, 0)`;
			}
			lands.style.setProperty('--ink', smooth(0.5, 0.85, land).toFixed(3));
			lands.style.opacity = ((1 - smooth(0.82, 1, land)) * Math.max(0, 1 - 2 * e)).toFixed(3);
		}

		/* The page's share of the opening goes to CSS as variables (see
		   .home in the styles). The words fade out as the board comes
		   forward and back in behind it, so the swap of which is on top
		   happens while they cannot be seen. Labels ride on their
		   parts, the card under its pillar's name, the callout on its
		   chip. */
		function overlays(e, hero) {
			const r = root.style;
			r.setProperty('--f', e.toFixed(3));
			r.setProperty('--words', ((e < 0.5 ? 1 - 2 * e : (2 * e - 1) * behind) * hero).toFixed(3));
			r.setProperty('--hero', hero.toFixed(3));
			if (hero < 0.5 !== root.hasAttribute('data-away')) root.toggleAttribute('data-away', hero < 0.5);
			if (e > 0.5 !== front) {
				front = e > 0.5;
				root.toggleAttribute('data-front', front);
			}
			const shows = smooth(0.6, 1, focus);
			let cardAt = null;
			for (const p of model.parts) {
				const tag = tags[p.ring];
				if (!tag) continue;
				const at = TAG_AT[p.ring] || 'above';
				const top = p.h + (p.kind === 'memory' ? p.rise : 0);
				const pins = p.kind === 'core' || p.kind === 'ctrl' ? 1 : 0; // how far its pins stick out
				let move;
				if (at === 'left') {
					project(view, p.x0 - pins, top / 2, (p.z0 + p.z1) / 2, 1, A);
					A[0] -= GAP;
					move = 'translate(-100%, -50%)';
				} else if (at === 'under') {
					project(view, (p.x0 + p.x1) / 2, 0, p.z1 + pins, 1, A);
					A[1] += GAP;
					move = 'translateX(-50%)';
				} else {
					project(view, p.x0, top, p.z0 - pins, 1, A);
					A[1] -= GAP;
					move = 'translateY(-100%)';
				}
				tag.style.transform = `translate(${A[0].toFixed(1)}px, ${A[1].toFixed(1)}px) ${move}`;
				tag.style.opacity = String(shows);
				// the pillar names are buttons, but only once they can be seen
				tag.style.pointerEvents = p.ring && shows > 0.5 ? 'auto' : 'none';
				if (p.ring === mod) cardAt = { x: A[0], y: A[1], at };
			}
			if (card) {
				// just under its name, kept inside the stage
				if (!cardAt || shows < 0.5) card.style.opacity = '0';
				else {
					const w = card.offsetWidth;
					const h = card.offsetHeight;
					const { at } = cardAt;
					const x0 = at === 'left' ? cardAt.x - w : at === 'under' ? cardAt.x - w / 2 : cardAt.x;
					const y0 = at === 'left' ? cardAt.y + 14 : at === 'under' ? cardAt.y + 24 : cardAt.y + 6;
					const x = clamp(x0, 8, Math.max(8, W - w - 8));
					const y = clamp(y0, 8, Math.max(8, H - h - 8));
					card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
					card.style.opacity = '1';
				}
			}
			if (!callout) return;
			const cell = pick >= 0 ? model.cells[pick] : null;
			if (!cell || shows < 0.5) {
				callout.style.opacity = '0';
				return;
			}
			project(view, cell.cx, cell.y1, cell.cz, 1, A);
			const w = callout.offsetWidth;
			const h = callout.offsetHeight;
			let x = A[0] + 18;
			let y = A[1] - 18 - h;
			if (x + w > W - 8) x = A[0] - 18 - w;
			if (y < 8) y = A[1] + 18;
			x = clamp(x, 8, Math.max(8, W - w - 8));
			y = clamp(y, 8, Math.max(8, H - h - 8));
			callout.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
			callout.style.opacity = '1';
		}

		/* ---- opening and closing ------------------------------ */

		function frame(now) {
			const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
			last = now;
			const rate = target > focus ? 4 : 2.8;
			focus += (target - focus) * (1 - Math.exp(-dt * rate));
			if (Math.abs(target - focus) < 0.001) focus = target;
			paint();
			raf = focus === target ? 0 : requestAnimationFrame(frame);
		}

		// Ease toward `target`; with reduced motion, go there at once.
		function animate() {
			if (still) {
				focus = target;
				paint();
			} else if (!raf) {
				last = 0;
				raf = requestAnimationFrame(frame);
			}
		}

		// While it is open the page underneath stays where it is.
		function lock(on) {
			const s = document.documentElement.style;
			s.overflow = on ? 'hidden' : '';
			s.scrollbarGutter = on ? 'stable' : '';
		}

		show = () => {
			if (open) return;
			open = true;
			lock(true);
			target = 1;
			animate();
			// into the dialog, so its name and the keys are read out
			stage.focus({ preventScroll: true });
		};

		shut = () => {
			if (!open) return;
			open = false;
			hover = -1;
			pinned = -1;
			mod = -1;
			lock(false);
			target = 0;
			animate();
			expand.focus({ preventScroll: true });
		};

		repaint = () => {
			if (!raf) paint();
		};

		/* ---- input ------------------------------------------- */

		const local = (e) => {
			const r = stage.getBoundingClientRect();
			return [e.clientX - r.left, e.clientY - r.top];
		};

		// Open, the pointer over a chip shows its readout.
		function onMove(e) {
			if (e.pointerType !== 'mouse') return;
			if (!open || focus < 0.6 || !view || e.target.closest?.('button, .card')) {
				hover = -1;
				return;
			}
			const [x, y] = local(e);
			hover = hitCell(model, view, x, y);
		}

		function onLeave(e) {
			if (e.pointerType === 'mouse') hover = -1;
		}

		function onDown(e) {
			// a press on a button, link or card is a click, nothing more
			if (e.button !== 0 || e.target.closest?.('button, a, .card')) return;
			const [x, y] = local(e);
			press = { id: e.pointerId, x, y };
		}

		// Open, a click or tap on a chip holds its readout, on the board
		// off any chip lets go of it and the card, and off the board closes.
		function onUp(e) {
			if (!press || press.id !== e.pointerId) return;
			const [x, y] = local(e);
			const moved = Math.hypot(x - press.x, y - press.y) > 8; // a swipe
			press = null;
			if (moved || !open || focus < 0.6) return;
			if (!onBoard(model, view, x, y)) {
				shut();
				return;
			}
			mod = -1;
			pinned = hitCell(model, view, x, y);
		}

		function onCancel() {
			press = null;
		}

		// A pillar name opens its card; the same name closes it again.
		function onClick(e) {
			const name = e.target.closest?.('[data-ring]');
			if (!name) return;
			const r = Number(name.dataset.ring);
			mod = mod === r ? -1 : r;
		}

		// Open, keys work wherever focus is: arrows walk the chips, Tab
		// stays inside, Esc closes.
		function onKey(e) {
			if (!open) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				shut();
				return;
			}
			if (e.key === 'Tab') {
				trap(e);
				return;
			}
			const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
			if (!fwd && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp') return;
			e.preventDefault();
			const n = NODES.length;
			pinned = fwd ? (pick < 0 ? 0 : (pick + 1) % n) : pick < 0 ? n - 1 : (pick - 1 + n) % n;
		}

		function trap(e) {
			const items = [...stage.querySelectorAll('button:not([tabindex="-1"])')];
			if (!items.length) return;
			const first = items[0];
			const end = items[items.length - 1];
			const at = document.activeElement;
			if (!items.includes(at)) {
				e.preventDefault();
				(e.shiftKey ? end : first).focus();
			} else if (e.shiftKey && at === first) {
				e.preventDefault();
				end.focus();
			} else if (!e.shiftKey && at === end) {
				e.preventDefault();
				first.focus();
			}
		}

		// The stage lets the pointer through (so the nav stays usable
		// whichever is on top), so the pointer is read off the whole screen.
		const off = new AbortController();
		const on = { signal: off.signal };
		root.addEventListener('pointermove', onMove, on);
		root.addEventListener('pointerleave', onLeave, on);
		root.addEventListener('pointerdown', onDown, on);
		root.addEventListener('pointerup', onUp, on);
		root.addEventListener('pointercancel', onCancel, on);
		// a swipe on the open board doesn't scroll the page under it
		root.addEventListener('touchmove', (e) => open && e.preventDefault(), { passive: false, signal: off.signal });
		stage.addEventListener('click', onClick, on);
		document.addEventListener('keydown', onKey, on);
		// at rest nothing moves on its own: it is drawn when the page scrolls
		addEventListener(
			'scroll',
			() => {
				if (seen && !raf) paint();
			},
			{ passive: true, signal: off.signal }
		);

		const ro = new ResizeObserver(resize);
		ro.observe(stage);
		document.fonts?.ready.then(resize); // the word's width changes with the web font

		const io = new IntersectionObserver(([entry]) => {
			seen = entry.isIntersecting;
			if (seen) repaint();
		});
		io.observe(stage);

		return () => {
			show = shut = repaint = () => {};
			if (raf) cancelAnimationFrame(raf);
			if (open) lock(false);
			off.abort();
			ro.disconnect();
			io.disconnect();
		};
	});

	function accent(v) {
		const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
		if (!m) return [34, 197, 139];
		const n = parseInt(m[1], 16);
		return [n >> 16, (n >> 8) & 255, n & 255];
	}
	// A soft round light in the accent, to stamp over the lit die.
	function halo(em) {
		const n = 256;
		const out = document.createElement('canvas');
		out.width = out.height = n;
		const g = out.getContext('2d');
		const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
		r.addColorStop(0, `rgba(${em.join(', ')}, 0.5)`);
		r.addColorStop(0.35, `rgba(${em.join(', ')}, 0.14)`);
		r.addColorStop(1, `rgba(${em.join(', ')}, 0)`);
		g.fillStyle = r;
		g.fillRect(0, 0, n, n);
		return out;
	}
	// The logo filled with one colour, to letter the lid with.
	function tint(img, ink) {
		const n = 512;
		const out = document.createElement('canvas');
		out.width = out.height = n;
		const g = out.getContext('2d');
		g.drawImage(img, 0, 0, n, n);
		g.globalCompositeOperation = 'source-in';
		g.fillStyle = ink;
		g.fillRect(0, 0, n, n);
		return out;
	}
	// A CSS angle in degrees ("-35" or "-35deg") to radians.
	function deg(v) {
		return ((parseFloat(v) || 0) * Math.PI) / 180;
	}
	// One pose part of the way to another.
	function blend(a, b, t) {
		return {
			az: lerp(a.az, b.az, t),
			el: lerp(a.el, b.el, t),
			scale: lerp(a.scale, b.scale, t),
			cx: lerp(a.cx, b.cx, t),
			cy: lerp(a.cy, b.cy, t),
			fx: lerp(a.fx, b.fx, t),
			fz: lerp(a.fz, b.fz, t)
		};
	}
	function lerp(a, b, t) {
		return a + (b - a) * t;
	}
	function clamp(x, lo, hi) {
		return Math.min(hi, Math.max(lo, x));
	}
	function smooth(a, b, x) {
		const t = clamp((x - a) / (b - a), 0, 1);
		return t * t * (3 - 2 * t);
	}
	function ease(t) {
		return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
	}
</script>

<div class="scene" bind:this={scene}>
<div class="home" class:outline={SHOW_POSES} class:on={ready} bind:this={root}>
	<div class="space" aria-hidden="true"><canvas bind:this={sky}></canvas></div>

	<h1 class="words" aria-label="{c.words.join(', ')} {c.chip.name.toLowerCase()}">
		<span>{c.words[0]}</span>
		<span>{c.words[1]}</span>
		<!-- the die's own name: it flies onto the die as the page scrolls -->
		<span class="lands"><span bind:this={lands}>{c.chip.name}</span></span>
	</h1>

	<div class="pose rest" bind:this={restBox} aria-hidden="true"></div>
	<div class="pose focus" bind:this={focusBox} aria-hidden="true"></div>
	<div class="pose parts" bind:this={partsBox} aria-hidden="true"></div>
	<div class="scrim" aria-hidden="true"></div>

	<header class="bar jf-s-wrap" inert={open}>
		<a class="brand" href="/" aria-label="{identity.brand.wordmark}, home">
			<img src={identity.brand.logo} alt="" />
			<span>{identity.brand.wordmark}</span>
		</a>
		<nav class="links" aria-label="Page">
			{#each hero.nav as n}
				<button type="button" onclick={() => goto(n.goto, n.anchor)}>{n.label}</button>
			{/each}
		</nav>
		<a class="jf-s-btn primary small" href={enquiry.href}>{enquiry.label}</a>
	</header>

	<!-- Open, this is the dialog: the pillar names and the button are
	     what Tab moves between, and the arrows walk the chips. -->
	<div
		class="stage"
		bind:this={stage}
		tabindex="-1"
		role={open ? 'dialog' : 'group'}
		aria-modal={open ? 'true' : undefined}
		aria-label={c.alt}
		aria-describedby={open ? 'board-keys' : 'board-parts'}
	>
		<canvas class="drawing" bind:this={canvas} aria-hidden="true"></canvas>
		{#each model.parts as p (p.ring)}
			<span class="part" bind:this={marks[p.ring]} aria-hidden="true">
				<b>{p.ring ? `0${p.ring} ` : ''}{ringOf(p.ring)?.name}</b>
				<span>{ringOf(p.ring)?.label}</span>
			</span>
		{/each}
		{#each model.parts as p (p.ring)}
			{#if p.ring}
				<button
					type="button"
					class="tag"
					data-ring={p.ring}
					tabindex={open ? 0 : -1}
					bind:this={tags[p.ring]}
					aria-expanded={mod === p.ring}
				>
					<b>0{p.ring}</b>{ringOf(p.ring)?.name}<i>+</i>
				</button>
			{:else}
				<span class="tag" bind:this={tags[p.ring]} aria-hidden="true">{ringOf(p.ring)?.name}</span>
			{/if}
		{/each}
		{#if modRing}
			<div class="card" bind:this={card} role="note">
				<p class="card-head"><b>0{modRing.id}</b>{modRing.name} <span>{modRing.label}</span></p>
				<p class="card-about">{modRing.about}</p>
				<p class="card-groups">{modRing.groups.join(' · ')}</p>
			</div>
		{/if}
		{#if shown}
			<div class="callout" bind:this={callout} aria-hidden="true">
				<p class="name">
					{#if pillar}<small>{pillar.name}{#if shown.group} · {shown.group}{/if}</small>{/if}
					{shown.label}
				</p>
				<ul>
					{#each shown.params as v}
						<li>{v}</li>
					{/each}
				</ul>
				<p class="from">
					{#if takes.length}<span>{c.takesFrom}</span> {takes.join(', ')}{:else}{c.source}{/if}
				</p>
			</div>
		{/if}
		<p class="sr" aria-live="polite">{shown ? `${shown.label}: ${shown.params.join(', ')}` : ''}</p>

		<button
			type="button"
			class="expand"
			bind:this={expand}
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-label={open ? c.expand.close : c.expand.open}
			title={open ? c.expand.close : c.expand.open}
			onclick={() => (open ? shut() : show())}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				{#if open}
					<!-- four arrows in -->
					<path d="M4 4l6 6M10 5v5H5M20 4l-6 6M14 5v5h5M20 20l-6-6M19 14h-5v5M4 20l6-6M5 14h5v5" />
				{:else}
					<!-- four arrows out -->
					<path d="M10 10L4 4M4 9V4h5M14 10l6-6M15 4h5v5M14 14l6 6M20 15v5h-5M10 14l-6 6M9 20H4v-5" />
				{/if}
			</svg>
		</button>
	</div>

	<div class="claim" bind:this={claim}>
		<Claim />
	</div>

	<div class="vignette" aria-hidden="true"></div>

	<div class="sr" id="board-parts">
		<p>{c.chip.name}: {c.chip.does}.</p>
		{#each RINGS as r (r.id)}
			<p>
				{r.name} ({r.label.toLowerCase()}):
				{NODES.filter((n) => n.ring === r.id).map((n) => n.label).join(', ')}.
			</p>
		{/each}
	</div>
	<p class="sr" id="board-keys">{c.keys}</p>
</div>
</div>

<style>
	/* Layers, bottom to top: space, the circuit, the words (with the
	   nav and the claim), the scrim, the vignette, and the button over
	   it all. Open, the circuit moves above the scrim, so everything
	   else goes dark under it. The stage sets no layer of its own, so
	   what is in it can sit at different heights. */
	/* The scene: as tall as --run, with the screen pinned inside it the
	   whole way. The longer it runs, the slower the scroll plays it. */
	.scene {
		--run: 300dvh;
		position: relative;
		height: var(--run);
	}

	.home {
		--space: #050506;
		/* At rest the drawing shows this strongly, 0–1; moved off or
		   open, at full. */
		--rest-strength: 0.75;
		/* At rest the circuit fades out this far from the processor, so
		   it melts into space; the fade lets go as it moves off or opens. */
		--fade: 44vmax;
		/* What the rest of the page goes under when open, and how much
		   of the words still shows through it, 0–1. */
		--scrim: rgba(2, 2, 3, 0.95);
		--words-behind: 0.12;
		/* Set by the script: --f is how far open, 0–1; --words drives the
		   words; --edge is how far the fade has let go, 0–1; --mx and --my
		   are where the processor rests on screen (set on resize only). */
		--f: 0;
		--words: 1;
		--edge: 0;
		--mx: 70%;
		--my: 64%;
		--hero: 1;
		--claim: 0;

		position: sticky;
		top: 0;
		height: 100dvh;
		min-height: 560px;
		overflow: hidden;
		background: var(--space);
		font-family: var(--grotesk);
	}

	/* ---- space -------------------------------------------- */
	.space {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}
	.space canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	/* Darkened corners and a little grain, over everything. */
	.vignette {
		position: absolute;
		inset: 0;
		z-index: 5;
		pointer-events: none;
		background: radial-gradient(
			ellipse 75% 80% at 55% 50%,
			transparent 45%,
			rgba(0, 0, 0, 0.45) 75%,
			rgba(0, 0, 0, 0.85) 100%
		);
		opacity: calc(1 - 0.4 * var(--f));
	}
	.vignette::after {
		content: '';
		position: absolute;
		inset: 0;
		opacity: 0.16;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 -.4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
	}

	/* ---- where the board sits ------------------------------ */
	/* At rest, the processor and the parts round it (controller,
	   memory, logic) are fitted into .pose.rest, and the rest spills
	   past it into the fade; open, the whole circuit is fitted
	   into .pose.focus. Move or resize a box to move the circuit;
	   --zoom scales it past the box about its middle. --az turns it
	   about the vertical (0 is square on) and --el tilts it toward
	   you (90 looks straight down), in degrees. All of it is read on
	   load and resize. Turn on SHOW_POSES in the script to see them. */
	.pose {
		position: absolute;
		pointer-events: none;
	}
	/* in the space the words leave, under UNIFIED and right of it */
	.pose.rest {
		left: 42%;
		top: 38%;
		width: 54%;
		height: 56%;
		--az: -28;
		--el: 48;
		--zoom: 1.4;
	}
	.pose.focus {
		inset: 0;
		--az: 0;
		--el: 74;
		--zoom: 1;
	}
	/* Taken apart, the whole circuit at its full lift is fitted here.
	   The names hang off to the right of their parts, so the box stops
	   short of the rail by about a name's width. */
	.pose.parts {
		left: 44%;
		right: calc(var(--pad-r) + 110px);
		top: 9%;
		height: 84%;
		--az: -30;
		--el: 34;
	}
	.outline .pose {
		outline: 1px dashed var(--s-grey);
		outline-offset: -1px;
	}

	.scrim {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		background: var(--scrim);
		opacity: var(--f);
	}

	/* The two words: as wide as the page, over the resting board. */
	.words {
		position: absolute;
		left: 2rem;
		top: calc(var(--pad-y) + 88px);
		z-index: 2;
		margin: 0;
		pointer-events: none;
		font-weight: 900;
		/* as large as the page allows: INTEGRATED runs about 6.4 times
		   its size across (6.6 for a margin), and must fit inside the
		   2rem either side; on short screens the height caps it, at
		   three lines */
		font-size: min(calc((100vw - 4rem) / 6.6), 21dvh);
		line-height: 0.8;
		letter-spacing: -0.05em;
		text-transform: uppercase;
		text-align: left;
		color: var(--s-white);
	}
	.words span {
		display: block;
	}
	.words span + span {
		margin-top: 0.04em;
	}
	/* the first two fade as the page scrolls; the third flies (fly()) */
	.words > span:not(.lands) {
		opacity: var(--words);
	}
	.words .lands > span {
		display: inline-block;
		transform-origin: 50% 50%;
		will-change: transform;
		/* the accent, turning to the die's ink as it lands on it */
		color: color-mix(in srgb, rgb(4 24 15) calc(var(--ink, 0) * 100%), var(--em));
	}

	.stage {
		position: absolute;
		inset: 0;
		outline: none; /* open, the board facing you is what shows it has focus */
		pointer-events: none; /* the buttons take it back for themselves */
		user-select: none;
		-webkit-user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	/* The fade is a still mask: it only changes while the circuit
	   moves off or opens, and goes altogether once it has let go. */
	.drawing {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		display: block;
		opacity: calc(var(--rest-strength) + (1 - var(--rest-strength)) * var(--edge));
		-webkit-mask-image: radial-gradient(circle var(--fade) at var(--mx) var(--my), #000 35%, rgba(0, 0, 0, var(--edge)));
		mask-image: radial-gradient(circle var(--fade) at var(--mx) var(--my), #000 35%, rgba(0, 0, 0, var(--edge)));
	}
	/* data-clear and data-front are set from the script, so Svelte can't see them */
	.home:global([data-clear]) .drawing {
		-webkit-mask-image: none;
		mask-image: none;
	}
	.home:global([data-front]) .drawing {
		z-index: 4;
	}
	/* it arrives once the curtain lifts */
	.home:not(.on) .drawing {
		visibility: hidden;
	}
	.on .drawing {
		animation: arrive 0.9s ease;
	}
	@keyframes arrive {
		from {
			opacity: 0;
		}
	}
	/* Each part's name on the drawing, at the end of its leader. */
	.part {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 1;
		opacity: 0;
		pointer-events: none;
		white-space: nowrap;
		will-change: transform;
	}
	.part b {
		display: block;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--s-white);
	}
	.part span {
		display: block;
		margin-top: 2px;
		font-size: 12px;
		color: var(--s-grey);
	}

	/* The claim, on the left once the circuit is apart. */
	.claim {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		pointer-events: none;
		opacity: var(--claim);
		transform: translateY(calc((1 - var(--claim)) * 28px));
	}
	.claim:not([inert]) > :global(*) {
		pointer-events: auto;
	}

	/* ---- nav ---------------------------------------------- */
	.bar {
		position: absolute;
		top: var(--pad-y);
		left: var(--pad-x);
		right: var(--pad-r);
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 24px;
		color: var(--s-white);
		opacity: var(--hero);
	}
	/* set by the script once the words and nav have faded */
	.home:global([data-away]) .bar {
		pointer-events: none;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-right: auto;
		font-weight: 700;
		font-size: 19px;
		letter-spacing: -0.01em;
		color: inherit;
		text-decoration: none;
	}
	.brand img {
		width: 34px;
		height: 34px;
	}
	.links {
		display: flex;
		gap: 4px;
	}
	.links button {
		padding: 10px 12px;
		background: none;
		border: 0;
		border-radius: 8px;
		font: inherit;
		font-size: 15px;
		font-weight: 500;
		color: var(--s-grey);
		cursor: pointer;
		transition: color 0.2s ease;
	}
	.links button:hover {
		color: var(--s-white);
	}
	.small {
		padding: 11px 16px;
		font-size: 14.5px;
	}

	/* The button that opens the board and closes it, bottom right on
	   both screens, over everything. */
	.expand {
		position: absolute;
		right: var(--pad-r);
		bottom: var(--pad-y);
		z-index: 6;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		padding: 0;
		background: rgba(5, 5, 6, 0.6);
		border: 1px solid var(--s-line);
		border-radius: 10px;
		color: var(--s-white);
		cursor: pointer;
		pointer-events: auto;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}
	.expand:hover {
		border-color: var(--s-grey);
		background: rgba(20, 20, 20, 0.8);
	}
	.expand:focus-visible {
		outline: 2px solid var(--em);
		outline-offset: 3px;
	}
	.expand svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* ---- on the board, open -------------------------------- */
	/* Each sits on a patch of the dark, so it reads over the traces;
	   the script places the patch, GAP clear of its part. */
	.tag {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 4;
		padding: 5px 8px;
		background: rgba(5, 5, 6, 0.88);
		border-radius: 6px;
		opacity: 0;
		pointer-events: none;
		white-space: nowrap;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--s-grey);
		will-change: transform;
	}
	.tag b {
		margin-right: 6px;
		color: var(--em);
		font-weight: 700;
	}
	button.tag {
		border: 0;
		font-family: inherit;
		cursor: pointer;
		transition: color 0.2s ease;
	}
	button.tag:hover,
	button.tag[aria-expanded='true'] {
		color: var(--s-white);
	}
	button.tag:focus-visible {
		outline: 1px solid var(--em);
	}
	.tag i {
		margin-left: 6px;
		font-style: normal;
		color: var(--em);
	}

	/* A pillar's card: what it is, in a line or two. */
	.card {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 4;
		width: 260px;
		opacity: 0;
		padding: 12px 14px 13px;
		background: rgba(14, 14, 14, 0.94);
		border: 1px solid var(--s-line);
		border-left: 2px solid var(--em);
		border-radius: 6px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
		pointer-events: none;
		will-change: transform;
	}
	.card p {
		margin: 0;
	}
	.card-head {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--s-white);
	}
	.card-head b {
		margin-right: 8px;
		color: var(--em);
	}
	.card-head span {
		margin-left: 6px;
		font-weight: 500;
		letter-spacing: 0.02em;
		text-transform: none;
		color: var(--s-grey);
	}
	.card .card-about {
		margin-top: 8px;
		font-size: 14px;
		line-height: 1.45;
		color: #d9d9d4;
	}
	.card .card-groups {
		margin-top: 10px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--em);
	}

	/* The chip readout: a header in the accent, one row per parameter. */
	.callout {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 4;
		width: 220px;
		opacity: 0;
		pointer-events: none;
		background: rgba(14, 14, 14, 0.94);
		border: 1px solid var(--s-line);
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
		will-change: transform;
	}
	.name {
		margin: 0;
		padding: 8px 12px;
		background: var(--em);
		color: var(--s-black);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	/* pillar · sub-pillar, above the chip's own name */
	.name small {
		display: block;
		margin-bottom: 3px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.12em;
		opacity: 0.6;
	}
	.callout ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.callout li {
		padding: 7px 12px;
		font-size: 13px;
		color: #d9d9d4;
		border-top: 1px solid var(--s-line);
	}
	.callout li:first-child {
		border-top: 0;
	}
	.from {
		margin: 0;
		padding: 8px 12px 10px;
		font-size: 12px;
		line-height: 1.4;
		color: var(--s-grey);
		border-top: 1px solid var(--s-line);
	}
	.from span {
		color: var(--s-white);
		font-weight: 600;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 900px) {
		.links {
			display: none;
		}
		/* narrow: the circuit rests under the words rather than beside them */
		.pose.rest {
			left: 0;
			top: 40%;
			width: 100%;
			height: 54%;
		}
		/* apart, the drawing takes the top and the claim the bottom */
		.pose.parts {
			left: 4%;
			right: 4%;
			top: 6%;
			height: 40%;
		}
		.claim {
			align-items: flex-end;
		}
	}
	@media (max-width: 420px) {
		.brand span {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.on .drawing {
			animation: none;
		}
	}
</style>
