<script>
	import { currentScreenId } from '$lib/console-store.js';
	const base = '.';
</script>

<div class="project-container">
	<button class="back-button" on:click={() => currentScreenId.set('projects')}>(B)ack</button>

	<div class="project-item">
		<img src="{base}/air.svg" alt="City in the Sky" />
		<p>City In The Sky</p>
	</div>

	<div class="project-item">
		<img src="{base}/earth.svg" alt="Earth Temple" />
		<p>The Cradle of Earth</p>
	</div>

	<div class="project-item">
		<img src="{base}/fire.svg" alt="Fire Citadel" />
		<p>Citadella Fire</p>
	</div>

	<div class="project-item">
		<img src="{base}/water.svg" alt="Water Cove" />
		<p>Hidden Water Cove</p>
	</div>
</div>

<style>
	.project-container {
		position: relative;
		height: 100%;
		width: 100%;
		overflow-y: auto;
		scrollbar-width: none;
		padding: 2rem;
		color: white;
		font-family: 'Ubuntu Mono', monospace;
	}
	.project-container::-webkit-scrollbar {
		display: none;
	}
	.project-item {
		position: relative;
		margin-bottom: 3rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}
	.project-item img {
		max-width: 80%;
		height: auto;
		margin-bottom: 1rem;
		background-color: #ffffff1a; /* Light background to see the SVGs */
		border-radius: 10px;
		padding: 1rem;
		box-sizing: border-box;
	}
	.project-item p {
		max-width: 60ch;
		margin-left: auto;
		margin-right: auto;
		text-align: justify;
		color: #cacaca;
		padding-inline: 1rem;
	}
	.back-button {
		position: sticky;
		top: -1rem;
		margin-left: 1rem;
		width: fit-content;
		margin-bottom: 1rem;
		background: #383838;
		border: 1px solid white;
		color: white;
		font-family: 'Silkscreen', monospace;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		z-index: 10;
	}
</style>
