<script>
	import { faq as c, enquiry } from '../content.js';
</script>

<div class="jf-s">
	<div class="jf-s-wrap cols">
		<div class="intro jf-in">
			<p class="jf-s-label">FAQ</p>
			<h2 class="jf-s-h2">{c.heading}</h2>
			<p class="jf-s-lede">Anything else, ask me directly.</p>
			<a class="jf-s-btn ghost" href={enquiry.href}>Email me</a>
		</div>

		<div class="list">
			{#each c.items as it}
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

<style>
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: clamp(32px, 6vw, 96px);
		align-items: start;
	}
	.intro .jf-s-btn {
		margin-top: 28px;
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
		padding: 22px 0;
		cursor: pointer;
		font-size: clamp(18px, 1.7vw, 21px);
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		color: var(--em);
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
		padding: 0 40px 24px 0;
		font-size: 16.5px;
		line-height: 1.55;
		color: #b4b4ae;
		max-width: 62ch;
	}

	@media (max-width: 860px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
