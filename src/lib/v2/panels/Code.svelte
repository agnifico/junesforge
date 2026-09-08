<script>
	import { code as c } from '../content.js';
</script>

<div class="jf-grid"></div>

<div class="jf-split reverse">
	<div class="jf-split-text jf-scroll jf-pad jf-in">
		<div class="head">
			<span class="jf-jade">{c.index}</span><span>{c.kicker}</span>
		</div>
		<h2 class="jf-display">{c.heading}</h2>
		<p class="jf-lede">{c.lede}</p>

		<div class="jf-list">
			{#each c.items as it}
				<div class="jf-row">
					<span class="jf-row-n jf-jade">{it.n}</span>
					<div style="flex:1 1 auto; min-width:0">
						<div class="jf-row-title">{it.title}</div>
						<div class="jf-row-blurb">{it.blurb}</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="jf-side wire">
		<div class="wire-grid"></div>
		<div class="jf-cube-wrap drift">
			<div class="jf-cube box">
				<span class="f front"></span>
				<span class="f back"></span>
				<span class="f right"></span>
				<span class="f left"></span>
				<span class="f top"></span>
				<span class="f bottom"></span>
			</div>
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
		color: var(--stone);
	}
	.wire {
		align-items: center;
		justify-content: center;
		background: #0f1512;
		border-left: 1px solid rgba(233, 225, 208, 0.1);
	}
	.wire-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(63, 176, 141, 0.12) 1px, transparent 1px),
			linear-gradient(90deg, rgba(63, 176, 141, 0.12) 1px, transparent 1px);
		background-size: 14px 14px;
	}
	.drift {
		transform: translate(calc(var(--px) * 26px), calc(var(--py) * 20px));
	}
	.box {
		width: clamp(120px, 16vw, 210px);
		height: clamp(120px, 16vw, 210px);
		/* Promotes the spinning cube to its own layer so the 1px strokes are
		   rasterised once and transformed, rather than re-rasterised every frame
		   at a new sub-pixel offset — that re-rasterising was the shimmer. */
		will-change: transform;
	}
	/* One stroke, six faces, no fills. The old version mixed three treatments —
	   a solid jade front over a translucent jade fill, plainer jade sides, and
	   dashed brass caps. Rotating, the translucent front kept compositing over
	   whatever face was behind it, and the dashes' phase shifted with the
	   perspective, so both flickered. A single flat stroke has nothing to
	   interfere with itself. */
	.f {
		--z: clamp(60px, 8vw, 105px);
		border: 1px solid rgba(63, 176, 141, 0.5);
		background: none;
	}
	.front {
		transform: translateZ(var(--z));
	}
	.back {
		transform: rotateY(180deg) translateZ(var(--z));
	}
	.right {
		transform: rotateY(90deg) translateZ(var(--z));
	}
	.left {
		transform: rotateY(-90deg) translateZ(var(--z));
	}
	.top {
		transform: rotateX(90deg) translateZ(var(--z));
	}
	.bottom {
		transform: rotateX(-90deg) translateZ(var(--z));
	}
</style>
