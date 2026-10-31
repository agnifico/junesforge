<script>
	import { process as c, identity } from '../content.js';
</script>

<div class="jf-s">
	<div class="jf-s-wrap">
		<div class="jf-in">
			<p class="jf-s-label">Process</p>
			<h2 class="jf-s-h2">{c.heading}</h2>
		</div>

		<ol class="steps">
			{#each c.steps as s, k}
				<li>
					<span class="n">{k + 1}</span>
					<h3>{s.title}</h3>
					<p>{s.blurb}</p>
				</li>
			{/each}
		</ol>

		<div class="split">
			<section class="why">
				<h3 class="sub">{c.whyHeading}</h3>
				{#each c.why as w}
					<div class="why-row">
						<h4>{w.title}</h4>
						<p>{w.blurb}</p>
					</div>
				{/each}
				<a class="vs" href={c.whyLink.href}>{c.whyLink.label} <span class="arr">→</span></a>
			</section>

			<section class="about">
				<h3 class="sub">{c.about.heading}</h3>
				<div class="who">
					<div class="photo">
						{#if c.about.photo}
							<img src={c.about.photo} alt="Agni" />
						{:else}
							<img class="mark" src={identity.brand.logo} alt="" />
						{/if}
					</div>
					<div>
						{#each c.about.body as para}
							<p>{para}</p>
						{/each}
						{#if c.about.link.href}
							<a href={c.about.link.href} target="_blank" rel="noopener noreferrer">
								{c.about.link.label} ↗
							</a>
						{/if}
					</div>
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.steps {
		list-style: none;
		margin: clamp(36px, 5vw, 64px) 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0;
		border-top: 2px solid var(--s-black);
	}
	.steps li {
		padding: 22px 22px 6px 0;
	}
	.n {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--s-black);
		color: var(--s-white);
		font-size: 15px;
		font-weight: 700;
	}
	.steps h3 {
		margin: 18px 0 0;
		font-size: 21px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.steps p {
		margin: 8px 0 0;
		font-size: 15.5px;
		line-height: 1.45;
		color: var(--s-grey-dk);
		text-wrap: pretty;
	}

	.split {
		margin-top: clamp(56px, 8vw, 110px);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: clamp(36px, 5vw, 80px);
	}
	.sub {
		margin: 0 0 8px;
		font-size: clamp(28px, 3vw, 40px);
		font-weight: 800;
		letter-spacing: -0.03em;
	}
	.why-row {
		padding: 18px 0;
		border-bottom: 1px solid var(--s-line-dk);
	}
	.why-row h4 {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
	}
	.why-row p {
		margin: 6px 0 0;
		font-size: 15.5px;
		line-height: 1.45;
		color: var(--s-grey-dk);
	}

	.vs {
		display: inline-block;
		margin-top: 22px;
		font-weight: 700;
		color: var(--em-ink);
		border-bottom: 1.5px solid currentColor;
		padding-bottom: 2px;
	}
	.vs:hover {
		color: var(--s-black);
	}

	.who {
		display: grid;
		grid-template-columns: 120px minmax(0, 1fr);
		gap: 24px;
		margin-top: 18px;
	}
	.photo {
		width: 120px;
		aspect-ratio: 4 / 5;
		border-radius: 12px;
		overflow: hidden;
		background: var(--s-black);
		display: grid;
		place-items: center;
	}
	.photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.photo img.mark {
		width: 46%;
		height: auto;
	}
	.who p {
		margin: 0 0 14px;
		font-size: 16.5px;
		line-height: 1.5;
		text-wrap: pretty;
	}
	.who a {
		font-weight: 700;
		color: var(--em-ink);
		border-bottom: 1.5px solid currentColor;
		padding-bottom: 2px;
	}
	.who a:hover {
		color: var(--s-black);
	}

	@media (max-width: 900px) {
		.steps {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.split {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 520px) {
		.steps {
			grid-template-columns: minmax(0, 1fr);
		}
		.who {
			grid-template-columns: 84px minmax(0, 1fr);
			gap: 16px;
		}
		.photo {
			width: 84px;
		}
	}
</style>
