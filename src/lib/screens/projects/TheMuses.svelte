<script>
	import { currentScreenId } from '$lib/console-store.js';
</script>

<div class="project-container">
	<button class="back-button" on:click={() => currentScreenId.set('projects')}>(B)ack</button>

	<div class="project-item">
		<p>
			My kind of hot women don't always get representation in popular media, so I decided to take
			matters into my own hands xD
		</p>
	</div>

	<div class="project-item">
		<img src="/[01].png" alt="Woman in a bikini taking a selfie" />
	</div>

	<div class="project-item">
		<img src="/[02].png" alt="Woman tying her hair." />
	</div>

	<div class="project-item">
		<img src="/[03].png" alt="Woman in baggy clothes, and slick hair tied back." />
	</div>

    <div class="project-item">
		<img src="/[04].png" alt="A woman in a dinner outfit kinda saree" />
	</div>

    <div class="project-item">
		<img src="/[05].png" alt="And older woman, smiling shyly." />
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
