<script>
	/* =========================================================
	   05 · WORK: a wall of projects, in mosaic pages.
	   Each page is a 4×2 grid (2×4 on a phone). When a page fills,
	   the next one carries on to the right. The track is an ordinary
	   sideways scroll with snap points, so a swipe, a trackpad or
	   Tab all move it. The arrows step one page; the arrow keys move
	   between tiles. A tile opens its project's card in a <dialog>,
	   which closes with Esc, the ×, or a click on the backdrop, and
	   hands focus back to the tile.
	   Copy is in content.js (work). The old one-card carousel is in
	   Work.svelte.bak-2026-11-04.
	   ========================================================= */
	import { work as c } from '../content.js';
	import LivePreview from '../LivePreview.svelte';

	const external = (href) => /^https?:/.test(href);

	/* Page layouts by tile count. s = 1×1, w = 2 wide, b = 2×2,
	   f = the whole page. Each one fills all 8 cells, so no page has
	   a hole, the last one included. A featured project would go here
	   too: start the first page with 'b'. */
	const SHAPES = {
		1: ['f'],
		2: ['b', 'b'],
		3: ['b', 'w', 'w'],
		4: ['w', 'w', 'w', 'w'],
		5: ['b', 's', 's', 's', 's'],
		6: ['w', 's', 's', 's', 's', 'w']
	};
	const PER_PAGE = 6;

	const items = c.items
		.filter((it) => !it.hidden)
		.map((it) => {
			const all = it.images || [];
			return {
				...it,
				cover: all[0] ?? null,
				// three or more pictures: one large, two stacked beside it; fewer, just the first
				shots: all.slice(0, all.length >= 3 ? 3 : 1),
				// logos are shown whole in the card, not cropped
				logo: it.kind === 'Client'
			};
		});

	const pages = [];
	for (let k = 0; k < items.length; k += PER_PAGE) {
		const group = items.slice(k, k + PER_PAGE);
		const shapes = SHAPES[group.length];
		pages.push(group.map((it, j) => ({ it, shape: shapes[j] })));
	}
	const n = pages.length;
	const two = (k) => String(k).padStart(2, '0');

	let track;
	let sheet; // the <dialog>
	let at = $state(0); // the page in view
	let open = $state(null); // the project in the dialog

	function go(k) {
		if (k < 0 || k >= n) return;
		const els = track.children;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		track.scrollTo({
			left: els[k].offsetLeft - els[0].offsetLeft,
			behavior: still ? 'auto' : 'smooth'
		});
	}

	// Which page is in view; at the far end it is the last, even if it can't reach the start.
	function sync() {
		const els = track.children;
		if (els.length < 2) return;
		const step = els[1].offsetLeft - els[0].offsetLeft;
		const end = track.scrollWidth - track.clientWidth;
		at = track.scrollLeft >= end - 4 ? n - 1 : Math.round(track.scrollLeft / step);
	}

	// Arrow keys step through the tiles in order, across pages.
	function onKey(e) {
		const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
		if (!d) return;
		const tiles = [...track.querySelectorAll('.tile')];
		const next = tiles[tiles.indexOf(e.currentTarget) + d];
		if (next) {
			e.preventDefault();
			next.focus();
		}
	}

	function show(it) {
		open = it;
		sheet.showModal();
	}
	// a click on the backdrop lands on the dialog itself, not its card
	const onBackdrop = (e) => e.target === sheet && sheet.close();
</script>

<div class="jf-s">
	<div class="jf-s-wrap">
		<div class="jf-s-head jf-in">
			<h2 class="jf-s-h2" id="work-heading">{c.heading}</h2>
			<!-- aria-disabled, not disabled: a button that vanishes from
			     the tab order at the end would drop the focus -->
			{#if n > 1}
				<div class="controls">
					<p class="count" aria-hidden="true"><b>{two(at + 1)}</b> / {two(n)}</p>
					<button
						type="button"
						class="arrow"
						aria-label={c.prev}
						aria-controls="work-track"
						aria-disabled={at === 0}
						onclick={() => go(at - 1)}
					>
						<span aria-hidden="true">←</span>
					</button>
					<button
						type="button"
						class="arrow"
						aria-label={c.next}
						aria-controls="work-track"
						aria-disabled={at === n - 1}
						onclick={() => go(at + 1)}
					>
						<span aria-hidden="true">→</span>
					</button>
				</div>
			{/if}
		</div>

		<div class="track" id="work-track" bind:this={track} onscroll={sync} role="region" aria-labelledby="work-heading">
			{#each pages as page, p (p)}
				<div class="page" role="group" aria-label="Page {p + 1} of {n}">
					{#each page as { it, shape } (it.title)}
						<button
							type="button"
							class="tile t-{shape}"
							aria-haspopup="dialog"
							onclick={() => show(it)}
							onkeydown={onKey}
						>
							{#if it.cover}
								<!-- the tile names the project; the card carries the full descriptions -->
								<img src={it.cover.src} alt="" loading="lazy" />
							{/if}
							<span class="cap">
								<span class="kind" data-kind={it.kind}>{it.kind}</span>
								<span class="title">{it.title}</span>
								<span class="type">{it.type}</span>
							</span>
						</button>
					{/each}
				</div>
			{/each}
		</div>
		<p class="sr" aria-live="polite">Page {at + 1} of {n}</p>
	</div>
</div>

<!-- a click on the backdrop closes it; Esc works on its own -->
<dialog class="sheet" bind:this={sheet} onclick={onBackdrop} onclose={() => (open = null)} aria-labelledby="work-card-title">
	{#if open}
		<article class="card">
			<!-- first in the card, so it takes the focus when the card opens -->
			<button type="button" class="x" aria-label="Close" onclick={() => sheet.close()}></button>

			<div class="visual" class:collage={open.shots.length === 3} class:logo={open.logo}>
				{#if open.shots.length}
					{#each open.shots as im (im.src)}
						<img src={im.src} alt={im.alt} />
					{/each}
				{:else if open.preview}
					<LivePreview src={open.preview} />
				{/if}
			</div>

			<div class="body">
				<div class="tags">
					<span class="kind" data-kind={open.kind}>{open.kind}</span>
					<span>{open.type}</span>
				</div>
				<h3 id="work-card-title">{open.title}</h3>
				<dl>
					<div>
						<dt>Brief</dt>
						<dd>{open.brief}</dd>
					</div>
					<div>
						<dt>What I did</dt>
						<dd>{open.did}</dd>
					</div>
				</dl>
				<div class="links">
					{#each open.links as l (l.href)}
						<a
							href={l.href}
							target={external(l.href) ? '_blank' : undefined}
							rel={external(l.href) ? 'noopener noreferrer' : undefined}
						>
							{l.label} <span aria-hidden="true">↗</span>
						</a>
					{/each}
				</div>
			</div>
		</article>
	{/if}
</dialog>

<style>
	/* ---- head: the heading, then which page and the arrows ---- */
	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.count {
		margin: 0 8px 0 0;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
		color: rgba(244, 244, 241, 0.72);
	}
	.count b {
		color: var(--s-white);
	}
	.arrow {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: #fff;
		color: var(--s-black);
		font: inherit;
		font-size: 18px;
		cursor: pointer;
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
	}
	.arrow:hover {
		background: var(--s-black);
		color: var(--s-white);
	}
	.arrow:focus-visible {
		outline: 2px solid var(--s-white);
		outline-offset: 3px;
	}
	.arrow[aria-disabled='true'] {
		opacity: 0.35;
		cursor: default;
		background: #fff;
		color: var(--s-black);
	}

	/* ---- the track: one page wide, the next peeking in ---- */
	.track {
		--page: 94%;
		--gap: clamp(10px, 1.2vw, 16px);
		position: relative; /* the pages measure their offsets from it */
		display: flex;
		gap: var(--gap);
		overflow-x: auto;
		overscroll-behavior-x: contain; /* no browser back-swipe at the ends */
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		/* room for the focus ring, which overflow would clip */
		padding: 4px;
		margin: -4px;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.page {
		flex: 0 0 var(--page);
		scroll-snap-align: start;
		height: clamp(420px, 64svh, 680px);
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		gap: var(--gap);
	}
	.t-w {
		grid-column: span 2;
	}
	.t-b {
		grid-column: span 2;
		grid-row: span 2;
	}
	.t-f {
		grid-column: span 4;
		grid-row: span 2;
	}

	/* ---- a tile ---- */
	.tile {
		position: relative;
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: 0;
		border-radius: 12px;
		overflow: hidden;
		background: #2c1915;
		color: var(--s-white);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.tile img {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		/* fill the tile, keep the proportions, crop what spills over, centred */
		object-fit: cover;
		object-position: center;
		transition: transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.tile:hover img,
	.tile:focus-visible img {
		transform: scale(1.04);
	}
	.tile:focus-visible {
		outline: 2px solid var(--s-white);
		outline-offset: 3px;
	}

	/* the caption is always there: there is no hover on a phone */
	.cap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		padding: 56px clamp(12px, 1.4vw, 18px) clamp(12px, 1.4vw, 18px);
		background: linear-gradient(0deg, rgba(14, 14, 14, 0.88), rgba(14, 14, 14, 0));
	}
	.title {
		font-size: clamp(16px, 1.4vw, 21px);
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
		text-wrap: balance;
	}
	.t-b .title,
	.t-f .title {
		font-size: clamp(22px, 2.2vw, 32px);
	}
	.type {
		font-size: 13px;
		color: rgba(244, 244, 241, 0.8);
	}
	.t-s .type {
		display: none;
	}

	/* ---- the chip: on the tiles' dark scrim and on the white card ---- */
	.kind {
		padding: 5px 10px;
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 700;
		background: var(--s-white);
		color: var(--s-black);
	}
	/* Concept work is labelled plainly, in a different chip, so nobody
	   mistakes it for a client engagement. */
	.kind[data-kind='Concept'] {
		background: none;
		color: var(--s-white);
		box-shadow: inset 0 0 0 1.5px var(--s-white);
	}
	.kind[data-kind='Client'] {
		background: var(--em);
		color: var(--s-black);
	}
	.card .kind {
		background: var(--s-black);
		color: var(--s-white);
	}
	.card .kind[data-kind='Concept'] {
		background: none;
		color: var(--s-black);
		box-shadow: inset 0 0 0 1.5px var(--s-black);
	}
	.card .kind[data-kind='Client'] {
		background: var(--em);
		color: var(--s-black);
	}

	/* ---- the card, in its dialog ---- */
	.sheet {
		width: min(1120px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: 0;
		border-radius: 16px;
		background: #fff;
		color: var(--s-black);
		font-family: var(--grotesk);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
	}
	.sheet::backdrop {
		background: rgba(14, 14, 14, 0.72);
	}
	.sheet[open] {
		animation: pop 0.28s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet[open] {
			animation: none;
		}
		.tile img {
			transition: none;
		}
		.tile:hover img,
		.tile:focus-visible img {
			transform: none;
		}
	}

	.card {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
	}
	.x {
		position: absolute;
		z-index: 1;
		top: 14px;
		right: 14px;
		width: 40px;
		height: 40px;
		border: 1.5px solid var(--s-line-dk);
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
	}
	.x::before,
	.x::after {
		content: '';
		position: absolute;
		left: 12px;
		top: 18px;
		width: 13px;
		height: 1.5px;
		background: var(--s-black);
		transform: rotate(45deg);
	}
	.x::after {
		transform: rotate(-45deg);
	}
	.x:hover {
		border-color: var(--em-ink);
	}
	.x:focus-visible {
		outline: 2px solid var(--em-ink);
		outline-offset: 2px;
	}

	/* at least 16:10, and as tall as the text beside it */
	.visual {
		position: relative;
		align-self: stretch;
		aspect-ratio: 16 / 10;
		border-right: 1px solid var(--s-line-dk);
		background: #e6e6e2;
	}
	.visual > img {
		position: absolute; /* the box sets the size, not the picture */
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.visual.logo {
		background: #fff;
	}
	.visual.logo > img {
		object-fit: contain;
	}
	.collage {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
		gap: 3px;
		background: #fff;
	}
	.collage > img {
		position: static;
		min-height: 0;
	}
	.collage > img:first-child {
		grid-row: 1 / 3;
	}

	.body {
		display: flex;
		flex-direction: column;
		padding: clamp(20px, 2.4vw, 32px);
		padding-right: clamp(64px, 5vw, 72px); /* clear of the × */
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		font-size: 14px;
		color: var(--s-grey-dk);
	}
	h3 {
		margin: 14px 0 0;
		font-size: clamp(26px, 2.6vw, 36px);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}
	dl {
		margin: 18px 0 0;
		display: grid;
		gap: 14px;
	}
	dt {
		font-size: 13px;
		font-weight: 700;
		color: var(--s-grey-dk);
	}
	dd {
		margin: 4px 0 0;
		font-size: 16px;
		line-height: 1.45;
		text-wrap: pretty;
	}
	.links {
		margin-top: auto;
		padding-top: 22px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px 20px;
	}
	.links a {
		font-weight: 700;
		font-size: 16px;
		color: var(--em-ink);
		border-bottom: 1.5px solid currentColor;
		padding-bottom: 2px;
	}
	.links a:hover {
		color: var(--s-black);
	}
	/* the card is white, so the ring takes the dark green */
	.links a:focus-visible {
		outline-color: var(--em-ink);
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

	/* phone: each page turns on its side, 2 across and 4 down, and the
	   same layouts still fill it */
	@media (max-width: 760px) {
		.track {
			--page: 86%;
		}
		.page {
			height: min(78svh, 680px);
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-template-rows: repeat(4, minmax(0, 1fr));
		}
		.t-f {
			grid-column: span 2;
			grid-row: span 4;
		}
	}
	@media (max-width: 860px) {
		.card {
			grid-template-columns: minmax(0, 1fr);
		}
		.visual {
			border-right: 0;
			border-bottom: 1px solid var(--s-line-dk);
		}
		.body {
			padding-right: clamp(20px, 2.4vw, 32px);
		}
	}
</style>
