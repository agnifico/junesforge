<script>
	/* A drop-in art placeholder. Give it a `src` and it renders the image;
	   leave `src` null and it renders a labelled dashed slot so the layout
	   still reads while the art is missing. */
	let { src = null, alt = '', placeholder = 'Art slot', fit = 'cover' } = $props();
</script>

<div class="jf-slot">
	{#if src}
		<img {src} {alt} style="object-fit:{fit}; object-position:center" />
	{:else}
		<div class="jf-slot-empty">{placeholder}</div>
	{/if}
</div>
