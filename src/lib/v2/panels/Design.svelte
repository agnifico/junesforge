<script>
	import { design as c } from '../content.js';
	import BrandMark from '../BrandMark.svelte';
</script>

<div class="jf-grain on-light"></div>

<div class="jf-split">
	<div class="jf-split-text jf-scroll jf-pad jf-in">
		<div class="head">
			<span class="jf-rust">{c.index}</span><span>{c.kicker}</span>
		</div>
		<h2 class="jf-display">{c.heading}</h2>
		<p class="jf-lede on-light">{c.lede}</p>

		<div class="jf-list on-light">
			{#each c.items as it}
				<div class="jf-row">
					<span class="jf-row-n jf-rust">{it.n}</span>
					<div style="flex:1 1 auto; min-width:0">
						<div class="jf-row-title">{it.title}</div>
						<div class="jf-row-blurb">{it.blurb}</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="jf-side art">
		<div class="art-inner">
			<BrandMark label={c.art.caption} />
		</div>
	</div>
</div>

<style>
	.head {
		display: flex;
		align-items: baseline;
		gap: 14px;
		font-family: var(--mono);
		font-size: 10.5px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--stone-dk);
	}
	.art {
		background: var(--dark-rust);
	}
	.art-inner {
		position: absolute;
		inset: 0;
		/* Vector now, so it is sized by padding rather than by cropping: the
		   mark simply fits whatever box is left and centres itself. */
		display: grid;
		place-items: center;
		padding: clamp(28px, 7%, 90px);
		transform: translate(calc(var(--px) * -14px), calc(var(--py) * -12px));
		transition: transform 0.6s ease-out;
	}
	@media (max-width: 760px) {
		/* No pointer parallax on a touch screen, and a tighter inset so the mark
		   fills the short strip properly. */
		.art-inner {
			padding: 20px;
			transform: none;
		}
	}
</style>
