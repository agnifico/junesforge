<script lang="ts">
	import { onMount } from 'svelte';

	/** The rail has four fixed slides. Kept as a real slide list (rather than
	 *  computed from a prop) since this page has no CMS behind it any more. */
	const showTutorials = true;

	type Model = { slug: string; name: string; parts: number };
	type StageEl = HTMLElement & { next: (dir?: number) => void; paused: boolean };

	// Cycle order for the hero viewer.
	const heroCycle = [
		'the-gilded-boar-inn',
		'city-gatehouse',
		'market-fountain',
		'watchtower',
		'dovecote'
	];

	// Marquee row — order matches the design; part counts read off the actual
	// model documents (static/showcase/models) rather than hand-typed.
	const marqueeModels: Model[] = [
		{ slug: 'the-gilded-boar-inn', name: 'The Gilded Boar Inn', parts: 77 },
		{ slug: 'city-gatehouse', name: 'City Gatehouse', parts: 85 },
		{ slug: 'blacksmith-s-forge', name: "Blacksmith's Forge", parts: 57 },
		{ slug: 'market-fountain', name: 'Market Fountain', parts: 60 },
		{ slug: 'watchtower', name: 'Watchtower', parts: 56 },
		{ slug: 'timber-stable', name: 'Timber Stable', parts: 52 },
		{ slug: 'garrison-post', name: 'Garrison Post', parts: 56 },
		{ slug: 'palisade-kit', name: 'Palisade Kit', parts: 94 },
		{ slug: 'dovecote', name: 'Dovecote', parts: 72 },
		{ slug: 'justice-corner', name: 'Justice Corner', parts: 54 }
	];

	// What's currently showing in the hero stage — drives both the caption and
	// "Open this in the editor", which deep-links the app straight to it.
	let heroName = $state('The Gilded Boar Inn');
	let heroSlug = $state('the-gilded-boar-inn');
	let editorHref = $derived(`/propsize/app?sample=${heroSlug}`);

	let heroEl: StageEl | undefined;
	let hostEl: HTMLDivElement | undefined;
	let trackEl: HTMLDivElement | undefined;
	let marqueeEl: HTMLDivElement | undefined;
	let navEl: HTMLElement | undefined;
	let dotsEl: HTMLDivElement | undefined;

	let marqueeRaf = 0;
	let slideCount = 1;
	let activeSlide = -1;
	let io: IntersectionObserver | undefined;

	function goTo(i: number) {
		const n = Math.max(slideCount, 1);
		const clamped = Math.max(0, Math.min(i, n - 1));
		window.scrollTo({ top: clamped * window.innerHeight, behavior: 'smooth' });
	}

	// Slide rail. Earlier versions tried to make vertical scroll drive a
	// *horizontal* rail — first by hand-rolling the position math (a 400vh
	// spacer, a per-frame threshold, a "settle" timer correcting
	// window.scrollY), then by redirecting wheel deltas into a horizontally
	// snapping element's scrollLeft. Both put JS in charge of the actual
	// scroll position on every frame, and both fought real scroll physics —
	// hand-rolled position math fought live trackpad momentum, and scripted
	// scrollLeft writes fought the browser's own CSS snap resolution (which,
	// it turns out, silently reverts any scripted write it doesn't consider
	// final — verified independently, not assumed). Either way: two things
	// touching scroll position at once, which is what read as flicker.
	//
	// This version doesn't convert axes at all. The page scrolls vertically
	// — the same axis a wheel/trackpad/touch gesture already produces — and
	// `scroll-snap-type: y mandatory` (see the styles below) is native CSS
	// snap on real, browser-owned scrolling. JS never touches scroll
	// position during a gesture; it only reads, via IntersectionObserver,
	// which slide ended up in view, to paint the nav/dots.
	function startRail() {
		const track = trackEl;
		if (!track) return;
		const slides = [...track.children].filter((el) =>
			el.hasAttribute('data-slide')
		) as HTMLElement[];
		const n = Math.max(slides.length, 1);
		slideCount = n;

		const navs = navEl ? [...navEl.querySelectorAll<HTMLButtonElement>('[data-nav]')] : [];
		const dots = dotsEl ? [...dotsEl.querySelectorAll<HTMLButtonElement>('[data-dot]')] : [];
		navs.forEach((b, i) => {
			b.style.display = i < n ? '' : 'none';
			b.onclick = () => goTo(i);
		});
		dots.forEach((b, i) => {
			b.style.display = i < n ? '' : 'none';
			b.onclick = () => goTo(i);
		});

		const paint = (i: number) => {
			if (i === activeSlide) return;
			activeSlide = i;
			navs.forEach((b, k) => {
				b.style.color = k === i ? '#e2a35f' : '#6b6e6f';
				b.style.borderBottomColor = k === i ? '#c98a4b' : 'transparent';
			});
			dots.forEach((b, k) => {
				b.style.background = k === i ? '#c98a4b' : '#34383b';
				b.style.width = k === i ? '40px' : '26px';
			});
		};

		// Which slide is "active" is read straight off layout — whichever one
		// is more than half in view — instead of derived from scroll-position
		// math. That makes it impossible for the nav/dots to say one thing
		// while the screen shows another.
		io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.intersectionRatio > 0.5) {
						paint(slides.indexOf(entry.target as HTMLElement));
					}
				}
			},
			{ threshold: [0.5] }
		);
		slides.forEach((s) => io!.observe(s));
		paint(0);

		// Wheel, trackpad, touch swipe, arrow keys, Page Up/Down, space —
		// all native scroll gestures, all handled by the browser with no JS
		// in the loop, all snapping via the CSS on .slide below.
	}

	function startMarquee(speed: number) {
		const track = marqueeEl;
		if (!track) return () => {};
		const cards = [...track.querySelectorAll<HTMLElement>('[data-card]')];
		if (!cards.length) return () => {};
		const gap = 18;
		const step = cards[0].offsetWidth + gap;
		const total = step * cards.length;
		let offset = 0;
		let last = performance.now();
		let hovering = false;

		const onEnter = () => {
			hovering = true;
			cards.forEach((c) => {
				const s = c.querySelector('propsize-stage') as StageEl | null;
				if (s) s.paused = true;
			});
		};
		const onLeave = () => {
			hovering = false;
			cards.forEach((c) => {
				const s = c.querySelector('propsize-stage') as StageEl | null;
				if (s) s.paused = false;
			});
		};
		track.addEventListener('pointerenter', onEnter);
		track.addEventListener('pointerleave', onLeave);

		const frame = (t: number) => {
			const dt = Math.min((t - last) / 1000, 0.1);
			last = t;
			if (!hovering) offset = (offset + speed * dt) % total;
			const w = track.clientWidth;
			cards.forEach((card, i) => {
				let x = i * step - offset;
				if (x < -step) x += total;
				card.style.transform = 'translate3d(' + x + 'px,0,0)';
				card.style.visibility = x > w + step ? 'hidden' : 'visible';
			});
			marqueeRaf = requestAnimationFrame(frame);
		};
		marqueeRaf = requestAnimationFrame(frame);

		return () => {
			track.removeEventListener('pointerenter', onEnter);
			track.removeEventListener('pointerleave', onLeave);
		};
	}

	function goModels() {
		goTo(1);
	}
	function heroPrev() {
		heroEl?.next(-1);
	}
	function heroNext() {
		heroEl?.next(1);
	}

	onMount(() => {
		let stopMarquee = () => {};
		let onModelChange: ((e: Event) => void) | null = null;

		// propsize-stage registers a custom element and touches `window` at
		// module scope, so it's loaded client-side only, after the elements
		// referencing it already exist in the DOM — the browser upgrades them
		// the moment the tag is defined, whichever comes first.
		import('$lib/propsize/showcase/propsize-stage.js').then(() => {
			if (!heroEl) return;
			onModelChange = (e: Event) => {
				const detail = (e as CustomEvent).detail;
				heroName = detail.name;
				heroSlug = detail.slug;
			};
			heroEl.addEventListener('model-change', onModelChange);
		});

		startRail();
		stopMarquee = startMarquee(26);

		return () => {
			cancelAnimationFrame(marqueeRaf);
			io?.disconnect();
			stopMarquee();
			if (heroEl && onModelChange) heroEl.removeEventListener('model-change', onModelChange);
		};
	});
</script>

<svelte:head>
	<title>Propsize — Build props out of boxes and cylinders</title>
	<meta
		name="description"
		content="Propsize is a small browser 3D editor: a tray of primitives, a transform gizmo, real materials, and code emitters for Three.js, R3F and Threlte."
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="page">
	<header class="topbar">
		<a href="/propsize" class="brand">
			<svg viewBox="0 0 24 24" fill="none" stroke="#c98a4b" stroke-width="1.6" class="brand-mark">
				<path d="M12 2.6 21 7.3v9.4L12 21.4 3 16.7V7.3z" />
				<path d="M3 7.3 12 12l9-4.7M12 12v9.4" />
			</svg>
			<span class="brand-name">PROPSIZE</span>
		</a>
		<nav bind:this={navEl} class="topnav">
			<button type="button" data-nav="0">Overview</button>
			<button type="button" data-nav="1">Models</button>
			<button type="button" data-nav="2">Tutorials</button>
			<button type="button" data-nav="3">About</button>
		</nav>
		<div class="topbar-cta">
			<a href="/propsize/app" class="btn-primary">Open the editor</a>
		</div>
	</header>

	<div bind:this={hostEl} class="rail-host">
		<div class="rail-sticky">
			<div bind:this={trackEl} class="rail-track">
				<section data-slide="0" data-screen-label="01 Hero" class="slide slide-hero">
					<div class="slide-inner hero-grid">
						<div>
							<div class="eyebrow">
								<span>3D fundamentals, nothing more</span>
								<span class="eyebrow-rule"></span>
								<span>No install · runs in the tab</span>
							</div>
							<h1 class="h1">
								<span class="h1-line">Build props out of</span>
								<span class="h1-line h1-accent">boxes and cylinders.</span>
							</h1>
							<p class="lede">
								Propsize is a small browser 3D editor: a tray of primitives, a transform gizmo, real
								materials, and code emitters for Three.js, R3F and Threlte. Everything on this page
								was made with those parts alone.
							</p>
							<div class="hero-actions">
								<a href="/propsize/app" class="btn-primary btn-lg">Start building</a>
								<button type="button" class="btn-secondary" onclick={goModels}
									>See what came out of it</button
								>
							</div>
							<div class="scroll-hint">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
									><path d="M12 4v14M7 13l5 5 5-5" /></svg
								>
								Scroll ↓ one section at a time
							</div>
						</div>

						<div class="hero-panel">
							<div class="hero-panel-bar">
								<span class="hero-panel-label">Live · drag to orbit</span>
								<span class="hero-panel-nav">
									<button
										type="button"
										onclick={heroPrev}
										aria-label="Previous model"
										class="icon-btn"
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
											><path d="M15 5l-7 7 7 7" /></svg
										>
									</button>
									<button type="button" onclick={heroNext} aria-label="Next model" class="icon-btn">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
											><path d="M9 5l7 7-7 7" /></svg
										>
									</button>
								</span>
							</div>
							<div class="hero-stage-wrap">
								<propsize-stage
									bind:this={heroEl}
									priority="1"
									orbit="1"
									zoom="1"
									autorotate="0.14"
									cycle-ms="7000"
									cycle={heroCycle.join(',')}
									base="/showcase/models/"
									class="hero-stage"
								></propsize-stage>
								<div class="hero-caption">
									<div>
										<div class="hero-caption-name">{heroName}</div>
										<div class="hero-caption-sub">primitives only · flat shaded</div>
									</div>
									<a href={editorHref} class="open-editor-link">Open this in the editor →</a>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section data-slide="1" data-screen-label="02 Models" class="slide slide-models">
					<div class="models-cards">
						<div class="info-card">
							<div class="info-eyebrow">01 / PLACE</div>
							<h3 class="info-title">Drop a primitive</h3>
							<p class="info-body">
								Box, cylinder, cone, sphere, icosahedron, torus, lathe. Snap them to a half-unit
								grid so parts actually meet.
							</p>
						</div>
						<div class="info-card">
							<div class="info-eyebrow">02 / DRESS</div>
							<h3 class="info-title">Group and surface it</h3>
							<p class="info-body">
								Name things, nest them, share one material across a whole roof. Flat shading does
								most of the styling for you.
							</p>
						</div>
						<div class="info-card">
							<div class="info-eyebrow">03 / TAKE IT</div>
							<h3 class="info-title">Emit the code</h3>
							<p class="info-body">
								Ready-to-paste Three.js, R3F or Threlte — or a scene document you can load straight
								back in. No runtime, no lock-in.
							</p>
						</div>
					</div>

					<div class="models-heading">
						<div>
							<div class="section-eyebrow">The medieval town pack</div>
							<h2 class="h2">Example models</h2>
						</div>
						<p class="models-sub">
							Hover to stop the drift and turn one yourself. Nothing here was modelled elsewhere —
							no meshes were imported.
						</p>
					</div>

					<div bind:this={marqueeEl} class="marquee">
						{#each marqueeModels as m (m.slug)}
							<div data-card={m.slug} class="marquee-card">
								<propsize-stage orbit="1" autorotate="0.2" model={m.slug} base="/showcase/models/"
								></propsize-stage>
								<div class="marquee-card-foot">
									<span class="marquee-card-name">{m.name}</span>
									<span class="marquee-card-parts">{m.parts} parts</span>
								</div>
							</div>
						{/each}
					</div>
				</section>

				{#if showTutorials}
					<section id="tutorials" data-slide="2" data-screen-label="03 Tutorials" class="slide slide-tutorials">
						<div class="slide-inner">
							<div class="models-heading">
								<div>
									<div class="section-eyebrow">Tutorials · in progress</div>
									<h2 class="h2">Learn one shape at a time</h2>
								</div>
								<p class="models-sub">
									Short walkthroughs — one per primitive, then one per prop in the pack. Slots are
									reserved below.
								</p>
							</div>
							<div class="tutorial-grid">
								<a href="#tutorials" class="tutorial-card">
									<div class="tutorial-eyebrow">Shape · 01</div>
									<div class="tutorial-title">The box, six ways</div>
									<div class="tutorial-body">
										Walls, beams, roof slopes and why nearly everything starts here.
									</div>
								</a>
								<a href="#tutorials" class="tutorial-card">
									<div class="tutorial-eyebrow">Shape · 02</div>
									<div class="tutorial-title">Cylinders as towers</div>
									<div class="tutorial-body">
										Segment counts, tapers, and stacking drums into a keep.
									</div>
								</a>
								<a href="#tutorials" class="tutorial-card">
									<div class="tutorial-eyebrow">Prop · 01</div>
									<div class="tutorial-title">Build the watchtower</div>
									<div class="tutorial-body">
										Base, gallery, spire — fifty-five parts in about twenty minutes.
									</div>
								</a>
								<a href="#tutorials" class="tutorial-card">
									<div class="tutorial-eyebrow">Prop · 02</div>
									<div class="tutorial-title">A modular palisade</div>
									<div class="tutorial-body">
										Making kit pieces that tile: straight, corner, gate, walkway.
									</div>
								</a>
							</div>
						</div>
					</section>
				{/if}

				<section data-slide="3" data-screen-label="04 About" class="slide slide-about">
					<div class="about-wrap">
						<div class="about-card">
							<div class="section-eyebrow">What this actually is</div>
							<p class="about-lede">
								A demonstration piece. Propsize is a complete, working 3D editor — hierarchy,
								gizmos, materials, autosave, export — built to show the kind of tool I can design
								and ship end to end.
							</p>
							<p class="about-body">
								It is free, it needs no account, and it stays in your browser. Open it, make
								something, take the code with you.
							</p>
							<a href="/propsize/app" class="btn-primary">Open the editor</a>
						</div>
						<div class="about-foot">
							<span>PROPSIZE · 3D Fundamentals</span>
							<span class="about-foot-by">by <a href="https://junesforge.com">Junesforge</a></span>
						</div>
					</div>
				</section>
			</div>

			<div bind:this={dotsEl} class="dots">
				<button type="button" data-dot="0" aria-label="Slide 1" class="dot"></button>
				<button type="button" data-dot="1" aria-label="Slide 2" class="dot"></button>
				<button type="button" data-dot="2" aria-label="Slide 3" class="dot"></button>
				<button type="button" data-dot="3" aria-label="Slide 4" class="dot"></button>
			</div>
		</div>
	</div>
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		-webkit-font-smoothing: antialiased;
	}
	/* The rail's actual scroll container — see the rail/slides section below
	   for why it lives here instead of on an inner div. */
	:global(html) {
		scroll-snap-type: y mandatory;
	}
	:global(a) {
		color: #c98a4b;
		text-decoration: none;
	}
	:global(a:hover) {
		color: #e2a35f;
	}
	:global(::selection) {
		background: rgba(201, 138, 75, 0.3);
	}

	.page {
		background: #141516;
		color: #eee9e2;
		font-family: Inter, sans-serif;
	}

	/* ---- header ---------------------------------------------------------- */
	.topbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 24px;
		height: 60px;
		padding: 0 32px;
		background: rgba(20, 21, 22, 0.86);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid #26292b;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.brand-mark {
		width: 20px;
		height: 20px;
	}
	.brand-name {
		font-family: 'Space Grotesk', sans-serif;
		font-weight: 700;
		font-size: 16px;
		letter-spacing: 0.02em;
		color: #eee9e2;
	}
	.topnav {
		display: flex;
		gap: 4px;
		margin-left: 14px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10.5px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.topnav button {
		background: none;
		border: none;
		border-bottom: 1px solid transparent;
		color: #6b6e6f;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		padding: 4px 8px;
		cursor: pointer;
	}
	.topbar-cta {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	/* ---- buttons ---------------------------------------------------------- */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #c98a4b;
		border: 1px solid #c98a4b;
		color: #1a1408 !important;
		font-weight: 600;
		font-size: 14px;
		padding: 12px 20px;
		border-radius: 7px;
	}
	.btn-primary:hover {
		background: #e2a35f;
		border-color: #e2a35f;
	}
	.topbar-cta .btn-primary {
		font-size: 12.5px;
		padding: 8px 14px;
		gap: 7px;
	}
	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #232628;
		border: 1px solid #34383b;
		color: #eee9e2;
		font-family: Inter, sans-serif;
		font-weight: 500;
		font-size: 14px;
		padding: 12px 18px;
		border-radius: 7px;
		cursor: pointer;
	}
	.btn-secondary:hover {
		border-color: #8a6138;
		color: #e2a35f;
	}
	.icon-btn {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #232628;
		border: 1px solid #34383b;
		border-radius: 5px;
		color: #a3a6a5;
		cursor: pointer;
	}
	.icon-btn:hover {
		color: #e2a35f;
		border-color: #8a6138;
	}
	.icon-btn svg {
		width: 13px;
		height: 13px;
	}

	/* ---- rail / slides ----------------------------------------------------- */
	/* The page scrolls on its real, native axis — vertically, the same axis
	   a wheel/trackpad/touch gesture already produces — so there's no JS
	   axis-conversion in the loop to fight the browser's own snap
	   resolution. `scroll-snap-type` lives on html because that's the
	   element that actually scrolls here (no inner overflow container). */
	.rail-host,
	.rail-sticky,
	.rail-track {
		display: block;
	}
	.slide {
		width: 100%;
		height: 100vh;
		box-sizing: border-box;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}
	.slide-inner {
		max-width: 1240px;
		width: 100%;
		margin: 0 auto;
	}

	/* ---- slide 1: hero ------------------------------------------------------ */
	.slide-hero {
		padding: 60px 32px 0;
		background: radial-gradient(ellipse 900px 520px at 70% 34%, #23262a 0%, #141516 72%);
	}
	.hero-grid {
		max-width: 1240px;
		height: 100%;
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr);
		gap: 56px;
		align-items: center;
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: #6b6e6f;
		margin-bottom: 20px;
	}
	.eyebrow-rule {
		width: 14px;
		height: 1px;
		background: #34383b;
	}
	.h1 {
		font-family: 'Space Grotesk', sans-serif;
		font-weight: 700;
		font-size: clamp(34px, 3.6vw, 54px);
		line-height: 1.06;
		letter-spacing: -0.022em;
		margin: 0 0 20px;
	}
	.h1-line {
		display: block;
		white-space: nowrap;
	}
	.h1-accent {
		color: #e2a35f;
	}
	.lede {
		font-size: 16px;
		line-height: 1.65;
		color: #a3a6a5;
		margin: 0 0 28px;
		max-width: 46ch;
		text-wrap: pretty;
	}
	.hero-actions {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
	}
	.scroll-hint {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-top: 38px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #6b6e6f;
	}
	.scroll-hint svg {
		width: 14px;
		height: 14px;
	}

	.hero-panel {
		position: relative;
		border: 1px solid #34383b;
		border-radius: 12px;
		background: linear-gradient(180deg, #1e2123, #171819);
		box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}
	.hero-panel-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 12px;
		border-bottom: 1px solid #26292b;
		background: #1c1e20;
	}
	.hero-panel-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 9.5px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #6b6e6f;
	}
	.hero-panel-nav {
		margin-left: auto;
		display: flex;
		gap: 5px;
	}
	.hero-stage-wrap {
		position: relative;
		background: radial-gradient(ellipse at 50% 32%, #23262a 0%, #131415 78%);
	}
	:global(.hero-stage) {
		display: block;
		width: 100%;
		height: min(56vh, 440px);
	}
	.hero-caption {
		position: absolute;
		left: 14px;
		bottom: 14px;
		right: 14px;
		display: flex;
		align-items: flex-end;
		gap: 12px;
		pointer-events: none;
	}
	.hero-caption-name {
		font-family: 'Space Grotesk', sans-serif;
		font-weight: 600;
		font-size: 16px;
		color: #f0d3ab;
	}
	.hero-caption-sub {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.06em;
		color: #8a6138;
		margin-top: 3px;
	}
	.open-editor-link {
		margin-left: auto;
		pointer-events: auto;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(28, 30, 32, 0.9);
		border: 1px solid #34383b;
		color: #eee9e2 !important;
		font-size: 12px;
		font-weight: 500;
		padding: 7px 12px;
		border-radius: 6px;
	}
	.open-editor-link:hover {
		border-color: #c98a4b;
		color: #e2a35f !important;
	}

	/* ---- slide 2: models ---------------------------------------------------- */
	.slide-models {
		padding: 60px 0 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: min(26px, 2.4vh);
	}
	.models-cards {
		max-width: 1240px;
		width: 100%;
		margin: 0 auto;
		padding: 0 32px;
		box-sizing: border-box;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
	}
	.info-card {
		padding: 20px;
		background: #1a1c1e;
		border: 1px solid #26292b;
		border-radius: 10px;
	}
	.info-eyebrow {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.1em;
		color: #8a6138;
		margin-bottom: 10px;
	}
	.info-title {
		font-family: 'Space Grotesk', sans-serif;
		font-weight: 600;
		font-size: 17px;
		margin: 0 0 7px;
	}
	.info-body {
		font-size: 13px;
		line-height: 1.6;
		color: #a3a6a5;
		margin: 0;
		text-wrap: pretty;
	}

	.models-heading {
		max-width: 1240px;
		width: 100%;
		margin: 0 auto;
		padding: 0 32px;
		box-sizing: border-box;
		display: flex;
		align-items: flex-end;
		gap: 24px;
		flex-wrap: wrap;
	}
	.section-eyebrow {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #c98a4b;
		margin-bottom: 9px;
	}
	.h2 {
		font-family: 'Space Grotesk', sans-serif;
		font-weight: 700;
		font-size: 32px;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.models-sub {
		margin: 0 0 4px auto;
		max-width: 38ch;
		font-size: 13px;
		line-height: 1.6;
		color: #a3a6a5;
		text-wrap: pretty;
	}

	.marquee {
		position: relative;
		height: clamp(186px, 30vh, 262px);
		flex: none;
		overflow: hidden;
		border-top: 1px solid #26292b;
		border-bottom: 1px solid #26292b;
		background: linear-gradient(180deg, #171819, #141516);
	}
	.marquee-card {
		position: absolute;
		top: 14px;
		bottom: 14px;
		left: 0;
		width: 290px;
		display: flex;
		flex-direction: column;
		border: 1px solid #26292b;
		border-radius: 10px;
		background: #1a1c1e;
		overflow: hidden;
		will-change: transform;
	}
	.marquee-card :global(propsize-stage) {
		display: block;
		width: 100%;
		flex: 1;
		min-height: 0;
	}
	.marquee-card-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 11px;
		height: 40px;
		border-top: 1px solid #26292b;
	}
	.marquee-card-name {
		font-size: 12.5px;
		font-weight: 500;
		color: #eee9e2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.marquee-card-parts {
		margin-left: auto;
		font-family: 'JetBrains Mono', monospace;
		font-size: 9.5px;
		color: #6b6e6f;
		flex: none;
	}

	/* ---- slide 3: tutorials -------------------------------------------------- */
	.slide-tutorials {
		padding: 60px 32px 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.tutorial-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 14px;
	}
	.tutorial-card {
		display: block;
		padding: 18px;
		background: #1a1c1e;
		border: 1px dashed #34383b;
		border-radius: 10px;
	}
	.tutorial-card:hover {
		border-color: #8a6138;
		background: #1e2123;
	}
	.tutorial-eyebrow {
		font-family: 'JetBrains Mono', monospace;
		font-size: 9.5px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #6b6e6f;
		margin-bottom: 10px;
	}
	.tutorial-title {
		font-family: 'Space Grotesk', sans-serif;
		font-weight: 600;
		font-size: 16px;
		color: #eee9e2;
		margin-bottom: 6px;
	}
	.tutorial-body {
		font-size: 12.5px;
		line-height: 1.6;
		color: #6b6e6f;
	}

	/* ---- slide 4: about -------------------------------------------------- */
	.slide-about {
		padding: 60px 32px 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.about-wrap {
		max-width: 820px;
		width: 100%;
		margin: 0 auto;
	}
	.about-card {
		padding: 40px;
		background: linear-gradient(160deg, #1e2123, #171819);
		border: 1px solid #34383b;
		border-radius: 12px;
	}
	.about-lede {
		font-size: 17px;
		line-height: 1.65;
		color: #eee9e2;
		margin: 0 0 14px;
		text-wrap: pretty;
	}
	.about-body {
		font-size: 14.5px;
		line-height: 1.7;
		color: #a3a6a5;
		margin: 0 0 26px;
		text-wrap: pretty;
	}
	.about-foot {
		display: flex;
		align-items: center;
		gap: 18px;
		flex-wrap: wrap;
		margin-top: 22px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: #6b6e6f;
	}
	.about-foot-by {
		margin-left: auto;
	}

	/* ---- dots -------------------------------------------------------------- */
	.dots {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 22px;
		z-index: 35;
		display: flex;
		justify-content: center;
		gap: 7px;
		pointer-events: none;
	}
	.dot {
		pointer-events: auto;
		width: 26px;
		height: 4px;
		border: none;
		border-radius: 2px;
		background: #34383b;
		padding: 0;
		cursor: pointer;
	}
</style>
