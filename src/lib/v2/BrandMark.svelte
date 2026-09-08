<script>
	/* The Future Wellbeing Congress mark, inlined rather than loaded as a file.

	   Inlining is what keeps it off the right-click menu: there is no <img> and
	   no standalone asset request, so the browser offers the ordinary page menu
	   instead of "Save image as", and a long-press on iOS raises nothing. Worth
	   being straight about the limit — anyone who opens devtools can still lift
	   the markup. This stops casual saving, not a determined person.

	   It also fixes what the old PNG could not: the artwork is trimmed to its
	   own bounds and transparent, so it scales to any panel shape and lets the
	   panel's ground show through instead of carrying a grey slab with it. */
	let { label = 'Selected brand work' } = $props();
</script>

<svg
	class="brand-mark"
	viewBox="0 0 1330 1330"
	role="img"
	aria-label={label}
	focusable="false"
	xmlns="http://www.w3.org/2000/svg"
>
	<g>
		<path
			d="M664.707,664.401C664.707,1031.263 962.552,1329.108 1329.414,1329.108C1329.414,849.326 1031.569,589.456 664.707,664.401Z"
			fill="rgb(0,191,133)"
		/>
		<path
			d="M664.707,664.707C664.707,297.845 962.552,0 1329.414,0C1329.414,479.782 1031.569,739.652 664.707,664.707Z"
			fill="rgb(66,134,113)"
		/>
		<circle cx="1117.028" cy="664.56" r="212.386" fill="rgb(255,158,73)" />
		<path
			d="M904.642,664.548C904.649,547.335 999.813,452.174 1117.028,452.174C1145.477,452.174 1172.628,457.78 1197.434,467.946C1123.25,570.524 1022.001,637.898 904.669,664.554C904.66,664.552 904.651,664.55 904.642,664.548Z"
			fill="rgb(255,255,163)"
		/>
		<path
			d="M1197.441,861.171C1172.633,871.339 1145.48,876.946 1117.028,876.946C999.809,876.946 904.642,781.779 904.642,664.56C904.651,664.558 904.66,664.556 904.669,664.554C1022.004,691.211 1123.256,758.588 1197.441,861.171Z"
			fill="rgb(0,255,192)"
		/>
		<path
			d="M664.707,664.401C664.707,1031.263 366.862,1329.108 0,1329.108C0,849.326 297.845,589.456 664.707,664.401Z"
			fill="rgb(66,134,113)"
		/>
		<path
			d="M664.707,664.707C664.707,297.845 366.862,0 0,0C0,479.782 297.845,739.652 664.707,664.707Z"
			fill="rgb(0,191,133)"
		/>
		<circle cx="212.386" cy="664.548" r="212.386" fill="rgb(255,158,73)" />
		<path
			d="M131.973,467.937C156.781,457.769 183.934,452.162 212.386,452.162C329.605,452.162 424.772,547.329 424.772,664.548C424.763,664.55 424.754,664.552 424.745,664.554C307.41,637.897 206.158,570.52 131.973,467.937Z"
			fill="rgb(0,255,192)"
		/>
		<path
			d="M131.98,861.162C206.164,758.584 307.413,691.21 424.745,664.554C424.754,664.556 424.763,664.558 424.772,664.56C424.765,781.773 329.601,876.934 212.386,876.934C183.937,876.934 156.786,871.328 131.98,861.162Z"
			fill="rgb(255,255,163)"
		/>
		<circle cx="664.707" cy="117.923" r="117.923" fill="rgb(0,191,133)" />
		<circle cx="664.707" cy="1211.198" r="117.923" fill="rgb(66,134,113)" />
	</g>
</svg>

<style>
	.brand-mark {
		display: block;
		width: 100%;
		height: 100%;
		/* preserveAspectRatio defaults to xMidYMid meet, so the mark fits the box
		   and stays centred at any panel shape — the behaviour the old raster was
		   fighting for with object-fit, without the letterbox bars. */
		overflow: visible;
		/* Belt and braces on the save-prevention: nothing to target with a
		   right-click, nothing to drag out, no iOS long-press callout. */
		pointer-events: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
</style>
