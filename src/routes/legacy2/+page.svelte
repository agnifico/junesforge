<script>
	/* =========================================================
	   V2 DECK — 7 full-viewport screens on a single translating
	   stage. Wheel / keys / swipe move one screen at a time;
	   inner scrollable columns get first refusal on the gesture.
	   Content lives in $lib/v2/content.js — not in here.
	   ========================================================= */
	import { onMount } from 'svelte';
	import '$lib/v2/theme.css';
	import { LABELS, meta } from '$lib/v2/content.js';
	import Curtain from '$lib/v2/Curtain.svelte';

	import Identity from '$lib/v2/panels/Identity.svelte';
	import Design from '$lib/v2/panels/Design.svelte';
	import Code from '$lib/v2/panels/Code.svelte';
	import Products from '$lib/v2/panels/Products.svelte';
	import Gallery from '$lib/v2/panels/Gallery.svelte';
	import Roles from '$lib/v2/panels/Roles.svelte';
	import Contact from '$lib/v2/panels/Contact.svelte';

	/* --- tuning knobs (were editor props in the .dc.html) ---- */
	const SLIDE_MS = 900;
	const PARALLAX = 1;
	const SHOW_RAIL_LABELS = true;

	/* screen 0..6 — ground tells the rail which ink to use */
	const SCREENS = [
		{ Panel: Identity, ground: 'jf-dark', pad: true, scroll: true },
		{ Panel: Design, ground: 'jf-light', pad: false, scroll: false },
		{ Panel: Code, ground: 'jf-dark', pad: false, scroll: false },
		// scroll:true now the shelf can wrap to a second row — without it the
		// screen is overflow:hidden and a sixth product would simply vanish.
		// Costs nothing while the cards fit: findScrollable() ignores a
		// container that has no overflow, so the deck keeps the gesture.
		{ Panel: Products, ground: 'jf-dark', pad: false, scroll: true },
		{ Panel: Gallery, ground: 'jf-light', pad: true, scroll: true },
		{ Panel: Roles, ground: 'jf-dark', pad: true, scroll: true },
		{ Panel: Contact, ground: 'jf-forest', pad: true, scroll: true }
	];
	const N = SCREENS.length;

	let i = $state(0);
	let ready = $state(false); // flips when the curtain lifts
	let rootEl = $state(null);
	let px = $state(0);
	let py = $state(0);

	let lock = 0;
	let raf = null;
	let touchY = null;
	let touchX = null;
	let touchHost = null;

	const onLight = $derived(SCREENS[i].ground === 'jf-light');

	/* Deliberately does not touch the URL. An earlier version wrote `#p<n>` here
	   on every move, which made the deck's own position part of the address —
	   and with no popstate/hashchange listener, any history move between two
	   entries differing only by fragment is a *same-document* navigation: the
	   URL changes, nothing re-renders, `i` never updates, and Back appears to do
	   nothing at all. The rail's dots were real `<a href="#pN">` links too, so a
	   click landing before hydration did a native fragment navigation and pushed
	   exactly that kind of entry. Both are gone: the dots are buttons now, and
	   the deck's position is state, not an address. */
	function go(n) {
		const next = Math.max(0, Math.min(N - 1, n));
		if (next !== i) i = next;
	}

	function stateOf(k) {
		if (!ready) return 'after';
		return k === i ? 'active' : k < i ? 'before' : 'after';
	}

	/* Walk up for a scroll container that still has room in the
	   gesture's direction — inner columns win over the deck. */
	function findScrollable(el) {
		while (el && el !== document.body) {
			if (
				el.scrollHeight - el.clientHeight > 8 &&
				/auto|scroll/.test(getComputedStyle(el).overflowY)
			)
				return el;
			el = el.parentElement;
		}
		return null;
	}

	function hasRoom(host, down) {
		if (!host) return false;
		const atTop = host.scrollTop <= 1;
		const atBottom = host.scrollTop + host.clientHeight >= host.scrollHeight - 1;
		return down ? !atBottom : !atTop;
	}

	function step(down) {
		const now = Date.now();
		if (now < lock) return;
		lock = now + SLIDE_MS + 120;
		go(i + (down ? 1 : -1));
	}

	onMount(() => {
		const onWheel = (e) => {
			if (hasRoom(findScrollable(e.target), e.deltaY > 0)) return;
			e.preventDefault();
			if (Math.abs(e.deltaY) < 8) return;
			step(e.deltaY > 0);
		};

		const onKey = (e) => {
			if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
				e.preventDefault();
				go(i + 1);
			} else if (['ArrowUp', 'PageUp'].includes(e.key)) {
				e.preventDefault();
				go(i - 1);
			} else if (e.key === 'Home') go(0);
			else if (e.key === 'End') go(N - 1);
		};

		const onTouchStart = (e) => {
			const t = e.touches[0];
			touchY = t.clientY;
			touchX = t.clientX;
			touchHost = findScrollable(e.target);
		};

		const onTouchEnd = (e) => {
			if (touchY == null) return;
			const t = e.changedTouches[0];
			const dy = touchY - t.clientY;
			const dx = Math.abs(touchX - t.clientX);
			touchY = null;
			if (Math.abs(dy) < 44 || dx > Math.abs(dy)) return;
			if (hasRoom(touchHost, dy > 0)) return;
			step(dy > 0);
		};

		/* `overflow:hidden` does NOT stop fragment navigation from scrolling
		   this container — landing on /v2#p3 would shove the whole stage out
		   of register with `i`. Pin it back to the origin whenever it moves. */
		const onRootScroll = () => {
			if (rootEl && (rootEl.scrollTop || rootEl.scrollLeft)) {
				rootEl.scrollTop = 0;
				rootEl.scrollLeft = 0;
			}
		};

		const onMove = (e) => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = null;
				px = e.clientX / window.innerWidth - 0.5;
				py = e.clientY / window.innerHeight - 0.5;
			});
		};

		/* The deck needs html/body locked to the viewport, but SvelteKit never
		   removes a route's stylesheet once it has been added — as a plain
		   `:global(html)` rule this welded `overflow:hidden` to the document for
		   the rest of the session, so any page navigated to afterwards (/propsize
		   above all) could not scroll and everything below its fold was
		   unreachable. Owning it as a class means it lifts on teardown. */
		document.documentElement.classList.add('jf-deck');
		document.body.classList.add('jf-deck');

		onRootScroll();
		rootEl?.addEventListener('scroll', onRootScroll);
		window.addEventListener('wheel', onWheel, { passive: false });
		window.addEventListener('keydown', onKey);
		window.addEventListener('touchstart', onTouchStart, { passive: true });
		window.addEventListener('touchend', onTouchEnd, { passive: true });
		window.addEventListener('mousemove', onMove);

		return () => {
			document.documentElement.classList.remove('jf-deck');
			document.body.classList.remove('jf-deck');
			rootEl?.removeEventListener('scroll', onRootScroll);
			window.removeEventListener('wheel', onWheel);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('touchstart', onTouchStart);
			window.removeEventListener('touchend', onTouchEnd);
			window.removeEventListener('mousemove', onMove);
			if (raf) cancelAnimationFrame(raf);
		};
	});
</script>

<svelte:head>
	<!-- Legacy: the old deck, kept as a backup. Not linked from the site. -->
	<meta name="robots" content="noindex, nofollow" />
	<title>{meta.title}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400&family=Martian+Mono:wght@300;400;600&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,600;1,6..72,300&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="jf-root"
	bind:this={rootEl}
	style="--px:{px * PARALLAX}; --py:{py * PARALLAX}; --slide:{SLIDE_MS}ms"
>
	<div class="jf-stage" style="transform:translateY({-i * 100}dvh)">
		{#each SCREENS as s, k (k)}
			{@const Panel = s.Panel}
			<section
				class="jf-screen {s.ground}"
				class:jf-scroll={s.scroll}
				class:jf-pad={s.pad}
				style="top:{k * 100}dvh"
				data-state={stateOf(k)}
				data-screen-label="0{k + 1} {LABELS[k]}"
				aria-hidden={k !== i}
				inert={k !== i ? true : undefined}
			>
				<Panel goto={go} active={k === i} />
			</section>
		{/each}
	</div>

	<!-- nav rail -->
	<nav class="jf-rail" aria-label="Sections">
		{#if SHOW_RAIL_LABELS}
			<span class="jf-rail-label" style="color:{onLight ? '#14110E' : '#C4452A'}">
				0{i + 1} — {LABELS[i]}
			</span>
		{/if}
		{#each LABELS as label, k (k)}
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
							? '#14110E'
							: '#C4452A'
						: onLight
							? 'rgba(20,17,14,.45)'
							: 'rgba(140,130,114,.75)'}"
				></span>
			</button>
		{/each}
	</nav>

	<div class="jf-progress" style="width:{((i + 1) / N) * 100}%"></div>

	<Curtain onDone={() => (ready = true)} />
</div>

<style>
	/* Safe to leak: app.html already zeroes these, and they change nothing
	   about whether another page can scroll. */
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
	}

	/* Everything that actually pins the page is gated on the class added in
	   onMount and dropped on teardown — see the note there. */
	:global(html.jf-deck),
	:global(body.jf-deck) {
		height: 100%;
		overflow: hidden;
		background: #14110e;
	}
</style>
