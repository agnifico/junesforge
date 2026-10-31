<script>
	import { packages as c, enquiry } from '../content.js';
</script>

<div class="jf-s">
	<div class="jf-s-wrap">
		<div class="jf-s-head jf-in">
			<div>
				<p class="jf-s-label">Ways to work together</p>
				<h2 class="jf-s-h2">{c.heading}</h2>
			</div>
			<p class="jf-s-lede">{c.lede}</p>
		</div>

		<div class="grid">
			{#each c.items as p}
				<article class="pkg" class:featured={p.featured}>
					<h3>{p.name}</h3>
					<p class="for">{p.for}</p>
					<ul>
						{#each p.includes as line}
							<li>{line}</li>
						{/each}
					</ul>
					<div class="meta">
						<div>
							<span class="k">Timeline</span>
							<span class="v">{p.time}</span>
						</div>
						<div>
							<span class="k">Price</span>
							<span class="v">{p.from ? `From ${p.from}` : c.priceFallback}</span>
						</div>
					</div>
				</article>
			{/each}
		</div>

		<div class="cta">
			<p>Not sure which one fits? Tell me what you are building and I will suggest one.</p>
			<a class="jf-s-btn primary" href={enquiry.href}>{enquiry.label} <span class="arr">→</span></a>
		</div>
	</div>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 14px;
	}
	.pkg {
		display: flex;
		flex-direction: column;
		padding: 26px 24px 24px;
		border: 1px solid var(--s-line);
		border-radius: 14px;
		background: #151515;
	}
	.pkg.featured {
		border-color: var(--em);
		box-shadow: inset 0 0 0 1px var(--em);
	}
	h3 {
		margin: 0;
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.025em;
	}
	.featured h3 {
		color: var(--em);
	}
	.for {
		margin: 10px 0 0;
		font-size: 15.5px;
		line-height: 1.45;
		color: #b4b4ae;
		text-wrap: pretty;
	}
	ul {
		list-style: none;
		margin: 22px 0 0;
		padding: 18px 0 0;
		border-top: 1px solid var(--s-line);
		display: grid;
		gap: 10px;
	}
	li {
		position: relative;
		padding-left: 22px;
		font-size: 15px;
		line-height: 1.4;
	}
	li::before {
		content: '';
		position: absolute;
		left: 2px;
		top: 0.42em;
		width: 9px;
		height: 5px;
		border-left: 2px solid var(--em);
		border-bottom: 2px solid var(--em);
		transform: rotate(-45deg);
	}
	.meta {
		margin-top: auto;
		padding-top: 24px;
		display: grid;
		gap: 12px;
	}
	.meta div {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.k {
		font-size: 13px;
		color: var(--s-grey);
	}
	.v {
		font-size: 15.5px;
		font-weight: 700;
	}

	.cta {
		margin-top: clamp(28px, 3.4vw, 44px);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 18px 32px;
		padding-top: clamp(24px, 3vw, 36px);
		border-top: 1px solid var(--s-line);
	}
	.cta p {
		margin: 0;
		font-size: clamp(18px, 1.7vw, 22px);
		font-weight: 600;
		letter-spacing: -0.01em;
		max-width: 40ch;
	}

	@media (max-width: 1100px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 620px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
