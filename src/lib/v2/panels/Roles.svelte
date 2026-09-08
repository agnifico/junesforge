<script>
	import { roles as c } from '../content.js';

	/* The toolbelt is a six-item aside. At desk width it costs one line and can
	   simply sit there; on a phone it was six lines competing with the history
	   above it, so there it collapses behind its own kicker. Read once at init
	   rather than in onMount so the first client render already has the right
	   state — prerender has no window and falls through to open, which is the
	   safer of the two to flash. */
	let narrow = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
	);

	$effect(() => {
		const mq = window.matchMedia('(max-width: 760px)');
		const sync = () => (narrow = mq.matches);
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});
</script>

<div
	class="jf-bloom"
	style="top:-14%; left:-10%; width:46vw; height:46vw;
	       background:radial-gradient(circle, rgba(196,69,42,.20), transparent 62%)"
></div>

<div class="wrap jf-in">
	<div class="status">
		<span class="dot"></span>{c.status}
	</div>

	<div class="roles">
		<div class="primary">
			<div class="role-title">{c.primary.title}</div>
			<div class="meta">{c.primary.meta}</div>
		</div>
		<div class="docs-col">
			<div class="docs">
				{#each c.docs as d}
					<a href={d.href} target="_blank" rel="noopener noreferrer">{d.label}</a>
				{/each}
			</div>
		</div>
	</div>

	<div class="history-wrap">
		<div class="jf-kicker">{c.historyKicker}</div>
		<div class="history">
			{#each c.history as h}
				<div
					class="item"
					class:tone-rust={h.tone === 'rust'}
					class:tone-jade={h.tone === 'jade'}
				>
					<div
						class="when"
						class:jf-rust={h.tone === 'rust'}
						class:jf-jade={h.tone === 'jade'}
					>
						{h.when}
					</div>
					<div class="what">{h.what}</div>
					<p class="detail">{h.detail}</p>
				</div>
			{/each}
		</div>

		<details class="toolbelt" open={!narrow}>
			<summary class="jf-kicker">{c.toolbeltKicker}</summary>
			<span class="tools">{c.toolbelt}</span>
		</details>
	</div>
</div>

<style>
	.wrap {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 9px;
		font-family: var(--mono);
		font-size: 10.5px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--stone);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--jade);
		animation: jf-pulse-dot 2s ease-in-out infinite;
	}

	.roles {
		display: flex;
		flex-wrap: wrap;
		gap: clamp(12px, 2.4vw, 40px);
		align-items: flex-end;
		margin-top: clamp(5px, 0.8vw, 10px);
		padding-bottom: clamp(10px, 1.5vw, 18px);
		border-bottom: 1px solid rgba(233, 225, 208, 0.16);
	}
	.primary {
		flex: 1 1 300px;
		min-width: 0;
	}
	.docs-col {
		flex: 0 1 auto;
		min-width: 0;
	}
	.role-title {
		font-family: var(--serif);
		font-size: clamp(26px, 3.6vw, 50px);
		line-height: 0.98;
		letter-spacing: -0.02em;
	}
	.meta {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--stone);
		margin-top: 8px;
	}
	.docs {
		display: flex;
		gap: 14px;
		margin-top: 12px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.docs a {
		color: var(--jade);
		border-bottom: 1px solid rgba(63, 176, 141, 0.5);
		padding-bottom: 2px;
	}
	.docs a:hover {
		color: var(--rust);
		border-bottom-color: var(--rust);
	}

	.history-wrap {
		margin-top: clamp(8px, 1.3vw, 20px);
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.history {
		margin-top: clamp(10px, 1.6vw, 20px);
		display: flex;
		flex-wrap: wrap;
		gap: clamp(10px, 1.6vw, 22px);
	}
	.item {
		flex: 1 1 200px;
		min-width: 0;
		border-top: 2px solid rgba(233, 225, 208, 0.28);
		padding-top: 12px;
	}
	.item.tone-rust {
		border-top-color: var(--rust);
	}
	.item.tone-jade {
		border-top-color: var(--jade);
	}
	.when {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.16em;
		color: var(--stone);
	}
	.what {
		font-family: var(--subhead);
		font-weight: 600;
		font-size: clamp(17px, 1.78vw, 23px);
		line-height: 1.12;
		letter-spacing: -0.005em;
		margin-top: 4px;
	}
	.detail {
		margin: 5px 0 0;
		font-size: clamp(12.5px, 1.15vw, 15px);
		font-weight: 300;
		line-height: 1.3;
		color: var(--ash);
		text-wrap: pretty;
	}

	.toolbelt {
		margin-top: auto;
		padding-top: clamp(10px, 1.4vw, 18px);
	}
	.toolbelt > summary {
		list-style: none;
		cursor: pointer;
	}
	.toolbelt > summary::-webkit-details-marker {
		display: none;
	}
	.toolbelt > summary:focus-visible {
		outline: 2px solid var(--jade);
		outline-offset: 3px;
	}
	/* At desk width it is never collapsed, so the affordance would be a lie. */
	@media (min-width: 761px) {
		.toolbelt > summary {
			cursor: default;
			pointer-events: none;
		}
	}
	/* Was uppercase mono at 9.5px — the same register as every kicker on the
	   deck, so six items of it carried as much weight as the headings above and
	   read as a second wall of type. As lowercase body copy it recedes to what
	   it is: a footnote you can skim past. */
	.tools {
		display: block;
		margin-top: 5px;
		font-family: var(--body);
		font-size: clamp(12.5px, 1.2vw, 14px);
		font-weight: 300;
		letter-spacing: 0;
		text-transform: none;
		line-height: 1.45;
		color: var(--stone);
	}

	/* ---- narrow ---------------------------------------------------------
	   This panel had no breakpoint at all, so on a phone it inherited desktop
	   type sizes over a single 340px column: the role title alone ran to three
	   lines, and four history entries plus the toolbelt stacked underneath it.
	   The fix is mostly air — smaller headline, real gaps between entries, and
	   looser leading on the detail copy, which was set at 1.3 for a wide
	   measure and reads as a wall at phone width. */
	@media (max-width: 760px) {
		/* Everything below is vh-based on purpose: the panel had a lot of dead
		   height at the bottom, so the rhythm grows with the screen and spends
		   it between the blocks instead of dumping it all after the last line. */
		.status {
			margin-bottom: clamp(12px, 2.6vh, 22px);
		}
		.roles {
			align-items: flex-start;
			/* Above the résumé links. */
			gap: clamp(24px, 5vh, 46px);
			/* And below them, before the rule. */
			padding-bottom: clamp(24px, 5vh, 46px);
		}
		.history-wrap {
			margin-top: clamp(14px, 3vh, 28px);
		}
		.primary,
		.docs-col {
			flex: 1 1 100%;
		}
		.role-title {
			font-size: clamp(23px, 6.6vw, 31px);
			line-height: 1.06;
		}
		.meta {
			margin-top: 9px;
		}
		.docs-col .docs {
			margin-top: 0;
		}

		.history {
			gap: clamp(24px, 4.6vh, 42px);
		}
		.item {
			flex: 1 1 100%;
			padding-top: 10px;
		}
		.detail {
			line-height: 1.45;
		}

		.toolbelt {
			/* Below the four history entries. Not `auto` here — pinning it to the
			   bottom is what left one big void rather than spread space. */
			margin-top: clamp(32px, 6.5vh, 64px);
			/* Last thing on the panel — keep it off the home indicator. */
			padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
		}
		/* Marks it as openable — the only control on the panel that has state. */
		.toolbelt > summary::after {
			content: ' +';
			color: var(--jade);
		}
		.toolbelt[open] > summary::after {
			content: ' –';
		}
	}
</style>
