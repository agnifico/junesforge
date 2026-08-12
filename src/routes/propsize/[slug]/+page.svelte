<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.title} — Propsize</title>
	<meta name="description" content={data.description} />
</svelte:head>

<main class="preset">
	<h1>{data.title}</h1>
	<p>{data.description}</p>
	<a href="/propsize/app">Open in editor</a>
</main>

<style>


	.preset {
		min-height: 100vh;
		background: #141516;
		color: #eee9e2;
		font-family: Inter, system-ui, sans-serif;
	}

	h1 {
		font-family: 'Space Grotesk', system-ui, sans-serif;
		margin: 0 0 1rem;
	}

	p {
		color: #a3a6a5;
		max-width: 40rem;
		line-height: 1.6;
	}

	a {
		color: #c98a4b;
	}
</style>
