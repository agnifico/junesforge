<script>
	import { currentScreenId } from '$lib/console-store.js';
	const base = '.';
</script>

<div class="project-container">
	<button class="back-button" on:click={() => currentScreenId.set('projects')}>(B)ack</button>

	<div class="project-item">
		<p>My take on a rebrand of the Urban Company offering, Insta Help. Check the PDF for more!</p>
        <a href="{base}/InstaHelp_Case_study.pdf" target="_blank">Click here for the PDF.</a>
        <img src="{base}/InstaHelp UI.png" alt="UI" />
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
        margin-top: 4rem;
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

    a {
        text-decoration: none;
        color: rgb(200, 192, 109);
        font-family: "Fira Code";
        font-weight: 600;
    }
</style>
