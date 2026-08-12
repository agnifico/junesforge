<script>
	import favicon from '$lib/assets/favicon.png';
    // import '$lib/app.css';
    // import BgVideo from '$lib/BgVideo.svelte';
    // import { isVideoBackgroundOn } from '$lib/console-store.js';
	// let base = '.';
	let { children } = $props();
</script>

<!-- {#if $isVideoBackgroundOn}
    <BgVideo />
{/if} -->

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- <div class="navbar">
	<img src="{base}/Logo_Main.svg" alt="" srcset="" id="logo" style="opacity: 0;" />
</div>

<audio id="hard-click" src="{base}/sounds/mixkit-hard-typewriter-click-1119.wav" preload></audio>
<audio id="soft-click" src="{base}/sounds/mixkit-typewriter-soft-click-1125.wav" preload></audio>
<audio id="ui-click" src="{base}/sounds/ui-click.wav" preload></audio>
<audio id="wine-glass" src="{base}/sounds/mixkit-wine-glass-clink-2936.wav" preload></audio> -->

{@render children?.()}
