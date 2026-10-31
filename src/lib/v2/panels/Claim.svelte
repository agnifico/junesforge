<script>
	/* =========================================================
	   The claim beside the circuit taken apart, in the second half
	   of the home scene (Board.svelte places it and fades it in).
	   With the parts beside it, what "without the agency" means is
	   shown rather than said. Copy is in content.js (hero).
	   ========================================================= */
	import { hero as c, enquiry } from '../content.js';

	let { goto = () => {} } = $props();
</script>

<div class="jf-s copy">
	<div class="jf-in">
		<h2>
			<span>{c.headline[0]}</span>
			<span class="em">{c.headline[1]}</span>
		</h2>
		<p class="jf-s-lede">{c.lede}</p>
		<div class="ctas">
			<a class="jf-s-btn primary" href={enquiry.href}>{enquiry.label} <span class="arr">→</span></a>
			<button type="button" class="jf-s-btn ghost" onclick={() => goto(c.secondary.goto)}>
				{c.secondary.label}
			</button>
		</div>
		<dl class="facts">
			{#each c.facts as f}
				<div>
					<dt>{f.k}</dt>
					<dd>{f.v}</dd>
				</div>
			{/each}
		</dl>
		<p class="place">{c.place}</p>
	</div>
</div>

<style>
	/* On the left; the drawing has the right (.pose.parts in Board). */
	.copy {
		position: relative;
		width: 100%;
		box-sizing: border-box;
		padding-top: var(--pad-y);
		padding-bottom: var(--pad-y);
		padding-left: var(--pad-x);
		padding-right: 58%;
	}
	h2 {
		margin: 0;
		font-weight: 800;
		font-size: clamp(36px, 4.4vw, 68px);
		line-height: 0.95;
		letter-spacing: -0.04em;
		text-wrap: balance;
	}
	h2 span {
		display: block;
	}
	.em {
		color: var(--em);
	}
	.copy .jf-s-lede {
		margin-top: clamp(20px, 2.6vw, 30px);
		font-size: clamp(17px, 1.4vw, 20px);
		color: #b4b4ae;
	}
	.ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: clamp(24px, 3vw, 36px);
	}
	.facts {
		margin: clamp(32px, 4vw, 48px) 0 0;
		padding-top: 22px;
		border-top: 1px solid var(--s-line);
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px 28px;
	}
	.facts dt {
		font-size: clamp(24px, 2.2vw, 32px);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.facts dd {
		margin: 8px 0 0;
		font-size: 14px;
		line-height: 1.35;
		color: var(--s-grey);
	}
	.place {
		margin: 22px 0 0;
		font-size: 14px;
		color: var(--s-grey);
	}

	@media (max-width: 900px) {
		.copy {
			padding-right: var(--pad-r);
		}
		/* the drawing takes the top of the screen: keep the claim short */
		.facts,
		.place {
			display: none;
		}
	}
</style>
