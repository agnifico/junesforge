<script>
	/* =========================================================
	   07 · PACKAGES + FAQ — one screen. The ways to work together
	   as a short strip (name, who it is for, how long), then the
	   questions. Prices and what each includes come out on the call.
	   Copy: content.js (packages, faq).
	   ========================================================= */
	import { packages as c, faq, enquiry } from '../content.js';
</script>

<div class="jf-s">
	<div class="jf-s-wrap">
		<h2 class="jf-s-h2 jf-in">{c.heading}</h2>

		<ol class="strip">
			{#each c.items as p (p.name)}
				<li class:featured={p.featured}>
					<h3>{p.name}</h3>
					<p class="for">{p.for}</p>
					<p class="time">{p.time}</p>
				</li>
			{/each}
		</ol>

		<div class="faq">
			<div class="intro jf-in">
				<h2 class="sub">{faq.heading}</h2>
				<p>{faq.lede}</p>
				<a class="jf-s-btn ghost" href={enquiry.href}>Email me</a>
			</div>

			<div class="list">
				{#each faq.items as it (it.q)}
					<details>
						<summary>
							<span>{it.q}</span>
							<span class="pm" aria-hidden="true"></span>
						</summary>
						<p>{it.a}</p>
					</details>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	/* ---- the strip: four across, ruled, no cards ------------ */
	.strip {
		list-style: none;
		margin: clamp(24px, 3.5vw, 44px) 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border-top: 1px solid var(--s-line);
	}
	.strip li {
		display: flex;
		flex-direction: column;
		padding: 22px 24px 4px 0;
	}
	.strip li + li {
		padding-left: 24px;
		border-left: 1px solid var(--s-line);
	}
	/* the featured one is marked on the rule above it */
	.strip li.featured {
		box-shadow: inset 0 2px 0 var(--em);
	}
	h3 {
		margin: 0;
		font-size: clamp(21px, 1.9vw, 26px);
		font-weight: 800;
		letter-spacing: -0.025em;
	}
	.featured h3 {
		color: var(--em);
	}
	.for {
		margin: 8px 0 0;
		font-size: 15px;
		line-height: 1.45;
		color: #b4b4ae;
		text-wrap: pretty;
	}
	.time {
		margin: auto 0 0;
		padding-top: 14px;
		font-size: 14px;
		font-weight: 700;
	}

	/* ---- the questions -------------------------------------- */
	.faq {
		margin-top: clamp(48px, 6vw, 88px);
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: clamp(32px, 6vw, 96px);
		align-items: start;
	}
	.sub {
		margin: 0;
		font-size: clamp(28px, 3vw, 40px);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.intro p {
		margin: 14px 0 0;
		font-size: 16.5px;
		color: #b4b4ae;
	}
	.intro .jf-s-btn {
		margin-top: 24px;
	}
	.list {
		border-top: 1px solid var(--s-line);
	}
	details {
		border-bottom: 1px solid var(--s-line);
	}
	summary {
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 20px 0;
		cursor: pointer;
		font-size: clamp(17px, 1.6vw, 20px);
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		color: var(--em);
	}
	summary:focus-visible {
		outline: 2px solid var(--em);
		outline-offset: 4px;
	}
	.pm {
		position: relative;
		flex: 0 0 auto;
		width: 14px;
		height: 14px;
	}
	.pm::before,
	.pm::after {
		content: '';
		position: absolute;
		left: 0;
		top: 6px;
		width: 14px;
		height: 2px;
		background: currentColor;
		transition: transform 0.25s ease;
	}
	.pm::after {
		transform: rotate(90deg);
	}
	details[open] .pm::after {
		transform: rotate(0deg);
	}
	details p {
		margin: -6px 0 0;
		padding: 0 40px 22px 0;
		font-size: 16px;
		line-height: 1.55;
		color: #b4b4ae;
		max-width: 62ch;
	}

	@media (max-width: 1100px) {
		.strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.strip li:nth-child(3) {
			padding-left: 0;
			border-left: 0;
		}
		.strip li:nth-child(n + 3) {
			border-top: 1px solid var(--s-line);
		}
	}
	@media (max-width: 860px) {
		.faq {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 560px) {
		.strip {
			grid-template-columns: minmax(0, 1fr);
		}
		.strip li + li {
			padding-left: 0;
			border-left: 0;
			border-top: 1px solid var(--s-line);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pm::before,
		.pm::after {
			transition: none;
		}
	}
</style>
