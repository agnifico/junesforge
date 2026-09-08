<script>
	import { gallery as c } from '../content.js';
	import ImageSlot from '../ImageSlot.svelte';
</script>

<div class="jf-grain on-light"></div>

<div class="head jf-in">
	<div>
		<h2 class="jf-title">{c.heading}</h2>
	</div>
	<a class="outbound" href={c.outbound.href} target="_blank" rel="noopener noreferrer"
		>{c.outbound.label}</a
	>
</div>

<div class="grid">
	{#each c.tiles as t}
		<a
			class="tile {t.tone}"
			class:wide={t.wide}
			href={t.href}
			target="_blank"
			rel="noopener noreferrer"
		>
			<div class="shot">
				<ImageSlot src={t.src} alt={t.title} placeholder={t.title} fit={t.fit ?? 'cover'} />
			</div>
			<div class="scrim"></div>
			<div class="cap">
				<div class="cap-kicker">{t.kicker}</div>
				<div class="cap-title" class:big={t.wide}>{t.title}</div>
			</div>
		</a>
	{/each}
</div>

<style>
	.head {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
	}
	.head .jf-title {
		margin: 0;
		font-size: clamp(38px, 6.4vw, 88px);
	}
	.outbound {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		border-bottom: 1px solid var(--rust);
		padding-bottom: 3px;
		transition: color 0.25s ease;
	}
	.outbound:hover {
		color: var(--rust);
	}

	/* Narrow: let the tiles find their own columns. */
	.grid {
		position: relative;
		flex: 1;
		min-height: 0;
		margin-top: clamp(12px, 2vw, 24px);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		grid-auto-rows: 1fr;
		gap: clamp(8px, 1.2vw, 14px);
	}

	/* Desktop: a fixed 4×2 field. The hero tile and the last tile each take
	   two columns, so six tiles fill the grid exactly with no orphan row.
	   Change the tile count in content.js and this reflows to more rows. */
	@media (min-width: 1000px) {
		.grid {
			grid-template-columns: repeat(4, 1fr);
		}
		.tile:last-child {
			grid-column: span 2;
		}
	}

	.tile {
		position: relative;
		min-height: 120px;
		overflow: hidden;
		border-radius: 2px;
	}
	.tile.wide {
		grid-column: span 2;
	}
	.tile.ink {
		background: var(--ink);
		color: var(--paper);
	}
	.tile.sand {
		background: #d8cdb6;
		color: var(--ink);
	}
	.tile.rust {
		background: var(--rust);
		color: var(--paper);
	}
	.tile.jade {
		background: var(--jade-deep);
		color: var(--paper);
	}

	.shot {
		position: absolute;
		inset: 0;
	}
	.tile :global(.jf-slot img) {
		transition: transform 0.9s var(--ease);
	}
	.tile:hover :global(.jf-slot img),
	.tile:focus-visible :global(.jf-slot img) {
		transform: scale(1.04);
	}

	/* the details only surface under the cursor — the art carries the grid */
	.scrim,
	.cap {
		opacity: 0;
		transition:
			opacity 0.35s ease,
			transform 0.4s var(--ease);
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(0deg, rgba(20, 17, 14, 0.92), transparent 58%);
	}
	.cap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: clamp(10px, 1.4vw, 18px);
		transform: translateY(9px);
		color: var(--paper);
	}
	.tile:hover .scrim,
	.tile:hover .cap,
	.tile:focus-visible .scrim,
	.tile:focus-visible .cap {
		opacity: 1;
		transform: none;
	}
	.cap-kicker {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--brass);
	}
	.cap-title {
		font-family: var(--serif);
		font-size: clamp(17px, 1.8vw, 23px);
		line-height: 1.1;
	}
	.cap-title.big {
		font-size: clamp(22px, 2.6vw, 34px);
		line-height: 1.05;
	}
</style>
