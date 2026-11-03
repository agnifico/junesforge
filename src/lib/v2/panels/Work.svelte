<script>
	/* =========================================================
	   05 · WORK — one project per slide, the next one peeking in at
	   the edge. The track is an ordinary sideways scroll with snap
	   points, so a swipe, a trackpad or Tab onto a link all move it,
	   and nothing takes over the page's own scroll. The arrows step
	   one project at a time; the counter says where you are.
	   Copy is in content.js (work).
	   ========================================================= */
	import { work as c } from '../content.js';
	import LivePreview from '../LivePreview.svelte';

	const external = (href) => /^https?:/.test(href);
	const items = c.items.filter((it) => !it.hidden);
	const n = items.length;
	const two = (k) => String(k).padStart(2, '0');

	let track;
	let at = $state(0); // the project in view

	// Step to project k, if there is one.
	function go(k) {
		if (k < 0 || k >= n) return;
		const slides = track.children;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		track.scrollTo({
			left: slides[k].offsetLeft - slides[0].offsetLeft,
			behavior: still ? 'auto' : 'smooth'
		});
	}

	// Which project is in view, from how far the track is scrolled;
	// at the far end it is the last, even if it can't reach the start.
	function sync() {
		const slides = track.children;
		if (slides.length < 2) return;
		const step = slides[1].offsetLeft - slides[0].offsetLeft;
		const end = track.scrollWidth - track.clientWidth;
		at = track.scrollLeft >= end - 4 ? n - 1 : Math.round(track.scrollLeft / step);
	}
</script>

<div class="jf-s">
	<div class="jf-s-wrap">
		<div class="jf-s-head jf-in">
			<h2 class="jf-s-h2" id="work-heading">{c.heading}</h2>
			<!-- aria-disabled, not disabled: a button that vanishes from
			     the tab order at the end would drop the focus -->
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
		</div>

		<div
			class="track"
			id="work-track"
			bind:this={track}
			onscroll={sync}
			role="region"
			aria-roledescription="carousel"
			aria-labelledby="work-heading"
		>
			{#each items as it, k (it.title)}
				<article
					class="card"
					role="group"
					aria-roledescription="slide"
					aria-label="{k + 1} of {n}: {it.title}"
				>
					<div class="visual">
						{#if it.strip}
							<div class="marks">
								{#each it.strip as m (m.src)}
									<img src={m.src} alt={m.alt} style="object-fit:{m.fit}" loading="lazy" />
								{/each}
							</div>
						{:else if it.image}
							<img src={it.image} alt="{it.title}, {it.type}" loading="lazy" />
						{:else if it.preview}
							<LivePreview src={it.preview} />
						{/if}
					</div>

					<div class="body">
						<div class="tags">
							<span class="kind" data-kind={it.kind}>{it.kind}</span>
							<span>{it.type}</span>
						</div>
						<h3>{it.title}</h3>
						<dl>
							<div>
								<dt>Brief</dt>
								<dd>{it.brief}</dd>
							</div>
							<div>
								<dt>What I did</dt>
								<dd>{it.did}</dd>
							</div>
						</dl>
						<div class="links">
							{#each it.links as l (l.href)}
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
			{/each}
		</div>
		<p class="sr" aria-live="polite">{at + 1} of {n}: {items[at]?.title}</p>
	</div>
</div>

<style>
	/* ---- head: the heading, then where you are and the arrows ---- */
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

	/* ---- the track: one project wide, the next peeking in ---- */
	.track {
		--slide: 86%;
		--gap: clamp(14px, 1.6vw, 22px);
		position: relative; /* the slides measure their offsets from it */
		display: flex;
		gap: var(--gap);
		overflow-x: auto;
		overscroll-behavior-x: contain; /* no browser back-swipe at the ends */
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.card {
		flex: 0 0 var(--slide);
		scroll-snap-align: start;
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
		background: #fff;
		color: var(--s-black); /* the ground is dark, the card is not */
		border: 1px solid var(--s-line-dk);
		border-radius: 14px;
		overflow: hidden;
	}

	.visual {
		position: relative;
		aspect-ratio: 16 / 10;
		border-right: 1px solid var(--s-line-dk);
		background: #e6e6e2;
	}
	.visual > img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.marks {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		height: 100%;
	}
	.marks img {
		width: 100%;
		height: 100%;
		background: #fff;
		border-right: 1px solid var(--s-line-dk);
	}
	.marks img:last-child {
		border-right: 0;
	}

	.body {
		display: flex;
		flex-direction: column;
		padding: clamp(20px, 2.4vw, 32px);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		font-size: 14px;
		color: var(--s-grey-dk);
	}
	.kind {
		padding: 5px 10px;
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 700;
		background: var(--s-black);
		color: var(--s-white);
	}
	/* Concept work is labelled plainly, in a different chip, so nobody
	   mistakes it for a client engagement. */
	.kind[data-kind='Concept'] {
		background: none;
		color: var(--s-black);
		box-shadow: inset 0 0 0 1.5px var(--s-black);
	}
	.kind[data-kind='Client'] {
		background: var(--em);
		color: var(--s-black);
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

	@media (max-width: 860px) {
		.track {
			--slide: 88%;
		}
		.card {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 1fr;
		}
		.visual {
			border-right: 0;
			border-bottom: 1px solid var(--s-line-dk);
		}
	}
</style>
