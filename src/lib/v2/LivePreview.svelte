<script>
	/* A live page shrunk to a thumbnail: the iframe renders at a fixed desktop
	   size and is scaled down to whatever width the card gives it. Stands in for
	   a screenshot until one exists, and never goes stale. It is decoration:
	   no pointer events, no tab stop, hidden from assistive tech. */
	let { src, width = 1280, height = 800 } = $props();

	let box = $state(null);
	let scale = $state(0);

	$effect(() => {
		if (!box) return;
		const ro = new ResizeObserver(([e]) => (scale = e.contentRect.width / width));
		ro.observe(box);
		return () => ro.disconnect();
	});
</script>

<div class="pv" bind:this={box} style="aspect-ratio:{width} / {height}">
	{#if scale}
		<iframe
			{src}
			title=""
			loading="lazy"
			tabindex="-1"
			aria-hidden="true"
			style="width:{width}px; height:{height}px; transform:scale({scale})"
		></iframe>
	{/if}
</div>

<style>
	.pv {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: #e6e6e2;
	}
	iframe {
		position: absolute;
		top: 0;
		left: 0;
		border: 0;
		transform-origin: 0 0;
		pointer-events: none;
	}
</style>
