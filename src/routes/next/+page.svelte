<script>
	/* =========================================================
	   STUDIO HOME (staging) — the freelance-facing junesforge.
	   Same screens as the deck, but in normal document flow:
	   the page scrolls like any other, and the locked Design /
	   Code / Contact panels sit in it exactly as they render in
	   the deck. Swap this into `/` once it has been reviewed.
	   Content lives in $lib/v2/content.js — not in here.
	   ========================================================= */
	import { onMount } from 'svelte';
	import '$lib/v2/theme.css';
	import '$lib/v2/studio.css';
	import { STUDIO_LABELS, studioMeta, enquiry } from '$lib/v2/content.js';
	import Curtain from '$lib/v2/Curtain.svelte';

	import Board from '$lib/v2/panels/Board.svelte';
	import Design from '$lib/v2/panels/Design.svelte';
	import Code from '$lib/v2/panels/Code.svelte';
	import Work from '$lib/v2/panels/Work.svelte';
	import Why from '$lib/v2/panels/Why.svelte';
	import Process from '$lib/v2/panels/Process.svelte';
	import Packages from '$lib/v2/panels/Packages.svelte';
	import Contact from '$lib/v2/panels/Contact.svelte';

	const PARALLAX = 1;

	/* `frame`: composed for exactly one viewport (the locked split panels).
	   `auto`: as tall as its content. Neither: at least one screenful. */
	const SCREENS = [
		// the hero and the circuit taken apart, one pinned scroll scene
		{ Panel: Board, ground: 'jf-s-dark', light: false },
		{ Panel: Design, ground: 'jf-light', light: true, frame: true },
		{ Panel: Code, ground: 'jf-dark', light: false, frame: true },
		// a dark brick ground, the Design mark's rust taken down, so the white cards stand out
		{ Panel: Work, ground: 'jf-s-brick', light: false, auto: true },
		// the agencies argument: the receipt, the charges answered, the close
		{ Panel: Why, ground: 'jf-s-dark', light: false, auto: true },
		{ Panel: Process, ground: 'jf-s-light', light: true, auto: true },
		// ways to work together and the questions, one screen
		{ Panel: Packages, ground: 'jf-s-dark', light: false, auto: true },
		{ Panel: Contact, ground: 'jf-forest', light: false, pad: true }
	];
	const N = SCREENS.length;

	let i = $state(0); // the screen under the middle of the viewport
	let seen = $state(SCREENS.map(() => false));
	let mounted = $state(false);
	let ready = $state(false); // flips when the curtain lifts
	let progress = $state(0);
	let px = $state(0);
	let py = $state(0);
	let els = [];
	let raf = null;

	const onLight = $derived(SCREENS[i].light);

	/* Before mount there is no state at all, so the server-rendered page is
	   fully visible; after it, a screen eases in the first time it is seen
	   and then stays put (re-hiding on the way back up reads as broken in a
	   page that scrolls). */
	function stateOf(k) {
		if (!mounted) return undefined;
		return ready && seen[k] ? 'active' : 'after';
	}

	function go(k) {
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		els[k]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
	}

	onMount(() => {
		mounted = true;

		const seenIO = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) seen[els.indexOf(e.target)] = true;
				}
			},
			{ threshold: 0.15 }
		);
		// A zero-height band across the middle of the viewport: whichever
		// screen crosses it is the current one.
		const currentIO = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) i = els.indexOf(e.target);
				}
			},
			{ rootMargin: '-50% 0px -50% 0px' }
		);
		for (const el of els) {
			seenIO.observe(el);
			currentIO.observe(el);
		}

		const onScroll = () => {
			const max = document.documentElement.scrollHeight - innerHeight;
			progress = max > 0 ? scrollY / max : 0;
		};

		const onMove = (e) => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = null;
				px = e.clientX / innerWidth - 0.5;
				py = e.clientY / innerHeight - 0.5;
			});
		};

		document.documentElement.classList.add('jf-studio-doc');
		onScroll();
		addEventListener('scroll', onScroll, { passive: true });
		addEventListener('resize', onScroll);
		addEventListener('mousemove', onMove);

		return () => {
			document.documentElement.classList.remove('jf-studio-doc');
			seenIO.disconnect();
			currentIO.disconnect();
			removeEventListener('scroll', onScroll);
			removeEventListener('resize', onScroll);
			removeEventListener('mousemove', onMove);
			if (raf) cancelAnimationFrame(raf);
		};
	});
</script>

<svelte:head>
	<title>{studioMeta.title}</title>
	<meta name="description" content={studioMeta.description} />
	<!-- Staging: keep it out of search until it replaces `/`. -->
	<meta name="robots" content="noindex" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<!-- Schibsted Grotesk for the studio sections; the other three are what
	     the locked panels and the curtain are set in. -->
	<link
		href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..900&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400&family=Martian+Mono:wght@300;400;600&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,600;1,6..72,300&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="jf-root jf-studio" style="--px:{px * PARALLAX}; --py:{py * PARALLAX}">
	{#each SCREENS as s, k (k)}
		{@const Panel = s.Panel}
		<section
			bind:this={els[k]}
			id={STUDIO_LABELS[k].toLowerCase()}
			class="jf-screen {s.ground}"
			class:jf-frame={s.frame}
			class:jf-s-auto={s.auto}
			class:jf-pad={s.pad}
			data-state={stateOf(k)}
			aria-label={STUDIO_LABELS[k]}
		>
			<Panel goto={go} active={k === i} {ready} />
		</section>
	{/each}

	<nav class="jf-rail" aria-label="Sections">
		<span class="jf-rail-label" style="color:{onLight ? '#0e0e0e' : 'var(--em)'}">
			0{i + 1} — {STUDIO_LABELS[i]}
		</span>
		{#each STUDIO_LABELS as label, k (k)}
			<button
				type="button"
				title={label}
				aria-label={label}
				aria-current={k === i ? 'true' : undefined}
				onclick={() => go(k)}
			>
				<span
					style="width:{k === i ? 30 : 12}px; height:{k === i ? 3 : 2}px;
					       background:{k === i
						? onLight
							? '#0e0e0e'
							: 'var(--em)'
						: onLight
							? 'rgba(14,14,14,.4)'
							: 'rgba(244,244,241,.4)'}"
				></span>
			</button>
		{/each}
	</nav>

	<div class="jf-progress" style="width:{progress * 100}%"></div>

	<a
		class="jf-s-btn primary jf-s-float"
		href={enquiry.href}
		data-hidden={i === 0 || i === N - 1}
		tabindex={i === 0 || i === N - 1 ? -1 : undefined}
	>
		{enquiry.label} <span class="arr">→</span>
	</a>

	<Curtain onDone={() => (ready = true)} />
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
	}
	/* Gated on a class added in onMount, for the same reason as the deck:
	   SvelteKit never unloads a route's stylesheet, so a bare html rule
	   would follow the visitor to every page after this one. */
	:global(html.jf-studio-doc) {
		background: #0e0e0e;
	}
</style>
