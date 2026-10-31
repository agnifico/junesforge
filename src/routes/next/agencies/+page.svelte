<script>
	/* =========================================================
	   JUNESFORGE VS THE AGENCY — a long read, linked from the
	   home's "Why one person". The studio system (studio.css):
	   one grotesk, black and white, emerald for the accent.
	   Copy lives in $lib/v2/content.js (versus), not in here.
	   ========================================================= */
	import { onMount } from 'svelte';
	import '$lib/v2/theme.css';
	import '$lib/v2/studio.css';
	import { versus as c, enquiry, identity } from '$lib/v2/content.js';

	/* The page shows one number and two bars; the rupees stay in the
	   story card. The agency's bill splits into what the maker was
	   paid, the markup on that, and the agency's own fee. */
	const f = c.receipt.figures;
	const agency = f.billed + f.fee;
	const multiple = Number((agency / f.direct).toFixed(2));
	const segments = [
		{ kind: 'work', v: f.paid },
		{ kind: 'markup', v: f.billed - f.paid },
		{ kind: 'fee', v: f.fee }
	];

	// "Start" / " a project": the bar's button shows only the first word
	const [startWord, ...rest] = enquiry.label.split(' ');
	const startRest = rest.join(' ');

	let story; // the <dialog>
	// a click on the backdrop lands on the dialog itself, not its card
	const onBackdrop = (e) => e.target === story && story.close();

	onMount(() => {
		document.documentElement.classList.add('jf-studio-doc');
		return () => document.documentElement.classList.remove('jf-studio-doc');
	});
</script>

<svelte:head>
	<title>{c.meta.title}</title>
	<meta name="description" content={c.meta.description} />
	<!-- Staging, like /next: out of search until it goes live. -->
	<meta name="robots" content="noindex" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="jf-root jf-studio vs">
	<!-- floats over the page: just the mark, and a "Start" that
	     opens out to the full label on hover -->
	<header class="bar">
		<a class="home" href={c.close.back.href} aria-label="Junesforge home">
			<img src={identity.brand.logo} alt="" />
		</a>
		<a class="jf-s-btn primary start" href={enquiry.href} aria-label={enquiry.label}>
			{startWord}<span class="more">{startRest}</span> <span class="arr">→</span>
		</a>
	</header>

	<!-- the claim -->
	<section class="jf-s-dark">
		<div class="jf-s hero">
			<div class="jf-s-wrap">
				<p class="jf-s-label">{c.hero.label}</p>
				<h1>
					{#each c.hero.headline as line, k}
						<span class:em={k === c.hero.headline.length - 1}>{line}</span>
					{/each}
				</h1>
				<p class="jf-s-lede hero-lede">{c.hero.lede}</p>
			</div>
		</div>
	</section>

	<!-- the receipt: one number and two bars; the story on demand -->
	<section class="jf-s-light">
		<div class="jf-s">
			<div class="jf-s-wrap">
				<p class="jf-s-label">{c.receipt.label}</p>
				<h2 class="jf-s-h2">{c.receipt.heading}</h2>

				<div class="gap">
					<p class="big">{multiple}×</p>
					<p class="what">{c.receipt.multiple}</p>
				</div>

				<div
					class="bars"
					role="img"
					aria-label="{c.receipt.bars.agency}: {c.receipt.bars.work}, {c.receipt.bars.markup} and {c.receipt
						.bars.fee}, {multiple} times as long as {c.receipt.bars.direct}."
				>
					<div class="bar-row">
						<span class="who">{c.receipt.bars.direct}</span>
						<div class="track">
							<div class="seg work" style="flex-basis:{(f.direct / agency) * 100}%">
								<span>{c.receipt.bars.work}</span>
							</div>
						</div>
					</div>
					<div class="bar-row">
						<span class="who">{c.receipt.bars.agency}</span>
						<div class="track">
							{#each segments as s}
								<div class="seg {s.kind}" style="flex-basis:{(s.v / agency) * 100}%">
									<span>{c.receipt.bars[s.kind]}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<div class="coda">
					<p>{c.receipt.coda}</p>
					<button type="button" class="jf-s-btn ghost" onclick={() => story.showModal()}>
						{c.receipt.open} <span class="arr">→</span>
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<dialog class="story" bind:this={story} onclick={onBackdrop} aria-labelledby="story-h">
		<div class="card">
			<p class="jf-s-label">{c.receipt.label}</p>
			<h2 id="story-h">{c.receipt.heading}</h2>
			{#each c.receipt.story as para}
				<p>{para}</p>
			{/each}
			<button type="button" class="x" aria-label="Close" onclick={() => story.close()}></button>
		</div>
	</dialog>

	<!-- from the inside -->
	<section class="jf-s-dark">
		<div class="jf-s">
			<div class="jf-s-wrap">
				<p class="jf-s-label">{c.inside.label}</p>
				<h2 class="jf-s-h2">{c.inside.heading}</h2>
				<ol class="inside">
					{#each c.inside.items as it, k}
						<li>
							<span class="n">{String(k + 1).padStart(2, '0')}</span>
							<h3>{it.title}</h3>
							<p>{it.body}</p>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	</section>

	<!-- the circuit as proof -->
	<section class="jf-s-light">
		<div class="jf-s">
			<div class="jf-s-wrap split">
				<div>
					<p class="jf-s-label">{c.proof.label}</p>
					<h2 class="jf-s-h2">{c.proof.heading}</h2>
				</div>
				<div class="proof">
					{#each c.proof.body as para}
						<p>{para}</p>
					{/each}
					<a class="jf-s-btn ghost" href={c.proof.link.href}>{c.proof.link.label} <span class="arr">→</span></a>
				</div>
			</div>
		</div>
	</section>

	<!-- the concession -->
	<section class="jf-s-dark">
		<div class="jf-s fair">
			<div class="jf-s-wrap split">
				<div>
					<p class="jf-s-label">{c.fair.label}</p>
					<h2 class="sub">{c.fair.heading}</h2>
				</div>
				<p class="fair-body">{c.fair.body}</p>
			</div>
		</div>
	</section>

	<!-- the close -->
	<section class="jf-s-dark close">
		<div class="jf-s">
			<div class="jf-s-wrap">
				<h2 class="huge">
					{#each c.close.heading as line, k}
						<span class:em={k === c.close.heading.length - 1}>{line}</span>
					{/each}
				</h2>
				<p class="jf-s-lede">{c.close.lede}</p>
				<div class="ctas">
					<a class="jf-s-btn primary" href={enquiry.href}>{enquiry.label} <span class="arr">→</span></a>
					<a class="jf-s-btn ghost" href={c.close.back.href}>{c.close.back.label}</a>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}
	:global(html.jf-studio-doc) {
		background: #0e0e0e;
	}

	.vs {
		font-family: var(--grotesk);
		--pad-r: var(--pad-x); /* no rail on this page */
	}
	.em {
		color: var(--em);
	}

	/* Every section should fit one screen, so vertical rhythm and the
	   big type are capped by the viewport's height as well as its width. */
	.jf-s {
		padding-top: clamp(48px, 9svh, 120px);
		padding-bottom: clamp(48px, 9svh, 120px);
	}
	.jf-s-h2 {
		font-size: clamp(36px, min(6.4vw, 8svh), 88px);
	}

	/* ---- bar ------------------------------------------------ */
	/* No ground and no border: it floats over the page and takes no
	   room from the sections. */
	.bar {
		position: fixed;
		inset: 0 0 auto;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px var(--pad-x);
		padding-top: calc(12px + env(safe-area-inset-top, 0px));
		pointer-events: none;
	}
	.bar a {
		pointer-events: auto;
	}
	.home {
		display: inline-flex;
	}
	.home img {
		width: 20px;
		height: 20px;
	}
	.start {
		gap: 0;
		padding: 8px 14px;
		font-size: 14px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
	}
	.start .more {
		display: inline-block;
		max-width: 0;
		overflow: hidden;
		white-space: nowrap;
		transition: max-width 0.3s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	/* a leading space would collapse inside the flex item, so pad it */
	.start .more::before {
		content: '\00a0';
	}
	.start .arr {
		margin-left: 6px;
	}
	.start:hover .more,
	.start:focus-visible .more {
		max-width: 8em;
	}

	/* ---- hero ----------------------------------------------- */
	.hero {
		padding-top: clamp(64px, 12svh, 160px);
	}
	h1,
	.huge {
		margin: 0;
		font-weight: 900;
		font-size: clamp(40px, min(10.5vw, 15svh), 176px);
		line-height: 0.88;
		letter-spacing: -0.055em;
		text-transform: uppercase;
	}
	h1 span,
	.huge span {
		display: block;
	}
	.hero-lede {
		margin: clamp(28px, 5svh, 80px) 0 0;
		padding-top: clamp(18px, 3svh, 28px);
		border-top: 1px solid var(--s-line);
		max-width: 52ch;
		color: #cfcfc9;
		font-size: clamp(19px, 1.8vw, 24px);
	}

	/* ---- receipt -------------------------------------------- */
	.gap {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px 32px;
		margin-top: clamp(24px, 4svh, 64px);
	}
	.big {
		margin: 0;
		font-weight: 900;
		font-size: clamp(72px, min(15vw, 20svh), 240px);
		line-height: 0.82;
		letter-spacing: -0.06em;
		color: var(--em-ink);
		font-variant-numeric: tabular-nums;
	}
	.what {
		margin: 0 0 0.4em;
		max-width: 22ch;
		font-size: clamp(22px, 2.4vw, 34px);
		font-weight: 800;
		letter-spacing: -0.025em;
		line-height: 1.1;
		text-wrap: balance;
	}

	.bars {
		display: grid;
		gap: 14px;
		margin-top: clamp(24px, 4svh, 64px);
	}
	.bar-row {
		display: grid;
		grid-template-columns: 170px minmax(0, 1fr);
		align-items: center;
		gap: 16px;
	}
	.bar-row .who {
		font-size: 14px;
		font-weight: 700;
		color: var(--s-grey-dk);
	}
	.track {
		display: flex;
		height: clamp(36px, 6svh, 48px);
	}
	.seg {
		flex: 0 0 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		padding: 0 12px;
		overflow: hidden;
		border-right: 2px solid var(--s-white);
		font-size: 13px;
		font-weight: 700;
		white-space: nowrap;
	}
	.seg span {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.seg.work {
		background: var(--s-black);
		color: var(--s-white);
	}
	.seg.markup {
		background: repeating-linear-gradient(-45deg, var(--em-ink) 0 6px, #0e6a48 6px 12px);
		color: #fff;
	}
	.seg.fee {
		background: var(--em-ink);
		color: #fff;
	}

	.coda {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 20px 48px;
		margin-top: clamp(24px, 4svh, 64px);
		padding-top: clamp(18px, 3svh, 28px);
		border-top: 1px solid var(--s-line-dk);
	}
	.coda p {
		margin: 0;
		max-width: 58ch;
		font-size: clamp(19px, 1.8vw, 24px);
		line-height: 1.45;
		font-weight: 600;
		letter-spacing: -0.01em;
		text-wrap: pretty;
	}

	/* ---- the story card ------------------------------------- */
	.story {
		width: min(560px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: 0;
		border-radius: 18px;
		background: var(--s-white);
		color: var(--s-black);
		font-family: var(--grotesk);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
	}
	.story::backdrop {
		background: rgba(14, 14, 14, 0.72);
		backdrop-filter: blur(4px);
	}
	.story[open] {
		animation: pop 0.28s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
	.card {
		position: relative;
		padding: clamp(28px, 4vw, 40px);
	}
	.card .jf-s-label {
		color: var(--em-ink);
	}
	.card h2 {
		margin: 0 0 22px;
		padding-right: 36px;
		font-size: clamp(26px, 3vw, 34px);
		font-weight: 800;
		line-height: 1.02;
		letter-spacing: -0.03em;
	}
	.card p:not(.jf-s-label) {
		margin: 0 0 14px;
		font-size: 17px;
		line-height: 1.55;
		text-wrap: pretty;
	}
	.x {
		position: absolute;
		top: 18px;
		right: 18px;
		width: 36px;
		height: 36px;
		border: 1.5px solid var(--s-line-dk);
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	.x::before,
	.x::after {
		content: '';
		position: absolute;
		left: 10px;
		top: 16px;
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

	/* ---- from the inside ------------------------------------ */
	/* four across on desktop, so the section stays one screen tall */
	.inside {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: clamp(24px, 4svh, 40px) clamp(20px, 2.4vw, 40px);
		margin: clamp(28px, 5svh, 64px) 0 0;
		padding: 0;
	}
	.inside li {
		padding-top: clamp(16px, 2.4svh, 24px);
		border-top: 1px solid var(--s-line);
	}
	.inside .n {
		display: block;
		margin-bottom: clamp(10px, 2svh, 20px);
		font-size: 15px;
		font-weight: 700;
		color: var(--em);
		font-variant-numeric: tabular-nums;
	}
	.inside h3 {
		margin: 0;
		font-size: clamp(21px, min(1.9vw, 3.4svh), 30px);
		font-weight: 800;
		line-height: 1.08;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}
	.inside p {
		margin: 0;
		padding-top: 12px;
		font-size: 16px;
		line-height: 1.5;
		color: #b4b4ae;
		text-wrap: pretty;
	}

	/* ---- proof + fair --------------------------------------- */
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 28px clamp(32px, 6vw, 96px);
		align-items: start;
	}
	.proof p {
		margin: 0 0 18px;
		font-size: clamp(18px, 1.6vw, 21px);
		line-height: 1.5;
		color: var(--s-grey-dk);
		text-wrap: pretty;
	}
	.proof .jf-s-btn {
		margin-top: 12px;
	}
	.fair {
		padding-top: clamp(48px, 7vw, 96px);
		padding-bottom: 0;
	}
	.sub {
		margin: 0;
		font-size: clamp(28px, 3.2vw, 44px);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.03em;
	}
	.fair-body {
		margin: 0;
		font-size: 17px;
		line-height: 1.55;
		color: #b4b4ae;
		text-wrap: pretty;
	}

	/* ---- close ---------------------------------------------- */
	.close .jf-s-lede {
		margin-top: clamp(28px, 4vw, 44px);
		font-size: clamp(19px, 1.8vw, 24px);
		color: #cfcfc9;
	}
	.ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 28px;
	}

	/* ---- small screens -------------------------------------- */
	@media (max-width: 1100px) {
		.inside {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 960px) {
		.split {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 620px) {
		.bar-row {
			grid-template-columns: minmax(0, 1fr);
			gap: 6px;
		}
		.seg {
			padding: 0 8px;
			font-size: 12px;
		}
		.inside {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.start .more {
			transition-duration: 1ms;
		}
	}
</style>
