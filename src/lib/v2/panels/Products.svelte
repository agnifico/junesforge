<script>
	/* 04 · PRODUCTS — every digital thing, one screen.
	   Four cards in a row on desktop, 2×2 on tablet, stacked on phone.
	   Each card is one link; the shot on top covers a 16:9 window so
	   screenshots of any size drop straight in. */
	import { products as c } from '../content.js';
</script>

<div class="jf-grain"></div>
<div
	class="bloom"
	style="top:-30%; left:-10%; width:58vw; height:58vw;
	       background:radial-gradient(circle, rgba(31,107,88,.22), transparent 64%);
	       transform:translate(calc(var(--px) * -24px), calc(var(--py) * -18px))"
></div>

<div class="body jf-pad jf-in">
	<!-- No index/kicker line here. It is kept on Design and Code, where the
	     numbering actually carries something (the two halves of "what I do"),
	     and dropped on Products and Gallery, where it was only labelling a
	     heading that already says the same thing. -->
	<div class="head">
		<h2 class="jf-title">{c.heading}</h2>
	</div>

	<div class="cards">
		{#each c.cards as p (p.title)}
			<!-- A card with no href yet renders as a div, not an <a href="">,
			     which would reload the page on click.

			     Every card opens in a new tab, Propsize included even though it is
			     on this same site: the deck is a fixed, full-viewport stage with no
			     way to restore its own position on a Back navigation, so an in-tab
			     hop left you stranded on return. -->
			<svelte:element
				this={p.href ? 'a' : 'div'}
				class="card {p.tone}"
				class:pending={!p.href}
				href={p.href || undefined}
				target={p.href ? '_blank' : undefined}
				rel={p.href ? 'noopener noreferrer' : undefined}
			>
				<div class="shot">
					<img class:hud={p.crop === 'hud'} src={p.src} alt={p.title} />
					<span class="status">
						{#if p.live}<span class="jf-dot"></span>{/if}{p.status}
					</span>
				</div>

				<div class="text">
					<div class="card-title">{p.title}</div>
					<div class="card-meta">{p.meta}</div>
					<p class="card-blurb">{p.blurb}</p>
					<span class="cta">{p.cta}{#if p.href}<span class="arrow"> →</span>{/if}</span>
				</div>
			</svelte:element>
		{/each}
	</div>

	<!-- <div class="foot">{c.caption}</div> -->
</div>

<style>
	.bloom {
		position: absolute;
		pointer-events: none;
	}

	.body {
		position: relative;
		/* grow to fill a short screen, but never shrink below its content — a
		   wrapped second row of cards has to push the screen's scroll height
		   past the viewport rather than be squashed into it. */
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
	}

	.head {
		flex: 0 0 auto;
	}
	.head .jf-title {
		margin: 0;
		font-size: clamp(38px, 6.4vw, 88px);
	}

	.cards {
		/* No `min-height: 0` here: that let the grid shrink below its rows, so a
		   second row would have collapsed instead of overflowing. It still grows
		   to fill spare height, which is what keeps a single row centred. */
		flex: 1 1 auto;
		display: grid;
		/* Was a hard `repeat(4, 1fr)`, which only ever worked because there were
		   exactly four products. auto-fit fits as many 230px tracks as the width
		   allows and wraps the rest, so the shelf takes a sixth and a seventh
		   without another edit — five across at desk width, three at laptop. */
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
		gap: clamp(10px, 1.4vw, 20px);
		align-content: center;
		/* Heading and cards were nearly touching. The top margin is now its own
		   deliberate gap rather than the same value as the bottom. */
		margin: clamp(26px, 5vh, 56px) 0 clamp(12px, 2vh, 26px);
	}

	.card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border: 1px solid rgba(233, 225, 208, 0.16);
		border-radius: 3px;
		overflow: hidden;
		background: rgba(233, 225, 208, 0.025);
		transition:
			border-color 0.35s ease,
			background 0.35s ease,
			transform 0.35s var(--ease);
	}
	.card:hover {
		transform: translateY(-4px);
		background: rgba(233, 225, 208, 0.05);
	}
	/* Nothing to click yet — no lift, no pointer. */
	.card.pending {
		cursor: default;
	}
	.card.pending:hover {
		transform: none;
		background: rgba(233, 225, 208, 0.025);
	}
	.card.pending .cta {
		opacity: 0.55;
	}
	.card.jade:hover {
		border-color: var(--jade);
	}
	.card.rust:hover {
		border-color: var(--rust);
	}
	.card.brass:hover {
		border-color: var(--brass);
	}

	.shot {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: var(--ink);
	}
	.shot img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		display: block;
		filter: saturate(0.92) brightness(0.92);
		transition:
			transform 0.9s var(--ease),
			filter 0.4s ease;
	}
	/* game shots carry a HUD along the bottom edge — crop past it */
	.shot img.hud {
		transform: scale(1.26) translateY(6%);
	}
	.card:hover .shot img.hud {
		transform: scale(1.31) translateY(6%);
	}
	.card:hover .shot img {
		transform: scale(1.05);
		filter: saturate(1.05) brightness(1);
	}
	.status {
		position: absolute;
		left: 9px;
		top: 9px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 9px;
		border-radius: 2px;
		background: rgba(20, 17, 14, 0.82);
		font-family: var(--mono);
		font-size: 8.5px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--paper);
	}
	.card.jade .status {
		color: var(--jade);
	}
	.card.rust .status {
		color: var(--rust);
	}
	.card.brass .status {
		color: var(--brass);
	}

	.text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: clamp(11px, 1.3vw, 17px);
	}
	.card-title {
		font-family: var(--subhead);
		font-weight: 600;
		/* Capped lower than the 29px this was: at five across, a column is only
		   ~250px and the old size left the titles wrapping and crowding the
		   blurb under them. */
		font-size: clamp(18px, 1.5vw, 24px);
		line-height: 1.1;
		letter-spacing: -0.005em;
		color: var(--paper);
	}
	.card-meta {
		font-family: var(--mono);
		font-size: 8.5px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--stone);
	}
	.card-blurb {
		margin: 4px 0 0;
		font-size: clamp(13px, 1.2vw, 15px);
		font-weight: 300;
		line-height: 1.4;
		color: var(--ash);
		text-wrap: pretty;
	}
	.cta {
		margin-top: auto;
		padding-top: clamp(8px, 1.2vw, 14px);
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--paper);
	}
	.arrow {
		display: inline-block;
		transition: transform 0.35s var(--ease);
	}
	.card:hover .arrow {
		transform: translateX(4px);
	}

	.foot {
		flex: 0 0 auto;
		padding-top: clamp(8px, 1.2vw, 14px);
		border-top: 1px solid rgba(233, 225, 208, 0.12);
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--stone);
	}

	@media (max-width: 560px) {
		/* Five cards at ~180px each overran the viewport before the heading was
		   even counted. This is a compact list row instead: a fixed square
		   thumbnail, title, and a two-line blurb — about 96px a card, so five
		   (and a sixth) sit inside one screen with the heading above them. */
		.cards {
			grid-template-columns: 1fr;
			/* `safe` so a sixth or seventh product falls back to start-aligned
			   and scrolls, rather than centring and clipping both ends. */
			align-content: safe center;
			gap: 10px;
			margin: clamp(16px, 3vh, 30px) 0 0;
		}
		.card {
			flex-direction: row;
			align-items: stretch;
		}
		.shot {
			/* Square rather than a percentage: the row's height is set by the
			   copy, and a square thumb reads consistently whatever the source
			   shot's aspect is. Sized off viewport height so the shelf spends
			   whatever room the screen has on the screenshots — the one thing
			   on this panel actually worth looking at — while still fitting
			   five rows on a short phone. */
			flex: 0 0 clamp(84px, 13vh, 116px);
			aspect-ratio: 1;
			min-height: 0;
		}
		.shot img {
			position: absolute;
			inset: 0;
		}
		/* The badge can't sit legibly on an 88px thumb, and the CTA line below
		   already carries the same state — "Play now" / "Coming soon". */
		.status {
			display: none;
		}
		.text {
			padding: 9px 12px;
			gap: 1px;
			justify-content: center;
		}
		.card-title {
			font-size: 16.5px;
			line-height: 1.15;
		}
		/* The tagline repeats what the blurb says, in the room the blurb needs. */
		.card-meta {
			display: none;
		}
		.card-blurb {
			margin-top: 2px;
			font-size: 12.5px;
			line-height: 1.3;
			/* Hard two-line cap: one long blurb must not be able to grow a row
			   and push the shelf back off the screen. */
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
		.cta {
			/* The base rule pushes this to the bottom with margin-top:auto plus a
			   padding-top; in a 96px row both have to go or the row grows. */
			margin-top: 3px;
			padding-top: 0;
			font-size: 8.5px;
		}
	}
</style>
