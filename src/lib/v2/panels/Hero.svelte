<script>
	import { hero as c, enquiry, identity } from '../content.js';

	let { goto = () => {} } = $props();
</script>

<div class="jf-s hero">
	<header class="bar jf-s-wrap">
		<a class="brand" href="/" aria-label="{identity.brand.wordmark}, home">
			<img src={identity.brand.logo} alt="" />
			<span>{identity.brand.wordmark}</span>
		</a>
		<nav class="links" aria-label="Page">
			{#each c.nav as n}
				<button type="button" onclick={() => goto(n.goto)}>{n.label}</button>
			{/each}
		</nav>
		<a class="jf-s-btn primary small" href={enquiry.href}>{enquiry.label}</a>
	</header>

	<div class="main jf-s-wrap jf-in">
		<h1>
			<span>{c.headline[0]}</span>
			<span class="em">{c.headline[1]}</span>
		</h1>
		<p class="jf-s-lede">{c.lede}</p>
		<div class="ctas">
			<a class="jf-s-btn primary" href={enquiry.href}>{enquiry.label} <span class="arr">→</span></a>
			<button type="button" class="jf-s-btn ghost" onclick={() => goto(c.secondary.goto)}>
				{c.secondary.label}
			</button>
		</div>
	</div>

	<div class="foot jf-s-wrap">
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
	.hero {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding-top: var(--pad-y);
		padding-bottom: var(--pad-y);
	}
	.hero > * {
		width: 100%;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 24px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		font-weight: 700;
		font-size: 19px;
		letter-spacing: -0.01em;
		margin-right: auto;
	}
	.brand img {
		width: 34px;
		height: 34px;
	}
	.links {
		display: flex;
		gap: 4px;
	}
	.links button {
		background: none;
		border: 0;
		padding: 10px 12px;
		font: inherit;
		font-size: 15px;
		font-weight: 500;
		color: var(--s-grey);
		cursor: pointer;
		border-radius: 8px;
		transition: color 0.2s ease;
	}
	.links button:hover {
		color: var(--s-white);
	}
	.small {
		padding: 11px 16px;
		font-size: 14.5px;
	}

	.main {
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-block: clamp(56px, 9vh, 120px);
	}
	h1 {
		margin: 0;
		font-weight: 800;
		font-size: clamp(44px, 7.6vw, 118px);
		line-height: 0.93;
		letter-spacing: -0.045em;
		max-width: 15ch;
		text-wrap: balance;
	}
	h1 span {
		display: block;
	}
	.em {
		color: var(--em);
	}
	.main .jf-s-lede {
		margin-top: clamp(22px, 3vw, 36px);
		font-size: clamp(18px, 1.7vw, 22px);
		color: #b4b4ae;
	}
	.ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: clamp(26px, 3.4vw, 42px);
	}

	.foot {
		border-top: 1px solid var(--s-line);
		padding-top: 22px;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 22px 40px;
	}
	.facts {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 190px));
		gap: 18px 32px;
	}
	.facts dt {
		font-size: clamp(26px, 2.6vw, 36px);
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
		margin: 0;
		font-size: 14px;
		color: var(--s-grey);
	}

	@media (max-width: 900px) {
		.links {
			display: none;
		}
		.facts {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			width: 100%;
		}
	}
	@media (max-width: 420px) {
		.brand span {
			display: none;
		}
	}
</style>
