<script>
	/* =========================================================
	   01 · HOME — two words and the board behind them.
	   "Integrated" and "Unified" sit on top; behind them, opened
	   out and tilted, is everything a brand needs drawn as one
	   circuit board (data: brand-graph.js; layout and drawing:
	   ../board/), with the processor at its centre lettered with
	   what it is: marketing.
	   Three layers: deep space at the back, the circuit tilted in
	   it (no board under it: parts and traces sit in the dark and
	   fade out at their edges), and the words flat on top.
	   On arrival the circuit builds and pulses run in to the
	   processor, then it settles and the pulses run back out, the
	   one colour on the page. Moving into the hover region brings
	   it forward: the rest of the page goes dark, the circuit turns
	   to face you and spreads across the page, every chip on it
	   shows its parameters, and each pillar's name opens a card
	   saying what it is. Copy lives in content.js.
	   Scrolling on, the screen stays pinned while the circuit turns
	   into a line drawing, moves right and comes apart where it
	   stands (board/explode.js), with the claim on the left
	   (Claim.svelte); then the page scrolls on as usual.
	   Where the board sits, how big and at what angle, at rest, in
	   focus and taken apart, is set in CSS: "where the board sits".
	   ========================================================= */
	import { onMount } from 'svelte';
	import { board as c, hero, enquiry, identity } from '../content.js';
	import { NODES, RINGS } from '../brand-graph.js';
	import { buildBoard, schedule, noise } from '../board/layout.js';
	import { makeView, project, fitBoard, drawBoard, hitCell, onBoard, partIn, INK } from '../board/draw.js';
	import { drawExploded, extents } from '../board/explode.js';
	import Claim from './Claim.svelte';

	// `ready` turns true once the curtain has lifted.
	let { goto = () => {}, ready = true } = $props();

	/* Seconds. */
	const BUILD = 1.1; // the board builds out from the processor
	const PACE = 0.8; // stretches or squeezes the pulses running in
	const HOLD = 0.5; // the processor lit, before the board settles back
	const LINGER = 0.9; // focus holds after the pointer leaves

	const DRIFT = 1; // which way the pulses run once settled: 1 out from the processor, -1 in

	/* The scroll scene, as how far through it (0–1) each step runs. */
	const LEAVE = [0.02, 0.18]; // the words and the nav fade out
	const MORPH = [0.06, 0.4]; // the circuit turns to line art and moves into place
	const APART = [0.34, 0.8]; // its parts lift off the board
	const CLAIM = [0.5, 0.76]; // the claim comes in on the left

	// Outlines the rest and focus boxes and the hover region, for placing them.
	const SHOW_POSES = false;

	const model = buildBoard();
	const plan = schedule(model, PACE);
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
	let canvas;
	let lines;
	let sky;
	let partsBox;
	let claim;
	const marks = []; // each part's name on the drawing
	let restBox;
	let focusBox;
	let hotBox;
	let callout = $state(null); // only exists while a chip is in focus
	let card = $state(null); // only exists while a pillar's card is open
	const tags = [];
	let kick = () => {}; // starts the opening, once there is something to start

	let hover = $state(-1);
	let pinned = $state(-1);
	let mod = $state(-1); // the pillar whose card is open
	let touch = $state(false);
	const pick = $derived(pinned >= 0 ? pinned : hover);
	const shown = $derived(pick >= 0 ? NODES[pick] : null);
	const pillar = $derived(shown && shown.ring ? ringOf(shown.ring) : null);
	const modRing = $derived(mod > 0 ? ringOf(mod) : null);
	const takes = $derived(
		shown ? shown.from.map((id) => NODES[ids.get(id)]?.label).filter(Boolean) : []
	);

	$effect(() => {
		if (ready) kick();
	});

	onMount(() => {
		const ctx = canvas.getContext('2d');
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		touch = matchMedia('(hover: none)').matches;
		const css = getComputedStyle(stage);
		const em = accent(css.getPropertyValue('--em'));
		const font = css.getPropertyValue('--grotesk').trim() || 'sans-serif';
		const flash = new Float32Array(NODES.length);
		const drift = []; // pulses wandering out
		const A = [0, 0];
		let logo = null; // the logo in the lid's ink, once it has loaded
		if (c.chip.lid === 'logo') {
			const img = new Image();
			img.onload = () => {
				logo = tint(img, INK);
				paint();
			};
			img.src = identity.brand.logo;
		}

		let W = 0;
		let H = 0;
		let dpr = 1;
		let rest = null; // the two poses, fitted to their boxes
		let near = null;
		let hot = null; // the hover region, [x0, y0, x1, y1] on the stage
		let dim = 1; // how strongly the circuit shows at rest, from --rest-strength
		let behind = 0; // how much of the words shows behind it in focus, from --words-behind
		let clock = 0;
		let last = 0;
		let raf = 0;
		let seen = 0; // how much of the stage is in view, 0–1
		let phase = 'wait'; // 'wait' → 'intro' → 'live'
		let t0 = 0;
		let liveAt = 0;
		let focus = 0; // 0: resting behind the words; 1: in front, facing you
		let target = 0;
		let front = false;
		let inside = false;
		let focused = false;
		let tapUntil = 0;
		let closeAt = Infinity;
		let nextDrift = 0;
		let press = null;
		let view = null;
		let cursor = '';
		let apart = null; // the drawing's pose, fitted to .pose.parts
		let scrolled = false; // past the top of the scene: no focus here
		const lctx = lines.getContext('2d');
		const space = getComputedStyle(root).getPropertyValue('--space').trim() || '#050506';

		function resize() {
			W = stage.clientWidth;
			H = stage.clientHeight;
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = lines.width = Math.round(W * dpr);
			canvas.height = lines.height = Math.round(H * dpr);
			stars();
			const s = stage.getBoundingClientRect();
			rest = pose(restBox, s, heart);
			near = pose(focusBox, s, model.bounds);
			apart = drawing(partsBox, s);
			const rc = getComputedStyle(root);
			dim = parseFloat(rc.getPropertyValue('--rest-strength')) || 1;
			behind = parseFloat(rc.getPropertyValue('--words-behind')) || 0;
			const h = hotBox.getBoundingClientRect();
			hot = [h.left - s.left, h.top - s.top, h.right - s.left, h.bottom - s.top];
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

		kick = () => {
			if (phase !== 'wait' || !ready || seen < 0.35) return;
			if (still) {
				// nothing plays: the board rests, and comes forward when asked
				phase = 'live';
				paint();
				return;
			}
			phase = 'intro';
			t0 = clock;
			run(true);
		};

		function step(dt) {
			if (phase === 'intro' && clock - t0 > BUILD + plan.end + HOLD) {
				phase = 'live';
				liveAt = clock;
				inside = false; // only a fresh move into the region brings it forward
			}
			if (phase === 'live') {
				if (scrolled) {
					if (target === 1) shut();
				} else if (inside || focused || clock < tapUntil) {
					target = 1;
					closeAt = Infinity;
				} else if (target === 1) {
					if (closeAt === Infinity) closeAt = clock + LINGER;
					if (clock >= closeAt) shut();
				}
				if (pick < 0 && clock > nextDrift) {
					const k = Math.floor(Math.random() * model.lanes.length);
					drift.push({ lane: k, t0: clock, dur: plan.lanes[k].dur * 1.2 });
					nextDrift = clock + 0.08 + Math.random() * 0.2;
				}
			}
			const rate = target > focus ? 4 : 2.8;
			focus += (target - focus) * (1 - Math.exp(-dt * rate));
		}

		function shut() {
			target = 0;
			closeAt = Infinity;
			hover = -1;
			pinned = -1;
			mod = -1;
		}

		// With reduced motion nothing animates: focus comes and goes at once.
		function snap() {
			if (!still || phase !== 'live') return;
			if (inside || focused || tapUntil > 0) focus = target = 1;
			else {
				shut();
				focus = 0;
			}
			paint();
		}

		function frame(now) {
			raf = requestAnimationFrame(frame);
			const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
			last = now;
			clock += dt;
			step(dt);
			paint();
		}

		// Animate only while the stage is on screen.
		function run(on) {
			if (still) {
				if (on) paint();
				return;
			}
			if (on && !raf) {
				last = 0;
				raf = requestAnimationFrame(frame);
			} else if (!on && raf) {
				cancelAnimationFrame(raf);
				raf = 0;
			}
		}

		function paint() {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W, H);
			lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			lctx.clearRect(0, 0, W, H);
			const t = through();
			scrolled = t > LEAVE[0];
			// with reduced motion the scene jumps between its two ends
			const at = (a) => (still ? (t > 0.3 ? 1 : 0) : smooth(a[0], a[1], t));
			const m = at(MORPH);
			const x = at(APART);
			root.style.setProperty('--claim', at(CLAIM).toFixed(3));
			if (claim) claim.inert = at(CLAIM) < 0.5;
			if (phase === 'wait' || !W || !H || !rest) {
				view = null;
				for (const t of tags) if (t) t.style.opacity = '0';
				if (callout) callout.style.opacity = '0';
				if (card) card.style.opacity = '0';
				return;
			}
			const e = ease(focus);
			view = makeView({
				...blend(blend(rest, near, e), apart, ease(m)),
				px: model.core.x,
				pz: model.core.z,
				pull: 1
			});
			const intro = phase === 'intro' ? clock - t0 : Infinity;
			const since = phase === 'live' ? (still ? Infinity : clock - liveAt) : -1;
			// the processor is the whole of marketing: once the board has settled, its lid says so
			const mark = smooth(0.4, 1.2, since) * (1 - smooth(0.04, 0.5, focus));
			// a chip in focus lights its own traces; an open card lights its pillar
			let lit = null;
			if (focus > 0.6 && pick >= 0) lit = { cell: pick, ...model.touch[pick] };
			else if (focus > 0.6 && mod > 0) lit = { cell: -1, lanes: [], cells: ringCells.get(mod) };
			const pulses = [];
			flash.fill(0);
			let glow;
			if (phase === 'intro') {
				const tc = intro - BUILD;
				cascade(tc, pulses);
				glow = 0.12 + 0.88 * smooth(plan.end - 0.3, plan.end + 0.15, tc);
			} else {
				glow = still ? 1 : 0.82 + 0.18 * Math.sin(clock * 2.2);
				if (!still) flow(lit, pulses);
			}
			// the opening plays at full strength, then settles back to rest
			const opening = phase === 'intro' ? 1 : 1 - smooth(0, 1.2, since);
			// (nothing to paint once it has fully given way to the drawing)
			if (m < 0.7) drawBoard(ctx, model, view, {
				alpha: lerp(dim, 1, Math.max(e, opening)),
				fog: 1 - 0.8 * e, // depth haze at rest, nearly clear in focus
				intro,
				pulses,
				lit,
				flash,
				glow,
				em,
				dpr,
				mark: { a: mark, ...c.chip, logo },
				font
			});
			// the render gives way to the drawing, which then comes apart
			canvas.style.opacity = String(1 - smooth(0.2, 0.7, m));
			const drawn = smooth(0.15, 0.6, m);
			lines.style.opacity = String(drawn);
			const guides = smooth(0.3, 0.9, x) * drawn;
			if (drawn > 0.003) {
				const anchors = drawExploded(lctx, view, model, {
					p: ease(x),
					guides,
					mark: c.chip,
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
			} else for (const el of marks) if (el) el.style.opacity = '0';
			overlays(intro, e, mark, 1 - at(LEAVE));

			const want = focus > 0.6 && hover >= 0 ? 'pointer' : '';
			if (want !== cursor) root.style.cursor = cursor = want;
		}

		// The opening: each trace fires on its schedule, and a chip
		// flashes as a pulse leaves it and again as one arrives.
		function cascade(tc, out) {
			plan.lanes.forEach((q, k) => {
				const L = model.lanes[k];
				const p = (tc - q.start) / q.dur;
				if (p < 0) return;
				if (p < 1.3) out.push({ lane: k, p: Math.min(p, 1), dir: -1, w: p > 1 ? (1.3 - p) / 0.3 : 1 });
				flash[L.outer] = Math.max(flash[L.outer], 0.5 * Math.exp(-(tc - q.start) * 6));
				if (p >= 1) flash[L.inner] = Math.max(flash[L.inner], Math.exp(-(tc - q.start - q.dur) * 4));
			});
		}

		// Once it is live: a chip in focus runs pulses along its own
		// traces, in the direction its values flow; otherwise a few
		// wander in from the edges.
		function flow(lit, out) {
			if (lit && lit.cell >= 0) {
				for (const k of lit.lanes) {
					const L = model.lanes[k];
					const dir = L.from === L.inner ? 1 : -1;
					out.push({ lane: k, p: (clock * 0.7 + noise(k)) % 1, dir, w: 0.9 });
				}
				return;
			}
			for (let j = drift.length - 1; j >= 0; j--) {
				const d = drift[j];
				const p = (clock - d.t0) / d.dur;
				if (p >= 1.3) drift.splice(j, 1);
				else out.push({ lane: d.lane, p: Math.min(p, 1), dir: DRIFT, w: 0.85 * (p > 1 ? (1.3 - p) / 0.3 : 1) });
			}
		}

		/* The page's share of the focus goes to CSS as variables (see
		   .home in the styles), with where the processor is, for the
		   fade and the haze to centre on. The words fade out as the
		   board comes forward and back in behind it, so the swap of
		   which is on top happens while they cannot be seen. Labels
		   ride on their parts, the card under its pillar's name, the
		   callout on its chip. */
		function overlays(intro, e, mark, hero) {
			const r = root.style;
			r.setProperty('--f', e.toFixed(3));
			r.setProperty('--words', ((e < 0.5 ? 1 - 2 * e : (2 * e - 1) * behind) * hero).toFixed(3));
			r.setProperty('--hint', (mark * hero).toFixed(3));
			r.setProperty('--hero', hero.toFixed(3));
			if (hero < 0.5 !== root.hasAttribute('data-away')) root.toggleAttribute('data-away', hero < 0.5);
			project(view, model.core.x, 0, model.core.z, 1, A);
			r.setProperty('--mx', `${A[0].toFixed(1)}px`);
			r.setProperty('--my', `${A[1].toFixed(1)}px`);
			if (e > 0.5 !== front) {
				front = e > 0.5;
				root.toggleAttribute('data-front', front);
			}
			const shows = smooth(0.6, 1, focus);
			let cardAt = null;
			for (const p of model.parts) {
				const tag = tags[p.ring];
				if (!tag) continue;
				project(view, p.x0, p.h + (p.kind === 'memory' ? p.rise : 0), p.z0, 1, A);
				tag.style.transform = `translate(${A[0].toFixed(1)}px, ${(A[1] - 10).toFixed(1)}px) translateY(-100%)`;
				tag.style.opacity = String(partIn(intro, p.ring) * shows);
				// the pillar names are buttons, but only once they can be seen
				tag.style.pointerEvents = p.ring && shows > 0.5 ? 'auto' : 'none';
				if (p.ring === mod) cardAt = [A[0], A[1]];
			}
			if (card) {
				// just under its name, kept inside the stage
				if (!cardAt || shows < 0.5) card.style.opacity = '0';
				else {
					const x = clamp(cardAt[0], 8, Math.max(8, W - card.offsetWidth - 8));
					const y = clamp(cardAt[1] - 4, 8, Math.max(8, H - card.offsetHeight - 8));
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

		/* ---- input ------------------------------------------- */

		const local = (e) => {
			const r = stage.getBoundingClientRect();
			return [e.clientX - r.left, e.clientY - r.top];
		};
		const inHot = (x, y) => !!hot && x >= hot[0] && x <= hot[2] && y >= hot[1] && y <= hot[3];

		// Resting, only the hover region brings the board forward; in
		// focus, it stays for as long as the pointer is over the board.
		function over(x, y) {
			if (!view || phase !== 'live' || scrolled) return false;
			return inHot(x, y) || (focus > 0.5 && onBoard(model, view, x, y));
		}

		function onMove(e) {
			if (e.pointerType !== 'mouse') return;
			const [x, y] = local(e);
			// the nav bar stays the nav bar
			inside = over(x, y) && !e.target.closest?.('.bar');
			hover = inside && focus > 0.6 ? hitCell(model, view, x, y) : -1;
			snap();
		}

		function onLeave(e) {
			if (e.pointerType !== 'mouse') return;
			inside = false;
			hover = -1;
			snap();
		}

		function onDown(e) {
			// a press on a pillar name or the nav is a click, nothing more
			if (e.button !== 0 || e.target.closest?.('button, a')) return;
			const [x, y] = local(e);
			press = { id: e.pointerId, x, y };
		}

		// On touch, a tap in the region brings the board forward, the
		// next picks a chip, and a tap off the board sends it back.
		function onUp(e) {
			if (!press || press.id !== e.pointerId) return;
			const [x, y] = local(e);
			const moved = Math.hypot(x - press.x, y - press.y) > 8; // a swipe, scrolling the page
			press = null;
			if (moved || phase !== 'live') return;
			if (e.pointerType === 'mouse') {
				mod = -1; // a click on the board puts the card away
				if (still) paint();
				return;
			}
			if (focus < 0.6) {
				if (inHot(x, y)) tapUntil = still ? 1 : clock + 8;
				snap();
				return;
			}
			if (!over(x, y)) {
				tapUntil = 0;
				snap();
				return;
			}
			pinned = hitCell(model, view, x, y);
			tapUntil = still ? 1 : clock + 8;
			if (still) paint();
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
			if (touch) tapUntil = still ? 1 : clock + 8;
			if (still) paint();
		}

		// Keyboard: Tab in to bring it forward, arrows to walk the chips,
		// Esc to leave. Focus counts anywhere inside, pillar names included.
		function onFocusIn(e) {
			if (e.target.matches(':focus-visible')) {
				focused = true;
				snap();
			}
		}
		function onFocusOut(e) {
			if (stage.contains(e.relatedTarget)) return;
			focused = false;
			pinned = -1;
			mod = -1;
			snap();
		}
		function onKey(e) {
			const n = NODES.length;
			if (e.key === 'ArrowRight') pinned = pick < 0 ? 0 : (pick + 1) % n;
			else if (e.key === 'ArrowLeft') pinned = pick < 0 ? n - 1 : (pick - 1 + n) % n;
			else if (e.key === 'Escape') {
				pinned = -1;
				mod = -1;
				stage.blur();
				return;
			} else return;
			e.preventDefault();
			focused = true;
			if (still) paint();
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
		stage.addEventListener('click', onClick, on);
		stage.addEventListener('focusin', onFocusIn, on);
		stage.addEventListener('focusout', onFocusOut, on);
		stage.addEventListener('keydown', onKey, on);
		document.addEventListener('visibilitychange', () => run(seen > 0 && !document.hidden), on);
		// while it animates every frame reads the scroll; otherwise repaint on it
		addEventListener(
			'scroll',
			() => {
				if (!raf) paint();
			},
			{ passive: true, signal: off.signal }
		);

		const ro = new ResizeObserver(resize);
		ro.observe(stage);

		// The opening waits for the curtain and for the stage to be in view.
		const io = new IntersectionObserver(
			([entry]) => {
				seen = entry.isIntersecting ? entry.intersectionRatio : 0;
				kick();
				run(seen > 0 && phase !== 'wait' && !document.hidden);
			},
			{ threshold: [0, 0.35, 0.7] }
		);
		io.observe(stage);

		return () => {
			kick = () => {};
			run(false);
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
<div class="home" class:outline={SHOW_POSES} bind:this={root}>
	<div class="space" aria-hidden="true"><canvas bind:this={sky}></canvas></div>

	<h1 class="words" aria-label="{c.words.join(', ')} {c.chip.name.toLowerCase()}">
		<span>{c.words[0]}</span>
		<span>{c.words[1]}</span>
	</h1>

	<div class="pose rest" bind:this={restBox} aria-hidden="true"></div>
	<div class="pose focus" bind:this={focusBox} aria-hidden="true"></div>
	<div class="pose parts" bind:this={partsBox} aria-hidden="true"></div>
	<div class="hot" bind:this={hotBox} aria-hidden="true"></div>
	<div class="scrim" aria-hidden="true"></div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="stage"
		bind:this={stage}
		tabindex="0"
		role="group"
		aria-label={c.alt}
		aria-describedby="board-parts"
	>
		<canvas class="circuit" bind:this={canvas} aria-hidden="true"></canvas>
		<canvas class="drawing" bind:this={lines} aria-hidden="true"></canvas>
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
	</div>

	<header class="bar jf-s-wrap">
		<a class="brand" href="/" aria-label="{identity.brand.wordmark}, home">
			<img src={identity.brand.logo} alt="" />
			<span>{identity.brand.wordmark}</span>
		</a>
		<nav class="links" aria-label="Page">
			{#each hero.nav as n}
				<button type="button" onclick={() => goto(n.goto)}>{n.label}</button>
			{/each}
		</nav>
		<a class="jf-s-btn primary small" href={enquiry.href}>{enquiry.label}</a>
	</header>

	<p class="hint">{touch ? c.hint.tap : c.hint.hover}</p>

	<div class="claim" bind:this={claim}>
		<Claim {goto} />
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
</div>
</div>

<style>
	/* Layers, bottom to top: space, the circuit, the words (with the
	   nav and hint), the scrim, and the vignette over it all. In focus
	   the circuit moves above the scrim, so everything else goes dark
	   under it. */
	/* The scene: as tall as --run, with the screen pinned inside it the
	   whole way. The longer it runs, the slower the scroll plays it. */
	.scene {
		--run: 300dvh;
		position: relative;
		height: var(--run);
	}

	.home {
		--space: #050506;
		/* At rest the parts and traces show this strongly, 0–1 (the
		   processor and the pulses always at full). In focus, all of it. */
		--rest-strength: 0.75;
		/* The circuit fades out this far from the processor: at rest,
		   so it melts into space, and in focus, so all of it shows. */
		--fade-rest: 44vmax;
		--fade-focus: 150vmax;
		/* The green haze around the processor, 0–1. */
		--haze: 0.14;
		/* What the rest of the page goes under in focus, and how much of
		   the words still shows through it, 0–1. */
		--scrim: rgba(2, 2, 3, 0.95);
		--words-behind: 0.12;
		/* Set by the script every frame: --f is the focus, 0–1; --words
		   and --hint drive the words and the hint; --mx and --my are
		   where the processor is on screen. */
		--f: 0;
		--words: 1;
		--hint: 0;
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
		background: radial-gradient(
			circle 60vmax at var(--mx) var(--my),
			color-mix(in srgb, var(--em) calc(var(--haze) * 100%), transparent),
			transparent 70%
		);
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
	   past it into the fade; in focus, the whole circuit is fitted
	   into .pose.focus. Move or resize a box to move the circuit;
	   --zoom scales it past the box about its middle. --az turns it
	   about the vertical (0 is square on) and --el tilts it toward
	   you (90 looks straight down), in degrees. All of it is read on
	   load and resize. Turn on SHOW_POSES in the script to see them. */
	.pose,
	.hot {
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
	/* Taken apart, the whole circuit at its full lift is fitted here. */
	.pose.parts {
		left: 46%;
		top: 9%;
		width: 51%;
		height: 84%;
		--az: -30;
		--el: 34;
	}
	/* Moving into this brings the circuit forward. */
	.hot {
		left: 50%;
		top: 40%;
		width: 42%;
		height: 50%;
	}
	.outline .pose {
		outline: 1px dashed var(--s-grey);
		outline-offset: -1px;
	}
	.outline .hot {
		outline: 1px dashed var(--em);
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
		font-size: min(14.6vw, 27dvh);
		line-height: 0.8;
		letter-spacing: -0.05em;
		text-transform: uppercase;
		text-align: left;
		color: var(--s-white);
		opacity: var(--words);
	}
	.words span {
		display: block;
	}
	.words span + span {
		margin-top: 0.04em;
	}

	.stage {
		position: absolute;
		inset: 0;
		z-index: 1;
		outline: none;
		pointer-events: none; /* the pillar names take it back for themselves */
		user-select: none;
		-webkit-user-select: none;
		-webkit-tap-highlight-color: transparent;
	}
	/* data-front is set from the script, so Svelte can't see it */
	.home:global([data-front]) .stage {
		z-index: 4;
	}
	.stage:focus-visible {
		outline: 1px solid var(--s-line);
		outline-offset: -8px;
	}
	.circuit {
		--fade: calc(var(--fade-rest) + (var(--fade-focus) - var(--fade-rest)) * var(--f));
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		-webkit-mask-image: radial-gradient(circle var(--fade) at var(--mx) var(--my), #000 35%, transparent);
		mask-image: radial-gradient(circle var(--fade) at var(--mx) var(--my), #000 35%, transparent);
	}

	.drawing {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		opacity: 0;
	}
	/* Each part's name on the drawing, at the end of its leader. */
	.part {
		position: absolute;
		left: 0;
		top: 0;
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

	.hint {
		position: absolute;
		left: 0;
		right: 0;
		bottom: var(--pad-y);
		z-index: 2;
		margin: 0;
		opacity: calc(var(--hint) * 0.9);
		pointer-events: none;
		text-align: center;
		font-size: 13px;
		letter-spacing: 0.04em;
		color: var(--s-grey);
	}

	/* ---- on the board in focus ---------------------------- */
	.tag {
		position: absolute;
		left: 0;
		top: 0;
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
		/* a roomier target than the text alone, without moving it */
		margin: -6px -8px;
		padding: 6px 8px;
		background: none;
		border: 0;
		border-radius: 6px;
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
		.hot {
			left: 8%;
			top: 44%;
			width: 84%;
			height: 46%;
		}
		/* apart, the drawing takes the top and the claim the bottom */
		.pose.parts {
			left: 4%;
			top: 6%;
			width: 92%;
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
</style>
