<script>
	import { contact as c } from '../content.js';
	import RotatingCube from '$lib/animations/RotatingCube.svelte';
</script>

<div class="jf-grain"></div>

<div class="body jf-in">
	<div class="seal-wrap" aria-hidden="true">
		<RotatingCube />
	</div>

	<div class="say">
		<p class="quote">
			{c.quote}<br /><span class="jf-jade">{c.quoteTail}</span>
		</p>
		<div class="links">
			{#each c.links as l}
				{#if l.icon}
					<a
						class="icon-link"
						href={l.href}
						title={l.label}
						aria-label={l.label}
						target="_blank"
						rel="noopener noreferrer"
					>
						<img src={l.icon} alt="" />
					</a>
				{:else}
					<a
						class:primary={l.primary}
						href={l.href}
						target={l.href.startsWith('mailto:') ? undefined : '_blank'}
						rel={l.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}>{l.label}</a
					>
				{/if}
			{/each}
		</div>
	</div>
</div>

<div class="foot">
	<span>{c.footLeft}</span>
	<span>{c.footRight}</span>
</div>

<style>
	.body {
		position: relative;
		/* Not `flex: 1` — an exact screenful, so whatever follows starts below
		   the fold. `100dvh` minus the screen's own vertical padding, since
		   jf-pad is on the scroll container and counts inside its scroll height. */
		flex: 0 0 auto;
		min-height: calc(100dvh - (2 * var(--pad-y)));
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: clamp(14px, 2.6vw, 48px);
	}

	/* The petal seal: six faces easing between a cube and a leaf rosette. It
	   carries its own animation and a fixed 200px box (its 3D depth is a
	   hardcoded 100px, so scaling the box would distort the cube phase) — the
	   holder just reserves that space and scales the whole thing down bodily on
	   small screens, which keeps the morph intact. */
	.seal-wrap {
		flex: 0 0 auto;
		width: 200px;
		height: 200px;
		display: grid;
		place-items: center;
		transform: translate(calc(var(--px) * 20px), calc(var(--py) * 16px));
		transition: transform 0.6s ease-out;
		margin-right: 4rem;
	}

	.say {
		flex: 1 1 320px;
		min-width: 0;
		max-width: 640px;
	}
	.quote {
		margin: 0;
		font-family: var(--serif);
		font-style: italic;
		font-weight: 400;
		font-size: clamp(22px, 3vw, 40px);
		line-height: 1.14;
		letter-spacing: -0.01em;
		text-wrap: pretty;
	}
	.links {
		margin-top: clamp(10px, 1.6vw, 22px);
		display: flex;
		flex-wrap: wrap;
		gap: 8px 10px;
		font-family: var(--mono);
		font-size: clamp(9.5px, 1vw, 11px);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.links a {
		padding: 12px 14px;
		border: 1px solid rgba(233, 225, 208, 0.3);
		border-radius: 2px;
		transition:
			background 0.25s ease,
			border-color 0.25s ease,
			color 0.25s ease;
	}
	.links a:hover {
		border-color: var(--jade);
	}
	/* Square, so the icons read as a set beside the wide address button rather
	   than as three more buttons competing with it. */
	.links .icon-link {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
	}
	.links .icon-link img {
		width: 15px;
		height: 15px;
		object-fit: contain;
		/* The source files are dark marks; this flips them to paper. */
		filter: brightness(0) invert(1);
		opacity: 0.62;
		transition: opacity 0.25s ease;
	}
	.links .icon-link:hover img,
	.links .icon-link:focus-visible img {
		opacity: 1;
	}
	.links a:focus-visible {
		outline: 2px solid var(--jade);
		outline-offset: 2px;
	}
	.links a.primary {
		background: var(--paper);
		color: var(--forest);
		border-color: var(--paper);
	}
	.links a.primary:hover {
		background: var(--rust);
		border-color: var(--rust);
		color: var(--paper);
	}

	@media (max-width: 760px) {
		.seal-wrap {
			width: 140px;
			height: 140px;
			transform: scale(0.7);
		}
	}

	@media (max-width: 760px) {
		/* Same shape as the Design/Code panels: the visual leads, the copy sits
		   down near the thumb. flex-wrap has to go — with it, `space-between`
		   distributes the wrapped *lines* rather than the two blocks. */
		.body {
			flex-wrap: nowrap;
			flex-direction: column;
			align-items: flex-start;
			justify-content: space-between;
			gap: clamp(20px, 5vh, 44px);
		}
		.seal-wrap {
			align-self: center;
			/* space-between pins this to the very top, but the faces swing past
			   their 200px box mid-morph — without clearance the cube's top corner
			   is sheared off by the panel edge. */
			margin-top: clamp(46px, 9vh, 82px);
		}
		.say {
			flex: 0 1 auto;
		}
		.links {
			margin-top: clamp(14px, 2.4vh, 22px);
		}
	}

	/* Deliberately below the fold. The deck's last screen ends on the address and
	   the links; this is the standard sign-off, there for anyone who keeps
	   going, and out of the way of everyone who doesn't. */
	.foot {
		position: relative;
		margin-top: clamp(30px, 7vh, 64px);
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 10px;
		border-top: 1px solid rgba(233, 225, 208, 0.16);
		padding-top: clamp(10px, 1.4vw, 16px);
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--stone);
		/* Clears the iPhone home indicator — this is the last line on the last
		   screen of a fixed, full-viewport deck, so nothing below it does. */
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
</style>
