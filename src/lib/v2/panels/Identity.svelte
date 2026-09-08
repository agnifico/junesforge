<script>
	/* 01 · IDENTITY — the front door.
	   Four bands stacked on one screen: brand bar, hero + one
	   featured piece, two large doors, and a thin utility strip.
	   Every word comes from content.js. */
	import { identity as c } from '../content.js';
	let { goto = () => {}, active = true } = $props();

	/* The featured tile cross-fades through its screenshots, but only
	   while this screen is the one on stage. */
	let shot = $state(0);
	const shots = c.featured.shots ?? [];

	$effect(() => {
		if (!active || shots.length < 2) return;
		const t = setInterval(() => {
			shot = (shot + 1) % shots.length;
		}, c.featured.rotateMs ?? 5000);
		return () => clearInterval(t);
	});
</script>

<!-- Absolutely-positioned decoration bleeds past the panel and would
     otherwise give a scrollable panel hundreds of px of phantom height,
     eating the first wheel gesture. Clip it in its own layer. -->
<div class="decor" aria-hidden="true">
	<div class="jf-grain"></div>
	<div
		class="bloom"
		style="top:-26%; left:-14%; width:66vw; height:66vw;
		       background:radial-gradient(circle, rgba(31,107,88,.34), transparent 62%);
		       transform:translate(calc(var(--px) * -30px), calc(var(--py) * -22px))"
	></div>
	<div
		class="bloom"
		style="bottom:-34%; right:-16%; width:56vw; height:56vw;
		       background:radial-gradient(circle, rgba(196,69,42,.20), transparent 64%);
		       transform:translate(calc(var(--px) * 26px), calc(var(--py) * 20px))"
	></div>
	<img
		class="ghost"
		src={c.brand.logo}
		alt=""
		style="transform:translate(calc(var(--px) * 18px), calc(var(--py) * 14px))"
	/>
</div>

<div class="home">
	<!-- ── brand bar ─────────────────────────────────────────── -->
	<header class="top jf-in">
		<div class="brand">
			<img class="mark" src={c.brand.logo} alt="{c.brand.wordmark} logo" />
			<!-- <span class="wordmark">{c.brand.wordmark}</span> -->
		</div>

		<!-- Opens in a new tab like every other outbound link here — see Products. -->
		<a class="teaser" href={c.teaser.href} target="_blank" rel="noopener noreferrer">
			<span class="teaser-flag">{c.teaser.flag}</span>
			<span class="teaser-short">{c.teaser.short}</span>
			<span class="teaser-long"><span>{c.teaser.long}</span></span>
			<span class="teaser-arrow">→</span>
		</a>
	</header>

	<!-- ── hero + the one featured piece ─────────────────────── -->
	<main class="body">
		<div class="hero jf-in">
			<h1 class="name">
				<!-- All three flush: any whitespace between these spans renders as a
				     gap in the sentence. -->
				<span class="greeting">{c.greeting}</span><span class="given">{c.name}</span><span
					class="stop"></span
				>
			</h1>

			<p class="tagline">
				{#each c.tagline as seg, k (k)}
					{#if seg.br}
						<br />
					{:else if seg.goto != null}
						<button class="tag-link {seg.tone}" type="button" onclick={() => goto(seg.goto)}
							>{seg.text}</button
						>
					{:else}{seg.text}{/if}
				{/each}
			</p>

			<blockquote class="creed">
				{#each c.creed as line, k (k)}
					<span class:tail={k === c.creed.length - 1}>{line}</span>
				{/each}
			</blockquote>

			<p class="signature">
				<span class="sig-role">{c.signature.role}</span>
				<span class="sig-sep">—</span>
				<span>{c.signature.location}</span>
			</p>
		</div>

		<div class="featured jf-in">
			{#each shots as src, k (src)}
				<img class="shot" class:on={k === shot} {src} alt="" />
			{/each}
			<span class="veil"></span>

			<span class="ticks">
				{#each shots as src, k (src)}
					<span class="tick" class:on={k === shot}></span>
				{/each}
			</span>

			<div class="feat-meta">
				<span class="feat-kicker">{c.featured.kicker}</span>
				<span class="feat-title">{c.featured.title}</span>
				<span class="feat-sub">{c.featured.meta}</span>
				{#if c.featured.href}
					<a
						class="feat-cta"
						href={c.featured.href}
						target="_blank"
						rel="noopener noreferrer"
					>
						<span class="cta-glyph" aria-hidden="true">▶</span>
						<span class="cta-text">{c.featured.cta}</span>
					</a>
				{:else}
					<span class="feat-cta pending" title="Link coming soon">
						<span class="cta-glyph" aria-hidden="true">▶</span>
						<span class="cta-text">{c.featured.cta}</span>
					</span>
				{/if}
			</div>
		</div>
	</main>

	<!-- ── the two doors ─────────────────────────────────────── -->
	{#if c.showDoors}
		<nav class="doors" aria-label="What I do">
			{#each c.doors as d (d.label)}
				<button class="door {d.tone}" type="button" onclick={() => goto(d.goto)}>
					<span class="door-n">{d.n}</span>
					<span class="door-label">{d.label}</span>
					<span class="door-arrow">→</span>
				</button>
			{/each}
		</nav>
	{/if}

	<!-- ── utility strip ─────────────────────────────────────── -->
	<footer class="strip">
		<ul class="socials">
			{#each c.socials as s (s.label)}
				<li class="social">
					<a
						class="social-btn"
						href={s.href}
						title={s.label}
						aria-label={s.label}
						target="_blank"
						rel="noopener noreferrer"
					>
						<img src={s.icon} alt="" />
					</a>
					<!-- outside the anchor on purpose: plain text you can select and copy -->
					<span class="social-handle"><span>{s.handle}</span></span>
				</li>
			{/each}
		</ul>

		{#if active}
			<span class="hint">{c.hint}</span>
		{/if}

		<div class="avail">
			<span class="jf-dot jade-dot"></span>
			<span class="avail-label">{c.availability}</span>
			{#each c.docs as d (d.href)}
				<a class="doc" href={d.href} target="_blank" rel="noopener noreferrer">{d.label} ↗</a>
			{/each}
		</div>
	</footer>
</div>

<style>
	.decor {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.bloom {
		position: absolute;
		pointer-events: none;
	}
	/* The mark, blown up and buried in the ground. */
	.ghost {
		position: absolute;
		left: -6%;
		top: 16%;
		width: clamp(300px, 48vh, 620px);
		opacity: 0.05;
		pointer-events: none;
		user-select: none;
	}

	.home {
		position: relative;
		flex: 1;
		/* a flex item's auto min-width is min-content — without this the
		   no-wrap brand bar widens the whole screen on narrow viewports */
		min-width: 0;
		min-height: 540px;
		display: flex;
		flex-direction: column;
		gap: clamp(14px, 2.2vh, 30px);
	}

	/* ---- brand bar ------------------------------------------ */
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex: 0 0 auto;
		min-width: 0;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: clamp(9px, 1vw, 14px);
		min-width: 0;
	}
	.mark {
		width: clamp(30px, 3.2vw, 44px);
		height: clamp(30px, 3.2vw, 44px);
		object-fit: contain;
	}
	.brand-type {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.wordmark {
		font-family: var(--mono);
		font-size: clamp(12px, 1.25vw, 16px);
		font-weight: 600;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--paper);
	}

	/* Closed it reads "Propsize"; hover unfurls the pitch. */
	.teaser {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 8px 14px;
		border: 1px solid rgba(63, 176, 141, 0.4);
		border-radius: 999px;
		background: rgba(31, 107, 88, 0.14);
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--paper);
		white-space: nowrap;
		flex: 0 1 auto;
		min-width: 0;
		transition:
			background 0.35s ease,
			border-color 0.35s ease;
	}
	.teaser:hover,
	.teaser:focus-visible {
		background: rgba(31, 107, 88, 0.32);
		border-color: var(--jade);
	}
	.teaser-flag {
		padding: 2px 7px;
		border-radius: 999px;
		background: var(--jade);
		color: var(--ink);
		font-size: 8.5px;
		font-weight: 600;
		letter-spacing: 0.18em;
	}
	.teaser-long {
		display: grid;
		grid-template-columns: 0fr;
		opacity: 0;
		color: var(--jade);
		transition:
			grid-template-columns 0.5s var(--ease),
			opacity 0.35s ease;
	}
	.teaser-long > span {
		overflow: hidden;
		min-width: 0;
	}
	.teaser:hover .teaser-long,
	.teaser:focus-visible .teaser-long {
		grid-template-columns: 1fr;
		opacity: 1;
	}
	.teaser-long > span::before {
		content: '— ';
		opacity: 0.6;
	}
	.teaser-arrow {
		color: var(--jade);
		transition: transform 0.35s var(--ease);
	}
	.teaser:hover .teaser-arrow {
		transform: translateX(3px);
	}

	/* ---- hero + featured ------------------------------------ */
	.body {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		gap: clamp(18px, 3vw, 54px);
		align-items: stretch;
	}
	.hero {
		flex: 1 1 58%;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	/* One mono line, one size. The difference between the greeting and the name
	   is carried entirely by weight and colour — no size step at all, which is
	   what keeps it reading as a sentence someone said rather than a label
	   stacked over a word. nowrap because a mono line that breaks mid-phrase
	   loses the whole effect; at 16 characters it fits a 320px screen. */
	.name {
		margin: clamp(8px, 1.8vh, 26px) 0 clamp(20px, 3.6vh, 46px);
		font-family: var(--mono);
		font-size: clamp(19px, 2.9vw, 42px);
		line-height: 1.2;
		color: var(--dust);
		white-space: nowrap;
	}
	.greeting {
		font-weight: 300;
		word-spacing: -25%;
	}
	.given {
		font-weight: 600;
		color: var(--jade);
		/* Underline is painted transparent and revealed on hover, so the text
		   never reflows — declaring it only on :hover shifts the baseline. It is
		   decoration, not a link: nothing happens, and the cursor says so. */
		text-decoration: underline;
		text-decoration-color: transparent;
		text-decoration-thickness: 0.055em;
		text-underline-offset: 0.18em;
		cursor: default;
		transition: text-decoration-color 0.3s ease;
	}
	.name:hover .given {
		text-decoration-color: currentColor;
	}
	/* Outside .given on purpose — the full stop belongs to the sentence, not to
	   the name, so it stays light and unaccented and the hover rule underlines
	   "Agni" alone. */
	.stop {
		font-weight: 300;
	}

	/* Newsreader — the newspaper face — and now the largest thing in the hero.
	   With the name line down to a small mono strip, this is what anchors the
	   screen, so it takes the display size the name used to have. */
	.tagline {
		margin: 0;
		font-family: var(--body);
		font-weight: 400;
		/* ~30% down from 3.3vw/56px. The floor stays at 27px so the narrow
		   layout — where the spread already reads well — is unchanged; only the
		   desktop end comes back. */
		font-size: clamp(27px, 2.3vw, 40px);
		letter-spacing: -0.012em;
		line-height: 1.16;
		color: var(--dust);
		text-wrap: pretty;
	}
	/* "design things" and "build them" are the doors now */
	.tag-link {
		position: relative;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--paper);
		cursor: pointer;
		transition: color 0.3s ease;
	}
	.tag-link::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0.16em; /* clear of the descenders in "design things" */
		height: 2px;
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 0.4s var(--ease);
	}
	.tag-link.rust::after {
		background: var(--rust);
	}
	.tag-link.jade::after {
		background: var(--jade);
	}
	.tag-link:hover::after,
	.tag-link:focus-visible::after {
		transform: scaleX(1);
	}
	.tag-link.rust:hover,
	.tag-link.rust:focus-visible {
		color: var(--rust);
	}
	.tag-link.jade:hover,
	.tag-link.jade:focus-visible {
		color: var(--jade);
	}
	.creed {
		margin: clamp(14px, 2.4vh, 30px) 0 0;
		padding-left: clamp(12px, 1.4vw, 20px);
		border-left: 1px solid rgba(196, 69, 42, 0.55);
		display: flex;
		flex-direction: column;
		gap: 3px;
		max-width: 56ch;
		font-size: clamp(13px, 1.35vw, 17px);
		font-weight: 300;
		line-height: 1.5;
		color: var(--ash);
		text-wrap: pretty;
	}
	.creed .tail {
		color: var(--rust);
	}

	.signature {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: clamp(7px, 0.9vw, 12px);
		margin: clamp(16px, 2.8vh, 34px) 0 0;
		font-family: var(--mono);
		font-size: clamp(9.5px, 1vw, 11.5px);
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--stone);
	}
	.sig-role {
		color: var(--jade);
	}
	.sig-sep {
		opacity: 0.5;
	}

	.featured {
		position: relative;
		flex: 1 1 38%;
		min-width: 0;
		overflow: hidden;
		border-radius: 2px;
		border: 1px solid rgba(233, 225, 208, 0.14);
	}
	/* centre crop, never letterboxed — the shots are 16:9, the tile is not */
	.shot {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		/* pushed in and nudged down, so the game's own HUD strip along the
		   bottom of the screenshots falls outside the crop */
		transform: scale(1.24) translateY(5%);
		opacity: 0;
		transition: opacity 1.1s ease;
	}
	.shot.on {
		opacity: 1;
	}

	.ticks {
		position: absolute;
		top: clamp(12px, 1.5vw, 18px);
		right: clamp(12px, 1.5vw, 18px);
		display: flex;
		gap: 5px;
	}
	.tick {
		width: 16px;
		height: 2px;
		background: rgba(233, 225, 208, 0.3);
		transition: background 0.5s ease;
	}
	.tick.on {
		background: var(--paper);
	}
	.veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(20, 17, 14, 0.94) 0%,
			rgba(20, 17, 14, 0.62) 34%,
			rgba(20, 17, 14, 0.06) 74%
		);
	}
	.feat-meta {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: clamp(12px, 1.6vw, 20px);
	}
	.feat-kicker {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--rust);
	}
	.feat-title {
		font-family: var(--subhead);
		font-weight: 600;
		font-size: clamp(21px, 2.15vw, 31px);
		line-height: 1.08;
		letter-spacing: -0.005em;
		color: var(--paper);
	}
	.feat-sub {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--stone);
	}
	/* the only click target on the tile — and it should read as one */
	.feat-cta {
		position: relative;
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin-top: clamp(10px, 1.3vw, 16px);
		padding: 13px 22px;
		overflow: hidden;
		border-radius: 3px;
		background: var(--rust);
		color: var(--paper);
		font-family: var(--mono);
		font-size: clamp(10px, 1.05vw, 12px);
		font-weight: 600;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		box-shadow:
			0 6px 20px rgba(0, 0, 0, 0.45),
			0 0 0 0 rgba(196, 69, 42, 0.55);
		animation: cta-breathe 3s ease-in-out infinite;
		transition:
			transform 0.22s var(--ease),
			background 0.3s ease,
			box-shadow 0.3s ease;
	}
	.cta-glyph {
		font-size: 1.05em;
		line-height: 1;
		transform: translateY(0.5px);
	}
	/* a light sweeps across the face on hover */
	.feat-cta::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -60%;
		width: 40%;
		background: linear-gradient(100deg, transparent, rgba(233, 225, 208, 0.45), transparent);
		transform: skewX(-18deg);
		transition: left 0.55s var(--ease);
	}
	.feat-cta:hover {
		transform: translateY(-2px);
		background: #d8512f;
		box-shadow:
			0 10px 26px rgba(0, 0, 0, 0.5),
			0 0 26px rgba(196, 69, 42, 0.6);
	}
	.feat-cta:hover::after {
		left: 120%;
	}
	.feat-cta:active {
		transform: translateY(0);
	}
	.feat-cta.pending {
		background: rgba(233, 225, 208, 0.12);
		color: var(--stone);
		box-shadow: none;
		animation: none;
		cursor: default;
	}
	.feat-cta.pending:hover {
		transform: none;
		background: rgba(233, 225, 208, 0.12);
		box-shadow: none;
	}
	.feat-cta.pending::after {
		display: none;
	}

	@keyframes cta-breathe {
		0%,
		100% {
			box-shadow:
				0 6px 20px rgba(0, 0, 0, 0.45),
				0 0 0 0 rgba(196, 69, 42, 0.55);
		}
		50% {
			box-shadow:
				0 6px 20px rgba(0, 0, 0, 0.45),
				0 0 0 7px rgba(196, 69, 42, 0);
		}
	}

	/* ---- the two doors -------------------------------------- */
	.doors {
		flex: 0 0 auto;
		display: flex;
		gap: clamp(10px, 1.6vw, 20px);
	}
	.door {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		height: clamp(88px, 14vh, 156px);
		display: flex;
		align-items: flex-end;
		gap: clamp(10px, 1.4vw, 18px);
		padding: clamp(12px, 1.5vw, 20px) clamp(12px, 1.5vw, 20px) clamp(6px, 0.8vw, 10px);
		overflow: hidden;
		cursor: pointer;
		font: inherit;
		text-align: left;
		color: var(--paper);
		background: rgba(233, 225, 208, 0.025);
		border: 1px solid rgba(233, 225, 208, 0.18);
		border-radius: 2px;
		transition: color 0.4s var(--ease);
	}
	/* the fill sweeps up from the floor of the button */
	.door::before {
		content: '';
		position: absolute;
		inset: 0;
		transform: scaleY(0);
		transform-origin: bottom;
		transition: transform 0.5s var(--ease);
	}
	.door.rust::before {
		background: var(--rust);
	}
	.door.jade::before {
		background: var(--jade);
	}
	.door:hover::before,
	.door:focus-visible::before {
		transform: scaleY(1);
	}
	.door.jade:hover,
	.door.jade:focus-visible {
		color: var(--ink);
	}
	.door > * {
		position: relative;
	}
	.door-n {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		padding-bottom: clamp(10px, 1.6vh, 20px);
		opacity: 0.75;
	}
	.door-label {
		font-family: var(--serif);
		font-weight: 500;
		font-size: clamp(38px, 6.2vw, 96px);
		line-height: 1;
		letter-spacing: -0.03em;
		flex: 1 1 auto;
	}
	.door-arrow {
		font-size: clamp(15px, 1.6vw, 22px);
		padding-bottom: clamp(10px, 1.6vh, 20px);
		transition: transform 0.45s var(--ease);
	}
	.door:hover .door-arrow {
		transform: translate(6px, -6px);
	}

	/* ---- utility strip -------------------------------------- */
	.strip {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding-top: clamp(8px, 1.2vh, 14px);
		border-top: 1px solid rgba(233, 225, 208, 0.12);
	}
	.socials {
		display: flex;
		align-items: center;
		gap: clamp(10px, 1.4vw, 18px);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.social {
		display: flex;
		align-items: center;
	}
	.social-btn {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		flex: 0 0 auto;
	}
	.social-handle {
		display: grid;
		grid-template-columns: 0fr;
		opacity: 0;
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.1em;
		color: var(--dust);
		user-select: text;
		cursor: text;
		transition:
			grid-template-columns 0.45s var(--ease),
			opacity 0.3s ease;
	}
	.social-handle > span {
		overflow: hidden;
		min-width: 0;
		white-space: nowrap;
		padding-right: 6px;
	}
	.social:hover .social-handle,
	.social:focus-within .social-handle {
		grid-template-columns: 1fr;
		opacity: 1;
	}
	.socials img {
		width: 16px;
		height: 16px;
		object-fit: contain;
		filter: brightness(0) invert(1);
		opacity: 0.55;
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
	}
	.social:hover .social-btn img,
	.social:focus-within .social-btn img {
		opacity: 1;
	}

	.hint {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--stone);
		animation: jf-hint-bob 2.4s ease-in-out infinite;
	}

	.avail {
		display: flex;
		align-items: center;
		gap: clamp(8px, 1.1vw, 14px);
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--stone);
	}
	.jade-dot {
		color: var(--jade);
	}
	.avail-label {
		color: var(--jade);
	}
	/* the rule is drawn, not part of the box — a border here made these
	   links a few px taller than "Open to roles" and knocked the row off */
	.avail .doc {
		position: relative;
		color: var(--dust);
		transition: color 0.3s ease;
	}
	.avail .doc::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -4px;
		height: 1px;
		background: rgba(233, 225, 208, 0.25);
		transition: background 0.3s ease;
	}
	.avail .doc:hover {
		color: var(--rust);
	}
	.avail .doc:hover::after {
		background: var(--rust);
	}

	/* ---- narrow --------------------------------------------- */
	@media (max-width: 860px) {
		.body {
			flex-direction: column;
		}
		.featured {
			flex: 0 0 30dvh;
		}
		.hero {
			flex: 1 1 auto;
		}
		.ghost {
			top: 8%;
		}
	}
	@media (max-width: 560px) {
		.teaser-long,
		.social-handle,
		.hint {
			display: none;
		}
		.teaser {
			gap: 7px;
			padding: 6px 10px;
			font-size: 9px;
			letter-spacing: 0.12em;
		}
		.strip {
			flex-wrap: wrap;
			gap: 10px 14px;
		}
		.loc {
			display: none;
		}
		.wordmark {
			font-size: 11px;
			letter-spacing: 0.16em;
		}
		.door-label {
			font-size: clamp(28px, 8.4vw, 44px);
		}
		.door {
			height: clamp(72px, 11vh, 110px);
			gap: 8px;
		}
		.avail {
			letter-spacing: 0.14em;
			gap: 8px;
		}
		/* the signature would wrap mid-hyphenate at this width */
		.signature {
			flex-direction: column;
			align-items: flex-start;
			gap: 5px;
			letter-spacing: 0.2em;
		}
		.sig-sep {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hint,
		.feat-cta {
			animation: none;
		}
	}
</style>
