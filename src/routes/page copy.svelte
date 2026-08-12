<script>
	import { currentScreenId } from '$lib/console-store.js';
	import { consoleMap } from '$lib/console-map.js';
	import RotatingCube from '$lib/animations/RotatingCube.svelte';
	import { playExternalClickSound } from '../lib/utils/sounds.js';

	let currentScreen = $derived(consoleMap[$currentScreenId]);

	function handleInput(action) {
		const controlFn = currentScreen.controls[action];
		if (controlFn) {
			controlFn();
		}
	}

	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { Flip } from 'gsap/Flip';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { TextPlugin } from 'gsap/TextPlugin';

	gsap.registerPlugin(ScrollTrigger, TextPlugin, Flip);

	let bottomBoxElement; // Reference to the bottom-box element
	let containerElement; // Reference to the scroll container
	let base = '.';

	onMount(() => {
		// Ensure the container is the scroller for ScrollTrigger
		ScrollTrigger.defaults({
			scroller: containerElement
		});

		const slides = containerElement.querySelectorAll('.page-slide');
		const secondSlide = slides[3]; // The third slide (index 2)

		// Create a GSAP timeline for the box animation
		const boxAnimation = gsap.timeline({
			paused: true,
			onStart: () => {
				bottomBoxElement.style.display = 'flex';
			}
		});

		boxAnimation
			.to(bottomBoxElement, {
				opacity: 1,
				visibility: 'visible',
				duration: 0.2,
				ease: 'power2.in'
			})
			.to(bottomBoxElement, {
				y: 0,
				delay: 0.2,
				duration: 0.4,
				ease: 'power2.out'
			});

		// Attach ScrollTrigger to the second slide
		ScrollTrigger.create({
			trigger: secondSlide,
			start: 'top bottom', // When the top of the second slide hits the bottom of the viewport
			end: 'bottom top', // When the bottom of the second slide leaves the top of the viewport
			onEnter: () => boxAnimation.play(),
			onLeaveBack: () => boxAnimation.reverse(),
			// Optional: if you want it to reverse when scrolling past the end of the second slide
			onLeave: () => boxAnimation.reverse(),
			onEnterBack: () => boxAnimation.play()
			// markers: true // Uncomment for debugging ScrollTrigger
		});

		const firstSlide = slides[0];

		let logo_page_timeline = gsap.timeline({
			scrollTrigger: {
				trigger: firstSlide,
				scroller: containerElement,
				toggleActions: 'restart pause resume pause'
			},
			delay: 0.5
		});

		logo_page_timeline
			.from(
				'#h1a',
				{
					y: '20%',
					opacity: 0,
					duration: 0.5,
					ease: 'power'
				},
				'='
			)
			.from(
				'#h1b',
				{
					y: '-20%',
					opacity: 0,
					duration: 0.5,
					ease: 'power'
				},
				'='
			)
			.to(
				'#h1b',
				{
					duration: 0.5,
					text: 'jxnesforge',
					delay: 1
				},
				'<.3'
			)
			.from(
				'#hero-logo',
				{
					x: '-20%',
					opacity: 0,
					duration: 0.5,
					ease: 'power'
				},
				'='
			)
			.from(
				'.welcome > .common-text',
				{
					y: '-20%',
					opacity: 0,
					duration: 0.5,
					ease: 'power'
				},
				'='
			);

		let heroLogo = document.querySelector('#hero-logo');
		let navLogo = document.querySelector('#logo');

		const heroAnimation = gsap.to(heroLogo, {
			y: '50vh',
			scale: 0.5,
			opacity: 0,
			duration: 0.5,
			ease: 'power2.in',
			paused: true
		});

		const navAnimation = gsap.fromTo(
			navLogo,
			{ y: -50, opacity: 0 },
			{ y: 0, opacity: 1, duration: 0.2, ease: 'power2.out', paused: true }
		);

		ScrollTrigger.create({
			trigger: firstSlide,
			scroller: containerElement,
			start: 'center top',
			onEnter: () => {
				heroAnimation.play();
				navAnimation.play();
				// gsap.delayedCall(0.1, () => navAnimation.play());
			},
			onLeaveBack: () => {
				navAnimation.reverse();
				heroAnimation.reverse();
			}
		});

		// ----------- Quote Timeline ------------------
		let quote_timeline = gsap.timeline({
			scrollTrigger: '.quote-panel',
			delay: 0
		});

		quote_timeline
			.from('#q1a', {
				opacity: 0,
				duration: 0.5,
				delay: 1
			})
			.from(
				'#q1c',
				{
					opacity: 0,
					duration: 0.5
				},
				'<1'
			)
			.to(
				'#q1b',
				{
					duration: 0.5,
					text: 'ForgeMaster',
					ease: 'none',
					delay: 1
				},
				'<1'
			)
			.from(
				'#q1d',
				{
					opacity: 0,
					duration: 0.5
				},
				'<1.2'
			)
			.from(
				'.sq1',
				{
					stagger: 1,
					opacity: 0,
					duration: 0.5
				},
				'<1.3'
			);
	});
</script>

<div class="container" bind:this={containerElement}>
	<div class="page-slide">
		<div class="hero">
			<div class="welcome hoverable">
				<img src="{base}/Logo_Main.svg" width="150px" height="150px" id="hero-logo" />
				<div class="hero-line" id="h1a">welcome to</div>
				<div class="hero-line" id="h1b">
					<span id="h1c">June's </span>
					<span id="h1d">Forge</span>
				</div>
				<div class="common-text" style="text-align: center; padding-top: 2rem;">
					A web/visual design studio.<br />📌 Bengaluru, India
				</div>
			</div>
		</div>
	</div>
	<div class="page-slide">
		<RotatingCube />
	</div>
	<div class="page-slide">
		<div class="console-top">
			<div class="screen">
				<svelte:component this={currentScreen.component} />
			</div>
			<div class="controls-main">
				<div class="controls-left">
					<div class="d-pad">
						<button disabled></button>
						<button id="up" on:click={() => handleInput('up')}>
							<img src="{base}/up-arrow.png" alt="↑" />
						</button>
						<button id="left" on:click={() => handleInput('left')}>
							<img src="{base}/left-arrow.png" alt="←" />
						</button>
						<button id="right" on:click={() => handleInput('right')}>
							<img src="{base}/right-arrow.png" alt="→" />
						</button>
						<button id="down" on:click={() => handleInput('down')}>
							<img src="{base}/down-arrow.png" alt="↓" />
						</button>
					</div>
				</div>
				<div class="controls-right">
					<div class="action-buttons">
						<button id="A" on:click={() => handleInput('a')}>A</button>
						<button id="B" on:click={() => handleInput('b')}>B</button>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="page-slide">
		<div class="console-bot">
			<div class="fold">
				<div class="fold1"></div>
				<div class="fold2"></div>
				<div class="fold1"></div>
			</div>
			<div class="logo-circle"></div>
			<div class="screen2">
				<div class="misctab">
					<h1>Miscellaneous Skills</h1>
					<p>(Swipe up here for more)</p>
				</div>
				<div class="misctab">
					<h1>Data Analytics</h1>
					<p>I used to be a data scientist. I still use numbers to ask better questions.</p>
				</div>
				<div class="misctab">
					<h1>Audio Mixing</h1>
					<p>Audacity, Da Vinci. Basic sound editing, mixing? No worries.</p>
				</div>
				<div class="misctab">
					<h1>Content Writing</h1>
					<p>I write like I speak. Clear, direct, and sharp enough to hold someone's attention.</p>
				</div>
				<div class="misctab">
					<h1>Photography</h1>
					<p>I know my way around f-stops, composition, and golden ratios.</p>
				</div>
			</div>
			<div class="dual-speaker">
				<div class="speaker">
					<div class="cut"></div>
					<div class="cut"></div>
					<div class="cut"></div>
					<div class="cut"></div>
				</div>
				<div class="speaker">
					<div class="cut"></div>
					<div class="cut"></div>
					<div class="cut"></div>
					<div class="cut"></div>
				</div>
			</div>
		</div>
	</div>

	<div class="page-slide">
		<section class="quote-panel">
			<div class="quote-line" id="q1a">
				The master <span id="q1b" style="color: #df3756;"> economist</span> must possess a
			</div>
			<div class="quote-line" id="q1c">
				rare combination of gifts. <span id="q1d">He must be:</span>
			</div>
			<div class="quote-line sq1" style="color: #9FC581;">a mathematician,</div>
			<div class="quote-line sq1" style="color: #89B865;">a historian,</div>
			<div class="quote-line sq1" style="color: #659B5E;">a statesman,</div>
			<div class="quote-line sq1" style="color: #537E4E;">and a philosopher.</div>

			
		</section>
	</div>
</div>

<!-- The box is always rendered, but its visibility is controlled by GSAP -->
<div class="bottom-box" bind:this={bottomBoxElement}>
	<a href="{base}/agni_junesforge_resume.pdf" target="_blank" on:click={playExternalClickSound}>
		<img src="{base}/resume.svg" alt="" />
		Resume / CV
	</a>
	<a href="https://www.instagram.com/jxnesforge/" target="_blank" on:click={playExternalClickSound}>
		<img src="{base}/insta.svg" alt="" />
		jxnesforge
	</a>

	<a href="https://dribbble.com/jxnesforge" target="_blank" on:click={playExternalClickSound}>
		<img src="{base}/dribbble.svg" alt="" />
		jxnesforge
	</a>

	<a href="https://www.linkedin.com/in/agnihotra-bhattacharya/" target="_blank" on:click={playExternalClickSound}>
		<img src="{base}/linkedin.svg" alt="" />
		LinkedIn
	</a>

	<a href="mailto:agnihotra.bhattacharya@gmail.com" target="_blank" on:click={playExternalClickSound}>
		<img src="{base}/mail.svg" alt="" />
		Write to me!
	</a>
</div>

<style>
	.quote-panel {
		height: 100vh;
		display: grid;
		place-content: center;
		/* background-color: #262625; */
		z-index: 5;
	}

	.quote-line {
		font-family: 'Forum';
		font-size: 2rem;
		color: #e8f7ee;
	}
	.bottom-box {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 100px;
		background-color: var(--vibranium); /* Example color */
		border-top: 4px solid var(--gold);
		color: var(--gold);
		display: flex;
		justify-content: space-evenly;
		align-items: center;
		font-size: 2rem;
		z-index: 10; /* Ensure it's above other content */
		/* Initial state for GSAP animation */
		transform: translateY(80px);
		opacity: 0;
		visibility: hidden;

		a {
			appearance: none;
			text-decoration: none;
			color: inherit;
			font-family: 'Ubuntu Mono';
			display: flex;
			font-size: 1rem;
			flex-direction: column;
			align-items: center;
		}

		img {
			width: 50px;
			height: 50px;
			filter: invert(0.5);
		}
	}

	.hero {
		display: flex;
		flex-direction: column;
		margin: auto;
	}

	.welcome {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.hero-line {
		font-family: 'Arvo';
		font-size: 3rem;
		color: #a1b3a5;
	}

	#hero-logo {
		position: relative;
	}

	#h1a {
		position: relative;
		bottom: -20px;
	}

	#h1b {
		color: #397367;
	}

	.common-text {
		color: #a59271;
		font-family: 'Fira Code';
		font-size: 1rem;
		/* width: 100%; */
		margin-top: 1rem;
	}

	.controls-main {
		padding-top: 2rem;
		padding-bottom: 1rem;
		width: 100%;
		display: flex;
		position: relative;
		z-index: 1;
		margin: auto;
		justify-content: space-evenly;
		align-items: center;
	}

	.controls-left,
	.controls-right {
		flex-basis: 50%;
		display: flex;
		justify-content: flex-end;
		align-items: center;
	}

	.d-pad {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		width: 120px;
		height: 120px;
		margin: 2vmin auto;
		box-sizing: border-box;
		/* padding: 1rem; */
		margin-block: auto;
		margin-left: 2rem;
		margin-right: auto;
		z-index: 0;
	}

	.d-pad button {
		margin: auto;
		width: 100%;
		height: 100%;
		aspect-ratio: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 2vmin;
		background-color: #722b2b; /* --secondary */
		cursor: pointer;
		padding: 3px;
		box-sizing: border-box;
		border: none;
		color: #c2c2c2;
		box-shadow:
			rgba(0, 0, 0, 0.4) 0px 2px 4px 1px,
			rgba(0, 0, 0, 0.3) 0px 9px 15px -3px,
			rgba(0, 0, 0, 0.4) 0px -5px 0px inset;
	}

	.d-pad button img {
		filter: brightness(1.3) saturate(0);
		/* opacity: .6; */
		width: 80%;
		height: 80%;
		aspect-ratio: 1;
		margin: auto;
	}

	.d-pad button:hover {
		transform: translateY(-3px);
	}

	.d-pad button:active {
		transform: translateY(0px);
		box-shadow:
			rgba(0, 0, 0, 0.4) 0px 2px 4px 1px,
			rgba(0, 0, 0, 0.3) 0px 9px 15px -3px;
	}

	.d-pad button:disabled {
		background-color: #722b2b; /* --secondary */
		cursor: not-allowed;
		grid-area: 2 / 2 / 3 / 3;
		z-index: 1;
		box-shadow: none;
		box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 5px inset;
		height: 110%;
		transform: translateY(-3px);
	}

	#up {
		grid-area: 1 / 2 / 2 / 3;
		z-index: 0;
	}

	#left {
		grid-area: 2 / 1 / 3 / 2;
		z-index: 1;
	}

	#right {
		grid-area: 2 / 3 / 3 / 4;
		z-index: 1;
	}

	#down {
		grid-area: 3 / 2 / 4 / 3;
		z-index: 2;
	}

	.action-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		box-sizing: border-box;
		padding: 1.5rem;
		gap: 1rem;
		border-radius: 100px;
		height: fit-content;
		transform: rotateZ(-45deg);
		background-color: inherit;
		box-shadow:
			rgba(0, 0, 0, 0.2) 0px 8px 4px inset,
			rgba(0, 0, 0, 0.2) 0px 10px 6px -3px inset,
			rgba(0, 0, 0, 0.2) -8px 0px 4px inset,
			rgba(0, 0, 0, 0.2) -10px 0px 6px -3px inset,
			rgba(0, 0, 0, 0.2) 0px -3px 0px inset;
		margin-left: auto;
		margin-right: 2rem;
	}

	.action-buttons button {
		background-color: #21715e;
		font-family: 'Dogica Pixel';
		text-align: center;
		font-size: 1.5rem;
		transform: rotateZ(45deg);
		border-radius: 50%;
		aspect-ratio: 1;
		width: 50px;
		margin: 0;
		border: none;
		transition: all 0.1s ease;
		box-shadow:
			rgba(0, 0, 0, 0.4) 0px 6px 4px,
			rgba(0, 0, 0, 0.3) 0px 9px 15px -3px,
			rgba(0, 0, 0, 0.4) 0px -5px 0px inset;
	}

	.action-buttons button:hover {
		transform: translateX(2px) translateY(-2px) rotateZ(45deg);
		box-shadow:
			rgba(0, 0, 0, 0.4) 2px 8px 4px,
			rgba(0, 0, 0, 0.3) 2px 11px 15px -3px,
			rgba(0, 0, 0, 0.4) 0px -5px 0px inset;
	}

	.action-buttons button:active {
		transform: translateX(0px) translateY(0px) rotateZ(45deg);
		box-shadow:
			rgba(0, 0, 0, 0.4) 0px 6px 4px,
			rgba(0, 0, 0, 0.3) 0px 9px 15px -3px;
	}

	#A {
		color: #c0c0c0;
		background-color: #722b2b; /* --secondary */
	}

	#B {
		color: #c0c0c0;
		background-color: #722b2b; /* --secondary */
	}

	.back-button {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		background: none;
		border: 1px solid white;
		color: white;
		font-family: 'Silkscreen', monospace;
		padding: 0.5rem 1rem;
		cursor: pointer;
		z-index: 10;
	}

	@media (max-width: 768px) {
		
		.console-top {
			/* margin: auto 1rem 0; */
			width: 90%;
		}
		.console-bot {
			/* margin: auto 1rem 0; */
			width: 90%;
		}
	}


	.console-bot {
		z-index: 2;
		position: relative;
		/* max-width: 700px; */
		/* width: clamp(50%, 75%, 80%); */
		margin: auto;
		margin-top: 0;
		height: fit-content;
		padding-top: 0rem;
		border-radius: 0 0 40px 40px;
		border: none;
		box-shadow:
			rgba(0, 0, 0, 0.4) 0px -23px 25px 0px inset,
			rgba(0, 0, 0, 0.3) 0px -36px 30px 0px inset,
			rgba(0, 0, 0, 0.2) 0px -79px 40px 0px inset,
			rgba(0, 0, 0, 0.1) 0px 2px 1px,
			rgba(0, 0, 0, 0.2) 0px 4px 2px,
			rgba(0, 0, 0, 0.2) 0px 8px 4px,
			rgba(0, 0, 0, 0.2) 0px 16px 8px,
			rgba(0, 0, 0, 0.2) 0px 32px 16px;
	}

	.fold {
		display: flex;
		box-shadow:
			rgba(0, 0, 0, 0.4) 0px 2px 4px,
			rgba(0, 0, 0, 0.3) 0px 7px 13px -3px,
			rgba(0, 0, 0, 0.2) 0px -3px 0px inset;
	}

	.fold1 {
		height: 1rem;
		width: 20%;
		background-color: #4d4d4d;
		border-bottom: 4px solid #3a3a3a;
	}

	.fold2 {
		height: 1rem;
		width: 60%;
		background-color: #6f6f6f;
		border-bottom: 4px solid #3a3a3a;
		border-left: 4px solid #3a3a3a;
		border-right: 4px solid #3a3a3a;
	}

	.logo-circle {
		z-index: 1;
		position: relative;
		height: 105px;
		aspect-ratio: 1;
		margin: 20px auto;
		border-radius: 50%;
		/* border: #3a3a3a 4px solid; */
		transform: translateY(-5px);
		box-shadow:
			rgba(50, 50, 93, 0.5) 0px 10px 20px -4px inset,
			rgba(0, 0, 0, 0.5) 0px 6px 12px -6px inset;
	}

	.screen2 {
		width: 70%;
		overscroll-behavior: contain;
		height: 180px;
		z-index: 1;
		position: relative;
		display: flex;
		flex-wrap: wrap;
		overflow-y: scroll;
		scrollbar-width: none;
		margin: 3rem auto;
		background-color: #c4c4c4;
		border-radius: 20px;
		box-shadow:
			#21715e 0px 0px 0px 4px,
			rgba(6, 24, 42, 0.65) 0px 8px 12px -1px,
			rgba(255, 255, 255, 0.1) 0px 8px 0px inset,
			rgba(0, 0, 0, 0.4) 0px 8px 4px,
			rgba(0, 0, 0, 0.3) 0px 7px 13px -3px,
			rgba(0, 0, 0, 0.2) 0px -6px 0px inset;
	}

	.misctab {
		color: #282828;
		margin-right: 0;
		padding: 1rem;
		height: 100%;
		width: 100%;
	}

	.misctab h1 {
		font-family: 'Jersey 25';
	}

	.misctab p {
		font-family: 'Fira Code';
	}

	.dual-speaker {
		margin: auto;
		width: 90%;
		display: flex;
	}

	.speaker {
		padding-block: 0.5rem;
		position: relative;
		margin: auto;
		width: 33%;
		max-width: 150px;
	}

	.cut {
		background-color: #545454;
		height: 0.5rem;
		margin-block: 0.5rem;
		margin-inline: 1rem;
		box-shadow: rgba(0, 0, 0, 0.7) 2px 2px 4px inset;
	}

	.footer {
		margin: auto;
		display: flex;
		min-width: 400px;
		max-width: 700px;
		justify-content: space-around;
	}

	.footer a {
		text-decoration: none;
		color: inherit;
		font-family: Silkscreen;
		color: #d66666;
		font-size: 1.5rem;
		border: 2px solid #d66666;
		padding: 4px 8px;
	}

	.footer a:hover {
		transform: translateY(-2px);
		text-shadow: 5px 5px #000000;
		box-shadow: 5px 5px #000000;
	}
</style>
