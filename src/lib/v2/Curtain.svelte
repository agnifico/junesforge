<script>
	import { onMount } from 'svelte';

	/* The opening curtain: a black screen carrying the wordmark that lifts
	   after ~1.2s. Same beats as the v1 entry overlay, no GSAP needed. */
	let { logo = '/images/Logo_Main.svg', top = 'welcome to', word = 'junesforge', onDone = () => {} } =
		$props();

	let gone = $state(false);

	onMount(() => {
		const t = setTimeout(() => {
			gone = true;
			onDone();
		}, 1200);
		return () => clearTimeout(t);
	});
</script>

{#if !gone}
	<div class="curtain" aria-hidden="true">
		<div class="particles"></div>
		<div class="center">
			<img src={logo} alt="" class="logo" />
			<div class="welcome">
				<div class="welcome-top">{top}</div>
				<div class="welcome-bottom">{word}</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.curtain {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #14110e;
		pointer-events: none;
		animation: curtain-lift 0.45s ease-in 0.75s forwards;
	}
	.particles {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 18% 30%, rgba(196, 69, 42, 0.1) 0, transparent 1.5px),
			radial-gradient(circle at 72% 60%, rgba(233, 225, 208, 0.07) 0, transparent 1.5px),
			radial-gradient(circle at 35% 80%, rgba(63, 176, 141, 0.08) 0, transparent 1.5px),
			radial-gradient(circle at 88% 20%, rgba(233, 225, 208, 0.08) 0, transparent 1.5px),
			radial-gradient(circle at 55% 45%, rgba(196, 69, 42, 0.07) 0, transparent 1.5px);
		filter: blur(0.4px);
	}
	.center {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		z-index: 1;
	}
	.logo {
		width: 96px;
		height: 96px;
		object-fit: contain;
	}
	.welcome {
		text-align: center;
		opacity: 0;
		animation:
			welcome-in 0.3s ease-out forwards,
			welcome-out 0.35s ease-in 0.7s forwards;
	}
	.welcome-top {
		font-family: 'Newsreader', Georgia, serif;
		font-size: 1rem;
		font-weight: 300;
		letter-spacing: 0.05em;
		color: #8c8272;
	}
	.welcome-bottom {
		font-family: 'Martian Mono', ui-monospace, monospace;
		font-size: 1.15rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: #3fb08d;
		margin-top: 8px;
	}

	@keyframes welcome-in {
		to {
			opacity: 1;
		}
	}
	@keyframes welcome-out {
		to {
			opacity: 0;
		}
	}
	@keyframes curtain-lift {
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.curtain,
		.welcome {
			animation-duration: 1ms;
		}
	}
</style>
