<script>
	/* =========================================================
	   06 · WHY — the agencies argument, on the home page.
	   Left: the receipt, one number and two bars, with the story
	   behind "Read what happened". Right: each charge against an
	   agency, paired with what you get here instead. Under both, the
	   close. The long read stays at /next/agencies, linked from the
	   close. Copy: content.js (why; the receipt is versus.receipt,
	   shared with that page).
	   ========================================================= */
	import { why as c, versus, enquiry } from '../content.js';

	const r = versus.receipt;
	const close = versus.close;

	/* The agency's bill splits into what the maker was paid, the
	   markup on that, and the agency's own fee. */
	const f = r.figures;
	const agency = f.billed + f.fee;
	const multiple = Number((agency / f.direct).toFixed(2));
	const segments = [
		{ kind: 'work', v: f.paid },
		{ kind: 'markup', v: f.billed - f.paid },
		{ kind: 'fee', v: f.fee }
	];

	/* A part of a bar too thin for its name shows it in a tag above:
	   on hover, or while the bars have focus (a tap, or Tab). Screen
	   readers get all of it from the bars' label instead. */
	let bars;
	$effect(() => {
		const mark = () => {
			for (const seg of bars.querySelectorAll('.seg')) {
				const name = seg.firstElementChild;
				seg.toggleAttribute('data-cut', name.scrollWidth > name.clientWidth + 1);
			}
		};
		const ro = new ResizeObserver(mark);
		ro.observe(bars);
		document.fonts?.ready.then(mark); // the web font can change what fits
		return () => ro.disconnect();
	});

	let story; // the <dialog>
	// a click on the backdrop lands on the dialog itself, not its card
	const onBackdrop = (e) => e.target === story && story.close();
</script>

<div class="jf-s">
	<div class="jf-s-wrap">
		<p class="jf-s-label jf-in">{c.eyebrow}</p>
		<div class="halves">
			<!-- the receipt -->
			<section class="receipt jf-in" aria-labelledby="why-receipt">
				<h2 class="jf-s-h2" id="why-receipt">{r.heading}</h2>
				<div class="gap">
					<p class="big">{multiple}×</p>
					<p class="what">{r.multiple}</p>
				</div>
				<!-- focusable so a tap or Tab can show the names the bars
				     are too thin for; the label carries the whole chart -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class="bars"
					bind:this={bars}
					tabindex="0"
					role="img"
					aria-label="{r.bars.agency}: {r.bars.work}, {r.bars.markup} and {r.bars.fee}, {multiple} times as long as {r
						.bars.direct}."
				>
					<div class="bar-row">
						<span class="who">{r.bars.direct}</span>
						<div class="track">
							<div class="seg work" style="flex-basis:{(f.direct / agency) * 100}%">
								<span class="name">{r.bars.work}</span>
								<span class="tip">{r.bars.work}</span>
							</div>
						</div>
					</div>
					<div class="bar-row">
						<span class="who">{r.bars.agency}</span>
						<div class="track">
							{#each segments as s (s.kind)}
								<div class="seg {s.kind}" style="flex-basis:{(s.v / agency) * 100}%">
									<span class="name">{r.bars[s.kind]}</span>
									<span class="tip">{r.bars[s.kind]}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
				<button type="button" class="jf-s-btn ghost story-open" onclick={() => story.showModal()}>
					{r.open} <span class="arr">→</span>
				</button>
			</section>

			<!-- each charge, and the answer to it -->
			<section class="instead jf-in" aria-labelledby="why-instead">
				<h3 class="sub" id="why-instead">{c.instead}</h3>
				<ol class="pairs">
					{#each c.pairs as p (p.answer)}
						<li>
							<p class="charge"><span class="side">{c.sides.agency}</span> <span class="struck">{p.charge}</span></p>
							<p class="answer">
								<span class="side">{c.sides.here}</span>
								<b>{p.answer}</b>
								{p.blurb}
							</p>
						</li>
					{/each}
				</ol>
			</section>
		</div>

		<!-- the close -->
		<div class="close jf-in">
			<h2 class="huge">
				{#each close.heading as line, k (k)}
					<span class:em={k === close.heading.length - 1}>{line}</span>
				{/each}
			</h2>
			<div class="close-side">
				<p>{close.lede}</p>
				<div class="ctas">
					<a class="jf-s-btn primary" href={enquiry.href}>{enquiry.label} <span class="arr">→</span></a>
					<a class="jf-s-btn ghost" href={c.more.href}>{c.more.label} <span class="arr">→</span></a>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- a click on the backdrop closes it; Esc works on its own -->
<dialog class="story" bind:this={story} onclick={onBackdrop} aria-labelledby="why-story">
	<div class="card">
		<h2 id="why-story">{r.heading}</h2>
		{#each r.story as para (para)}
			<p>{para}</p>
		{/each}
		<button type="button" class="x" aria-label="Close" onclick={() => story.close()}></button>
	</div>
</dialog>

<style>
	.em {
		color: var(--em);
	}

	.halves {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: clamp(36px, 5vw, 88px);
		align-items: start;
	}

	/* ---- the receipt ---------------------------------------- */
	.receipt .jf-s-h2 {
		font-size: clamp(30px, 3.6vw, 52px);
		text-wrap: balance;
	}
	.gap {
		margin-top: clamp(22px, 3svh, 40px);
	}
	.big {
		margin: 0;
		font-weight: 900;
		font-size: clamp(72px, min(10vw, 17svh), 168px);
		line-height: 0.82;
		letter-spacing: -0.06em;
		color: var(--em);
		font-variant-numeric: tabular-nums;
	}
	/* a caption under the number, two lines at most */
	.what {
		margin: 14px 0 0;
		max-width: 34ch;
		font-size: clamp(17px, 1.4vw, 21px);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.15;
		text-wrap: balance;
	}
	.bars {
		display: grid;
		gap: 12px;
		margin-top: clamp(22px, 3svh, 40px);
	}
	.bar-row {
		display: grid;
		grid-template-columns: 130px minmax(0, 1fr);
		align-items: center;
		gap: 14px;
	}
	.bar-row .who {
		font-size: 13.5px;
		font-weight: 700;
		color: var(--s-grey);
	}
	.track {
		display: flex;
		height: clamp(34px, 5svh, 44px);
	}
	.bars:focus {
		outline: none;
	}
	.bars:focus-visible {
		outline: 2px solid var(--em);
		outline-offset: 6px;
		border-radius: 4px;
	}
	.seg {
		position: relative;
		flex: 0 0 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		padding: 0 10px;
		border-right: 2px solid var(--s-black);
		font-size: 12.5px;
		font-weight: 700;
		white-space: nowrap;
	}
	.seg .name {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* the name in full, in a tag over its part, in the part's colour */
	.tip {
		position: absolute;
		right: -2px;
		bottom: calc(100% + 8px);
		padding: 6px 10px;
		border-radius: 6px;
		background: inherit;
		color: inherit;
		opacity: 0;
		transform: translateY(4px);
		pointer-events: none;
		transition:
			opacity 0.18s ease,
			transform 0.18s ease;
	}
	.tip::after {
		content: '';
		position: absolute;
		right: 12px;
		top: 100%;
		border: 5px solid transparent;
		border-top-color: var(--tip, var(--em));
	}
	.seg.work .tip::after {
		--tip: var(--s-white);
	}
	.seg.markup .tip::after {
		--tip: #1d8f63;
	}
	.bar-row:hover .seg:global([data-cut]) .tip,
	.bars:focus .seg:global([data-cut]) .tip {
		opacity: 1;
		transform: none;
	}
	.seg.work {
		background: var(--s-white);
		color: var(--s-black);
	}
	.seg.markup {
		background: repeating-linear-gradient(-45deg, #1d8f63 0 6px, #157a53 6px 12px);
		color: #fff;
	}
	.seg.fee {
		background: var(--em);
		color: var(--s-black);
	}
	.story-open {
		margin-top: clamp(22px, 3svh, 36px);
	}

	/* ---- each charge, and the answer ------------------------ */
	.sub {
		margin: 0;
		font-size: clamp(26px, 2.6vw, 36px);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.pairs {
		list-style: none;
		margin: clamp(20px, 3svh, 32px) 0 0;
		padding: 0;
	}
	.pairs li {
		padding: clamp(16px, 2.4svh, 24px) 0;
		border-top: 1px solid var(--s-line);
	}
	.side {
		display: block;
		margin-bottom: 6px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.charge {
		margin: 0;
		font-size: 15.5px;
		line-height: 1.4;
		color: var(--s-grey);
	}
	/* the struck line is only decoration: the label says whose it is */
	.struck {
		text-decoration: line-through;
		text-decoration-color: rgba(244, 244, 241, 0.35);
	}
	.answer {
		margin: 14px 0 0;
		font-size: 15.5px;
		line-height: 1.45;
		color: #b4b4ae;
		text-wrap: pretty;
	}
	.answer .side {
		color: var(--em);
	}
	.answer b {
		display: block;
		margin-bottom: 4px;
		font-size: clamp(19px, 1.6vw, 22px);
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--s-white);
	}

	/* ---- the close ------------------------------------------ */
	.close {
		margin-top: clamp(40px, 6svh, 80px);
		padding-top: clamp(28px, 4svh, 48px);
		border-top: 1px solid var(--s-line);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 24px clamp(36px, 5vw, 88px);
		align-items: end;
	}
	.huge {
		margin: 0;
		font-weight: 900;
		font-size: clamp(44px, min(7.4vw, 12svh), 128px);
		line-height: 0.88;
		letter-spacing: -0.055em;
		text-transform: uppercase;
	}
	.huge span {
		display: block;
	}
	.close-side p {
		margin: 0;
		max-width: 44ch;
		font-size: clamp(17px, 1.5vw, 20px);
		line-height: 1.5;
		color: #cfcfc9;
	}
	.ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 22px;
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
	.card h2 {
		margin: 0 0 22px;
		padding-right: 36px;
		font-size: clamp(26px, 3vw, 34px);
		font-weight: 800;
		line-height: 1.02;
		letter-spacing: -0.03em;
	}
	.card p {
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

	@media (max-width: 960px) {
		.halves,
		.close {
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
	}
	@media (prefers-reduced-motion: reduce) {
		.story[open] {
			animation: none;
		}
		.tip {
			transition: none;
		}
	}
</style>
