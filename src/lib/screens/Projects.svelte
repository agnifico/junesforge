<script>
	import { projectsLinkIndex, currentScreenId } from '$lib/console-store.js';
	import { projectItems } from '$lib/console-map.js';
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { playHoverSound, playClickSound } from '../utils/sounds.js';

	let arrowElement;
	let liElements = []; // Array to hold all list item elements

	function handleMouseOver(index) {
		projectsLinkIndex.set(index);
		playHoverSound();
	}

	function handleClick(index) {
		const selectedScreenId = projectItems[index].screenId;
		currentScreenId.set(selectedScreenId);
		playClickSound();
	}

	// Reactive statement for the arrow animation
	$: if (arrowElement) {
		gsap.fromTo(
			arrowElement,
			{ x: -10, opacity: 0 },
			{ x: 0, opacity: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' }
		);
	}

	// Reactive statement to scroll the highlighted item into view
	$: if (liElements[$projectsLinkIndex]) {
		liElements[$projectsLinkIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<div class="projects-menu-container">
	<ul>
		{#each projectItems as project, i}
			<li
				class="menu-item"
				class:highlighted={$projectsLinkIndex === i}
				bind:this={liElements[i]}
				on:mouseover={() => handleMouseOver(i)}
				on:click={() => handleClick(i)}
			>
				<a href={project.path}>
					<div class="arrow-container">
						{#if i === $projectsLinkIndex}
							<img src="/right-arrow.png" alt=">" class="arrow" bind:this={arrowElement} />
						{/if}
					</div>
					<span>{project.title}</span>
				</a>
			</li>
		{/each}
	</ul>
	<p>
		Press A to select (or click/tap) <br />
		Press B to go
        <button class="back-button" on:click={() => currentScreenId.set('menu')}>(B)ack</button>
	</p>
</div>

<style>
    .back-button {
		width: fit-content;
		margin-bottom: 1rem;
		background: #383838;
		border: none;
		color: white;
		font-family: 'Silkscreen', monospace;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}
	p {
        margin-top: 2rem;
		text-align: center;
		color: antiquewhite;
		font-family: 'Dogica Pixel';
		font-size: 0.5rem;
	}
	.projects-menu-container {
		height: 100%;
		width: 100%;
		overflow-y: auto;
		scrollbar-width: none;
		font-family: 'Silkscreen', monospace;
		color: white;
		font-size: 1.5rem;
		padding: 2rem;
	}
	.projects-menu-container::-webkit-scrollbar {
		display: none;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.menu-item a {
		display: flex;
		align-items: center;
		padding: 0.5rem 0;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease-out;
	}
	.menu-item.highlighted a {
		color: #44c6a7; /* Using a color from the theme */
		transform: translateX(10px);
	}
	.arrow-container {
		width: 40px;
		height: 30px;
	}
	.arrow {
		width: 30px;
		height: 30px;
		transition: transform 0.2s ease-out;
	}
	.menu-item.highlighted .arrow {
		transform: translateX(-10px);
	}
	.menu-item a:hover {
		color: #44c6a7; /* Using a color from the theme */
		transform: translateX(10px);
		text-decoration: underline;
		cursor: pointer;
	}
	.menu-item a:hover .arrow {
		transform: translateX(-10px);
	}
</style>
