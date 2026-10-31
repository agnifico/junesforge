<script>
	import { work as c } from '../content.js';
	import LivePreview from '../LivePreview.svelte';

	const external = (href) => /^https?:/.test(href);
	const items = c.items.filter((it) => !it.hidden);
</script>

<div class="jf-s">
	<div class="jf-s-wrap">
		<div class="jf-s-head jf-in">
			<div>
				<p class="jf-s-label">Selected work</p>
				<h2 class="jf-s-h2">{c.heading}</h2>
			</div>
			<p class="jf-s-lede">{c.lede}</p>
		</div>

		<div class="grid">
			{#each items as it}
				<article class="card" class:wide={it.wide} class:strip={it.strip}>
					<div class="visual">
						{#if it.strip}
							<div class="marks">
								{#each it.strip as m}
									<img src={m.src} alt={m.alt} style="object-fit:{m.fit}" loading="lazy" />
								{/each}
							</div>
						{:else if it.image}
							<img src={it.image} alt="{it.title}, {it.type}" loading="lazy" />
						{:else if it.preview}
							<LivePreview src={it.preview} />
						{/if}
					</div>

					<div class="body">
						<div class="tags">
							<span class="kind" data-kind={it.kind}>{it.kind}</span>
							<span>{it.type}</span>
						</div>
						<h3>{it.title}</h3>
						<dl>
							<div>
								<dt>Brief</dt>
								<dd>{it.brief}</dd>
							</div>
							<div>
								<dt>What I did</dt>
								<dd>{it.did}</dd>
							</div>
						</dl>
						<div class="links">
							{#each it.links as l}
								<a
									href={l.href}
									target={external(l.href) ? '_blank' : undefined}
									rel={external(l.href) ? 'noopener noreferrer' : undefined}
								>
									{l.label} <span aria-hidden="true">↗</span>
								</a>
							{/each}
						</div>
					</div>
				</article>
			{/each}
		</div>

		<p class="aside">
			{c.aside.text}
			{#if c.aside.href}
				<a href={c.aside.href} target="_blank" rel="noopener noreferrer">{c.aside.label} ↗</a>
			{/if}
		</p>
	</div>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(16px, 2vw, 28px);
	}
	.card {
		display: flex;
		flex-direction: column;
		background: #fff;
		border: 1px solid var(--s-line-dk);
		border-radius: 14px;
		overflow: hidden;
	}
	/* Wide cards sit visual-left, copy-right. */
	.card.wide,
	.card.strip {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
	}

	.visual {
		position: relative;
		border-bottom: 1px solid var(--s-line-dk);
		background: #e6e6e2;
	}
	.wide .visual,
	.strip .visual {
		border-bottom: 0;
		border-right: 1px solid var(--s-line-dk);
	}
	.visual > img {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 10;
		object-fit: cover;
	}
	.marks {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		height: 100%;
		min-height: 220px;
	}
	.marks img {
		width: 100%;
		height: 100%;
		background: #fff;
		border-right: 1px solid var(--s-line-dk);
	}
	.marks img:last-child {
		border-right: 0;
	}

	.body {
		display: flex;
		flex-direction: column;
		padding: clamp(20px, 2.4vw, 32px);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		font-size: 14px;
		color: var(--s-grey-dk);
	}
	.kind {
		padding: 5px 10px;
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 700;
		background: var(--s-black);
		color: var(--s-white);
	}
	/* Concept work is labelled plainly, in a different chip, so nobody
	   mistakes it for a client engagement. */
	.kind[data-kind='Concept'] {
		background: none;
		color: var(--s-black);
		box-shadow: inset 0 0 0 1.5px var(--s-black);
	}
	.kind[data-kind='Client'] {
		background: var(--em);
		color: var(--s-black);
	}
	h3 {
		margin: 14px 0 0;
		font-size: clamp(26px, 2.6vw, 36px);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}
	dl {
		margin: 18px 0 0;
		display: grid;
		gap: 14px;
	}
	dt {
		font-size: 13px;
		font-weight: 700;
		color: var(--s-grey-dk);
	}
	dd {
		margin: 4px 0 0;
		font-size: 16px;
		line-height: 1.45;
		text-wrap: pretty;
	}
	.links {
		margin-top: auto;
		padding-top: 22px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px 20px;
	}
	.links a,
	.aside a {
		font-weight: 700;
		font-size: 16px;
		color: var(--em-ink);
		border-bottom: 1.5px solid currentColor;
		padding-bottom: 2px;
	}
	.links a:hover,
	.aside a:hover {
		color: var(--s-black);
	}

	.aside {
		margin: clamp(28px, 3vw, 40px) 0 0;
		font-size: 16px;
		color: var(--s-grey-dk);
	}

	@media (max-width: 860px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.card.wide,
		.card.strip {
			grid-template-columns: minmax(0, 1fr);
		}
		.wide .visual,
		.strip .visual {
			border-right: 0;
			border-bottom: 1px solid var(--s-line-dk);
		}
		.marks {
			min-height: 0;
			aspect-ratio: 3 / 1;
		}
	}
</style>
