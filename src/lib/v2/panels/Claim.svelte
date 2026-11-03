<script>
	/* =========================================================
	   The claim beside the circuit taken apart, in the second half
	   of the home scene (Board.svelte places it and fades it in).
	   With the parts beside it, what "without the agency" means is
	   shown rather than said. Copy is in content.js (hero).
	   ========================================================= */
	import { hero as c, enquiry } from '../content.js';
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
		</div>
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
	.place {
		margin: clamp(28px, 3.4vw, 40px) 0 0;
		font-size: 14px;
		color: var(--s-grey);
	}

	@media (max-width: 900px) {
		.copy {
			padding-right: var(--pad-r);
		}
		/* the drawing takes the top of the screen: keep the claim short */
		.place {
			display: none;
		}
	}
</style>
