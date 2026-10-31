<script>
	// ---- Image assets ---------------------------------------------
	const assets = {
		logo: '/images/Logo_Main.svg',
		logoLight: '/images/Logo_RED.svg',
		nuvatraMap: '/images/nuvatra-map.png',
		featured: '/images/air.svg',
		icons: {
			dribbble: '/images/dribbble.svg',
			linkedin: '/images/linkedin.svg',
			instagram: '/images/insta.svg',
			email: '/images/mail.svg'
		}
	};
	let mode = $state('dark'); // 'dark' | 'light'

	// ---- Theme picker (remove before launch) ---------------------
	let theme = $state('malachite');
	const themes = [
		{ id: 'gold', label: 'Gold' },
		{ id: 'malachite', label: 'Malachite' },
		{ id: 'blood', label: 'Blood' }
	];
	function toggleMode() {
		mode = mode === 'dark' ? 'light' : 'dark';
		theme = mode === 'dark' ? 'malachite' : 'blood';
	}

	// ---- Content: Panel 1 -----------------------------------------
	const bio = {
		name: 'Agni',
		role: 'Designer–Engineer',
		tagline: 'At junesforge, I design things and build them too.',
		historyLines: [
			'Human psychology, math, materials, intent, stories,',
			'for me, all are parameters of the same game called design.',
			"And I'm good at games."
		],
		location: 'Bengaluru, India'
	};

	const contextualLinks = [
		{ label: 'Brand Systems', href: '#brand' },
		{ label: 'Product UI', href: '#ui' },
		{ label: 'Code', href: '#fullstack' }
	];

	const resumeLinks = [
		{ label: 'resume', href: '/docs/Agnihotra Bhattacharya — Resume.pdf' },
		{ label: 'resume-dark', href: '/docs/Agnihotra Bhattacharya — Resume - Dark.pdf' }
	];

	const roles = [
		{ label: 'Product Designer · Designer–Engineer', meta: 'Remote · Bengaluru' },
		{ label: 'Freelancer', meta: 'Design · Branding · Web' }
	];

	const featured = {
		tag: '◦ FEATURED · ISOMETRIC',
		title: 'Isometric Cities',
		subtitle: 'Illustrator · Isometric · series on Dribbble',
		href: 'https://dribbble.com/jxnesforge'
	};

	const socials = [
		{ label: 'Dribbble', href: 'https://dribbble.com/jxnesforge', icon: assets.icons.dribbble },
		{
			label: 'LinkedIn',
			href: 'https://www.linkedin.com/in/agnihotra-bhattacharya/',
			icon: assets.icons.linkedin
		},
		{
			label: 'Instagram',
			href: 'https://www.instagram.com/jxnesforge/',
			icon: assets.icons.instagram
		},
		{ label: 'Email', href: 'mailto:agnihotra.bhattacharya@gmail.com', icon: assets.icons.email }
	];

	const services = [
		{ id: 'ui', title: 'Product UI', scope: 'Web apps, dashboards, design systems' },
		{ id: 'brand', title: 'Brand Systems', scope: 'Identity, logos, editorial' },
		{
			id: 'frontend',
			title: 'Front-end Engineering',
			scope: 'Svelte, SvelteKit, interactive prototypes'
		},
		{ id: 'fullstack', title: 'Full-stack Development', scope: 'TypeScript, APIs, game-feel' },
		{ id: 'editorial', title: 'Content & Editorial', scope: 'Writing, long-form, editing' }
	];

	// ---- Content: Panel 2 -----------------------------------------
	const history = [
		{ when: '2015–2019', what: 'MIT Manipal', detail: 'Computer & Communication Engineering' },
		{
			when: '2017–2019',
			what: 'Editor-in-Chief, MTTN',
			detail: '150+ writers, artists, photographers across 22 colleges'
		},
		{
			when: '2019–2023',
			what: 'Juniper Networks',
			detail: 'Internal AI tools. Network-focused language model for ~150 engineers.'
		},
		{
			when: 'Since 2023',
			what: 'Independent',
			detail:
				'Freelance design and software. Currently building games, and whatever I consider "fun".'
		}
	];

	const projects = [
		{
			kind: 'hero',
			title: "Dawn's Journey",
			subtitle: 'Browser RPG · Solo build',
			blurb:
				'190 files. 89 components. A full design system, quest engine, turn-based combat, and world map. No backend.',
			tools: ['SvelteKit', 'TypeScript', 'Tiled', 'Affinity'],
			href: 'https://dawns-journey.vercel.app/devs-corner',
			external: true,
			cover: '/images/project-dawns-journey.png'
		},
		{
			kind: 'hero',
			title: 'Arboreum',
			subtitle: 'Notes app · Solo build',
			blurb:
				"A notes app where your notes grow as trees. Same design vocabulary as Dawn's Journey, different domain.",
			tools: ['SvelteKit', 'TypeScript'],
			href: 'https://arboreum-v1.vercel.app',
			external: true,
			cover: '/images/project-arboreum.png'
		},
		{
			kind: 'small',
			title: 'Insta Help — Rebrand',
			subtitle: 'Brand case study',
			blurb: 'A self-directed rebrand case study.',
			tools: ['Affinity', 'Branding'],
			href: '/docs/InstaHelp_Case_study.pdf',
			external: false,
			cover: '/images/project-instahelp.png'
		},
		{
			kind: 'small',
			title: 'Forge Blueprints',
			subtitle: 'Illustration',
			blurb: 'Art-deco blade, shield, and spear technical drawings.',
			tools: ['Illustrator'],
			href: 'https://dribbble.com/shots/25752613-Forge-Blueprints',
			external: true,
			cover: '/images/project-forge.svg'
		},
		{
			kind: 'small',
			title: 'Logos & Type',
			subtitle: 'Logo',
			blurb: 'Logo for a conference for the GCC.',
			tools: ['Affinity'],
			href: 'https://dribbble.com/shots/27290153-Event-Logos-5-GCC-Conference-on-Energy-Communication',
			external: true,
			cover: '/images/GCEC2.jpg'
		},
		{
			kind: 'small',
			title: 'Logos & Type',
			subtitle: '36 Days of Type · Logos',
			blurb: 'Logo commissions, stickers, typographic studies.',
			tools: ['Affinity', 'Illustrator'],
			href: 'https://dribbble.com/jxnesforge',
			external: true,
			cover: '/images/project-type.webp'
		},
		{
			kind: 'small',
			title: 'Logos & Type',
			subtitle: 'Logo',
			blurb: 'Logo for an environment summit.',
			tools: ['Affinity', 'Illustrator'],
			href: 'https://dribbble.com/shots/27290136-ESG-An-Event-Logo',
			external: true,
			cover: '/images/ESG1.png'
		},
		{
			kind: 'small',
			title: 'Logos & Type',
			subtitle: 'Logo',
			blurb: 'Logo commissions, stickers, typographic studies.',
			tools: ['Affinity', 'Illustrator'],
			href: 'https://dribbble.com/shots/27290166-Event-Logo-Future-Wellbeing-Congress',
			external: true,
			cover: '/images/FWC1.png'
		},
		{
			kind: 'small',
			title: 'Fest Logo',
			subtitle: 'Logo · Branding',
			blurb: 'In memory of college.',
			tools: ['Photoshop', 'Branding'],
			href: 'https://dribbble.com/shots/3597650-End-Point-Sticker',
			external: true,
			cover: '/images/TT16.png'
		},
		{
			kind: 'small',
			title: 'Isometric Series',
			subtitle: 'Environment illustration',
			blurb: 'Four isometric cityscapes. On Dribbble.',
			tools: ['Affinity'],
			href: 'https://dribbble.com/jxnesforge',
			external: true,
			cover: '/images/project-isometric.jpg'
		}
	];

	// ---- Content: Panel 3 -----------------------------------------
	const miscSkills = [
		{
			title: 'Data Analytics',
			note: 'I used to be a data scientist. I still use numbers to ask better questions.'
		},
		{ title: 'Audio Mixing', note: 'Audacity, DaVinci. Basic sound editing, mixing? No worries.' },
		{ title: 'Video Editing', note: 'Light cuts, reels, gameplay clips. Nothing cinematic — yet.' },
		{
			title: 'AI Generation',
			note: 'Image and video pipelines. Diffusion, TensorArt, CFG tuning.'
		},
		{ title: 'Photography', note: 'I know my way around f-stops, composition, and golden ratios.' },
		{
			title: 'Content Writing',
			note: "I write like I speak. Clear, direct, and sharp enough to hold someone's attention."
		}
	];

	import RotatingCube from '$lib/animations/RotatingCube.svelte';
	// ---- GSAP entry + quote animations ----------------------------
	import { onMount } from 'svelte';

	let entryDone = $state(false);
	let siteEl = $state(null);

	onMount(async () => {
		// Dynamic import so SSR doesn't break
		const [{ gsap }, { ScrollTrigger }, { TextPlugin }] = await Promise.all([
			import('gsap'),
			import('gsap/ScrollTrigger'),
			import('gsap/TextPlugin')
		]);
		gsap.registerPlugin(ScrollTrigger, TextPlugin);

		// CRITICAL: .site is the scroller (not window), because it has overflow+snap
		ScrollTrigger.defaults({ scroller: siteEl });

		// ───── Entry animation ─────
		// Wordmark starts centered + large, "welcome" text fades in, then wordmark
		// flies to its grid position and the rest of the grid assembles.
		const entryTl = gsap.timeline({
			onComplete: () => {
				entryDone = true;
			}
		});

		entryTl
			.to('.entry-welcome', { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0)
			.to('.entry-welcome', { opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.7)
			.to('.entry-overlay', { opacity: 0, duration: 0.45, ease: 'power2.in' }, 0.75)
			.set('.entry-overlay', { display: 'none' }, 1.2)
			.from(
				'.panel-1 .card',
				{
					opacity: 0,
					y: 10,
					duration: 0.5,
					stagger: 0.06,
					ease: 'power2.out'
				},
				0.9
			);

		// ───── Quote panel animation (one-shot on entry) ─────
		ScrollTrigger.create({
			trigger: '.quote-panel',
			scroller: siteEl,
			start: 'top 80%',
			once: true,
			onEnter: () => {
				const qTl = gsap.timeline();
				qTl
					.from('#q1a', { opacity: 0, duration: 0.5, delay: 0.2 })
					.from('#q1c', { opacity: 0, duration: 0.5 }, '<0.6')
					.to(
						'#q1b',
						{
							duration: 0.5,
							text: 'of the forge',
							ease: 'none'
						},
						'<0.6'
					)
					.from('#q1d', { opacity: 0, duration: 0.5 }, '<0.8')
					.from(
						'.sq1',
						{
							stagger: 0.6,
							opacity: 0,
							duration: 0.5
						},
						'<0.9'
					);
			}
		});

		return () => {
			ScrollTrigger.killAll();
		};
	});
</script>

<!--
	BACKUP — the portfolio home page as it stood before the v2 deck replaced it
	on 2026-09-08. Kept whole and reachable at /legacy so copy and layout can be
	lifted across, but noindex'd so it never competes with `/` in search.
	Nothing links here; it is reached by typing the URL.
-->
<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
	<title>Junesforge — Agni, Designer–Engineer</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link
		href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<!-- REMOVE BEFORE LAUNCH: theme picker -->
<!-- <div class="theme-picker">
	{#each themes as t}
		<button class="theme-btn" class:active={theme === t.id} onclick={() => (theme = t.id)}>
			{t.label}
		</button>
	{/each}
</div> -->

<!-- Entry overlay — fades out after ~1.2s -->
<div class="entry-overlay" class:done={entryDone} aria-hidden="true">
	<div class="entry-particles"></div>
	<div class="entry-center">
		<img src={assets.logo} alt="" class="entry-logo" />
		<div class="entry-welcome">
			<div class="entry-welcome-top">welcome to</div>
			<div class="entry-welcome-bottom">jxnesforge</div>
		</div>
	</div>
</div>

<div class="site" data-theme={theme} data-mode={mode} bind:this={siteEl}>
	<!-- Optional ambient video bg. Toggle via data-video. -->
	<div class="video-bg" aria-hidden="true">
		<video autoplay loop muted playsinline preload="auto">
			<source
				src="https://videos.pexels.com/video-files/9665235/9665235-hd_1920_1080_25fps.mp4"
				type="video/mp4"
			/>
		</video>
		<div class="video-overlay"></div>
	</div>

	<!-- ══════════════════════════════════════
	     PANEL 1 — WHO
	     ══════════════════════════════════════ -->
	<main class="panel panel-1">
		<div class="bento">
			<!-- WORDMARK -->
			<section class="card wordmark" aria-label="Junesforge wordmark">
				<span class="corner corner-tl"></span>
				<span class="corner corner-br"></span>
				<button
					class="wordmark-logo-flip"
					onclick={toggleMode}
					aria-label="Toggle light/dark mode"
					title="Click to toggle theme"
				>
					<img src={assets.logo} alt="JF" class="wordmark-logo face-front" />
					<img src={assets.logoLight} alt="" class="wordmark-logo face-back" aria-hidden="true" />
				</button>
				<div class="wordmark-text">JXNESFORGE</div>
			</section>

			<!-- NUVATRA MAP BANNER -->
			<section class="card banner" aria-label="Nuvatra map banner">
				<div class="banner-fallback"></div>
				<img src={assets.nuvatraMap} alt="Nuvatra map" class="banner-img" />
				<div class="banner-vignette"></div>
				<!-- <div class="card-tag">◦ DAWN'S JOURNEY</div> -->
				<div class="game-logo">
					<img src="/images/dawns_journey_logo_v1.svg" alt="" srcset="" />
				</div>
				<a href="https://dawns-journey.vercel.app/" target="_blank" class="play-now">Play Now!</a>
			</section>

			<!-- BIO BLOCK -->
			<section class="card bio" aria-label="Bio">
				<div class="card-tag">◦ BIO</div>
				<div class="bio-name">{bio.name}</div>
				<div class="bio-role">{bio.role}</div>
				<p class="bio-tagline">{bio.tagline}</p>
				<ul class="bio-history">
					{#each bio.historyLines as line}
						<li>{line}</li>
					{/each}
				</ul>
				<!-- <p class="bio-links">
					I work with{#each contextualLinks as link, i}
						{' '}<a href={link.href} class="ctx-link">{link.label}</a
						>{#if i < contextualLinks.length - 2},{:else if i === contextualLinks.length - 2}, and{/if}
					{/each}.
				</p> -->
				<div class="resume-links">
					{#each resumeLinks as res (res.label)}
						<a href={res.href} class="ctx-link" target="_blank">{res.label}</a>
					{/each}
				</div>
				<div class="bio-location">{bio.location}</div>
			</section>

			<!-- OPEN TO ROLES -->
			<section class="card open-to-roles" aria-label="Open to roles">
				<div class="status-row">
					<span class="status-dot"></span>
					<span class="status-label">OPEN TO ROLES</span>
				</div>
				<ul class="role-list">
					{#each roles as r}
						<li>
							<div class="role-title">{r.label}</div>
							<div class="role-meta">{r.meta}</div>
						</li>
					{/each}
				</ul>
			</section>

			<!-- ELSEWHERE -->
			<section class="card elsewhere" aria-label="Elsewhere">
				<div class="card-tag">◦ ELSEWHERE</div>
				<ul class="socials">
					{#each socials as s}
						<li>
							<a href={s.href} target="_blank" rel="noopener noreferrer">
								<img src={s.icon} alt="" class="social-icon" />
								<span class="social-arrow">→</span>
								<span class="social-label">{s.label}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>

			<!-- SERVICES -->
			<section class="card services" aria-label="What I do">
				<div class="card-tag">◦ WHAT I DO</div>
				<ul class="services-list">
					{#each services as s}
						<li class="service-item" id={s.id}>
							<span class="service-title">{s.title}</span>
							<span class="service-scope">{s.scope}</span>
						</li>
					{/each}
				</ul>
			</section>

			<!-- FEATURED -->
			<a
				href={featured.href}
				target="_blank"
				rel="noopener noreferrer"
				class="card featured"
				aria-label="Featured: {featured.title}"
			>
				<div class="featured-fallback"></div>
				<img src={assets.featured} alt={featured.title} class="featured-img" />
				<div class="featured-vignette"></div>
				<div class="featured-text">
					<div class="card-tag">{featured.tag}</div>
					<div class="featured-title">{featured.title}</div>
					<div class="featured-subtitle">{featured.subtitle}</div>
				</div>
				<div class="featured-arrow">↗</div>
			</a>
		</div>

		<div class="panel-footer">PANEL 1 · WORK ↓</div>
	</main>

	<!-- ══════════════════════════════════════
	     PANEL 2 — WORK
	     ══════════════════════════════════════ -->
	<main class="panel panel-2">
		<div class="panel-2-inner">
			<!-- HISTORY STRIP -->
			<section class="history" aria-label="History">
				<div class="card-tag">◦ SOMEWHERE BEHIND</div>
				<ul class="history-list">
					{#each history as h}
						<li class="history-item">
							<span class="history-when">{h.when}</span>
							<span class="history-what">{h.what}</span>
							<span class="history-detail">{h.detail}</span>
						</li>
					{/each}
				</ul>
			</section>

			<!-- PROJECTS GRID -->
			<section class="projects" aria-label="Selected projects">
				<div class="card-tag projects-tag">◦ SELECTED WORK</div>
				<div class="project-grid">
					{#each projects as p}
						<a
							href={p.href}
							class="card project-card"
							class:hero={p.kind === 'hero'}
							target={p.external ? '_blank' : '_self'}
							rel={p.external ? 'noopener noreferrer' : ''}
						>
							<div class="project-cover">
								<div class="project-cover-fallback"></div>
								<img src={p.cover} alt={p.title} class="project-cover-img" />
								<div class="project-cover-vignette"></div>
							</div>
							<div class="project-body">
								<div class="project-head">
									<h3 class="project-title">{p.title}</h3>
									<span class="project-arrow">{p.external ? '↗' : '→'}</span>
								</div>
								<div class="project-subtitle">{p.subtitle}</div>
								<p class="project-blurb">{p.blurb}</p>
								<ul class="project-tools">
									{#each p.tools as t}
										<li>{t}</li>
									{/each}
								</ul>
							</div>
						</a>
					{/each}
				</div>
			</section>
		</div>

		<div class="panel-footer">PANEL 2 · MISC ↓</div>
	</main>

	<!-- ══════════════════════════════════════
	     PANEL 3 — VANITY + CONTACT CLOSER
	     ══════════════════════════════════════ -->
	<main class="panel panel-3">
		<div class="panel-3-inner">
			<div class="panel-3-left">
				<!-- Miscellaneous skills -->
				<section class="misc" aria-label="Miscellaneous skills">
					<div class="card-tag">◦ ELSEWHERE IN THE TOOLBELT</div>
					<ul class="misc-list">
						{#each miscSkills as m}
							<li class="misc-item">
								<span class="misc-title">{m.title}</span>
								<span class="misc-note">{m.note}</span>
							</li>
						{/each}
					</ul>
				</section>

				<!-- Economist quote — GSAP one-shot on entry -->
				<section class="quote-panel">
					<div class="quote-line" id="q1a">
						The master <span id="q1b" class="quote-swap">economist</span> must possess a
					</div>
					<div class="quote-line" id="q1c">
						rare combination of gifts. <span id="q1d">He must be:</span>
					</div>
					<div class="quote-line sq1">a mathematician,</div>
					<div class="quote-line sq1">a historian,</div>
					<div class="quote-line sq1">a statesman,</div>
					<div class="quote-line sq1">and a philosopher.</div>
				</section>
			</div>

			<div class="panel-3-right">
				<!-- Petal cube wax seal (placeholder — swap for original later) -->
				<div class="seal" aria-hidden="true">
					<RotatingCube />
					<!-- <div class="seal-cube">
						<span class="seal-face seal-front"></span>
						<span class="seal-face seal-back"></span>
						<span class="seal-face seal-right"></span>
						<span class="seal-face seal-left"></span>
						<span class="seal-face seal-top"></span>
						<span class="seal-face seal-bottom"></span>
					</div> -->
				</div>

				<!-- Closing -->
				<p class="closing-line">
					<em>Out beyond the world of code and art, is a field where they merge.</em>
					<br />
					<em>I'll meet you there.</em>
				</p>

				<!-- Contact reinforced -->
				<div class="closing-contact">
					<a href="mailto:agnx13@proton.me">agnx13@proton.me</a>
					<span class="sep">·</span>
					<a
						href="https://www.linkedin.com/in/agnihotra-bhattacharya/"
						target="_blank"
						rel="noopener noreferrer">LinkedIn</a
					>
					<span class="sep">·</span>
					<a href="https://dribbble.com/jxnesforge" target="_blank" rel="noopener noreferrer"
						>Dribbble</a
					>
				</div>

				<div class="signoff">
					<span>Junesforge</span>
					<span class="signoff-dot">·</span>
					<span>Bengaluru, {new Date().getFullYear()}</span>
				</div>
			</div>
		</div>
	</main>
</div>

<style>
	/* =================================================================
	   THEMES
	   ================================================================= */
	:global(:root) {
		--bg: #0a0a0a;
		--surface: #111111;
		--surface-raised: #141414;

		--text: #e8e8e8;
		--text-muted: #888888;
		--text-dim: #555555;

		--green: #4ade80;

		--font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
		--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
		--font-pixel: 'Silkscreen', monospace;

		--radius-card: 14px;
		--space-card: 20px;
		--icon-filter: brightness(0) invert(1); /* white icons on dark */
		--card-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02), inset 0 0 0 1px rgba(0, 0, 0, 0.3);
	}

	/* LIGHT MODE — overrides root defaults */
	[data-mode='light'] {
		--bg: #efe9dc;
		--surface: #e3dccb;
		--surface-raised: #d8d0bc;

		--text: #1a1612;
		--text-muted: #5a5246;
		--text-dim: #8c846f;

		--green: #2d8f4e; /* darker green so the status dot reads on cream */

		/* invert + hue rotate to keep particle relationships sane */
		--video-filter: invert(1) hue-rotate(180deg) saturate(0.7) brightness(0.95);
		--video-overlay: linear-gradient(
			to bottom,
			rgba(239, 233, 220, 0.4) 0%,
			rgba(239, 233, 220, 0.65) 100%
		);
		--icon-filter: brightness(0); /* black icons on cream */
		--card-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 0 0 1px rgba(0, 0, 0, 0.04);

		.featured-title {
			color: rgb(192, 192, 192);
			/* color: var(--accent-soft); */
			line-height: 1.2;
			margin-bottom: 4px;
		}
		.featured-subtitle {
			color: #adadad;
		}
		.featured-text .card-tag {
			color: #adadad;
		}
		
	}

	[data-theme='gold'] {
		--accent: #c9a94a;
		--accent-dim: #8a7330;
		--accent-soft: rgba(201, 169, 74, 0.12);
		--accent-text: #c9a94a;
	}
	[data-theme='malachite'] {
		--accent: #21715e;
		--accent-dim: #397367;
		--accent-soft: rgba(33, 113, 94, 0.18);
		--accent-text: #5dcaa5;
	}
	[data-theme='blood'] {
		--accent: #df3756;
		--accent-dim: #8a2133;
		--accent-soft: rgba(223, 55, 86, 0.12);
		--accent-text: #df3756;
	}

	/* When light mode + blood accent are both active, alphas need to be higher
   because rgba over cream is fundamentally less visible than over near-black. */
	[data-mode='light'][data-theme='blood'] {
		--accent-soft: rgba(139, 33, 51, 0.22); /* darker red base, higher alpha */
		--accent-text: #a82338; /* slightly darker red for contrast on cream */
		--accent-dim: #6a1828; /* deeper for borders */
	}

	:global(html),
	:global(body) {
		background: var(--bg);
		color: var(--text);
		margin: 0;
		padding: 0;
		font-family: var(--font-body);
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	:global(body),
	.site,
	.card,
	.panel {
		transition:
			background-color 0.6s ease,
			color 0.6s ease,
			border-color 0.6s ease;
	}

	:global(*) {
		box-sizing: border-box;
	}

	/* =================================================================
	   SCROLL-SNAP CONTAINER
	   ================================================================= */
	.site {
		height: 100vh;
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		scroll-behavior: smooth;
		background-color: transparent;
		position: relative;
		z-index: 1;
	}

	/* Theme picker */
	.theme-picker {
		position: fixed;
		top: 16px;
		right: 16px;
		display: flex;
		gap: 4px;
		padding: 4px;
		background: rgba(20, 20, 20, 0.8);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		z-index: 100;
	}
	.theme-btn {
		background: transparent;
		border: none;
		color: var(--text-dim);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		padding: 6px 10px;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.theme-btn:hover {
		color: var(--text);
	}
	.theme-btn.active {
		background: var(--accent-soft);
		color: var(--accent-text);
	}

	/* =================================================================
	   ENTRY OVERLAY
	   ================================================================= */
	.entry-overlay {
		position: fixed;
		inset: 0;
		background: var(--bg);
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.entry-overlay.done {
		display: none;
	}
	.entry-particles {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 18% 30%, rgba(255, 215, 100, 0.08) 0, transparent 1.5px),
			radial-gradient(circle at 72% 60%, rgba(255, 240, 200, 0.07) 0, transparent 1.5px),
			radial-gradient(circle at 35% 80%, rgba(255, 215, 100, 0.06) 0, transparent 1.5px),
			radial-gradient(circle at 88% 20%, rgba(255, 240, 200, 0.08) 0, transparent 1.5px),
			radial-gradient(circle at 55% 45%, rgba(255, 215, 100, 0.05) 0, transparent 1.5px);
		filter: blur(0.4px);
		opacity: 0.9;
	}
	.entry-center {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		z-index: 1;
	}
	.entry-logo {
		width: 96px;
		height: 96px;
		object-fit: contain;
	}
	.entry-welcome {
		text-align: center;
		opacity: 0;
		font-family: var(--font-body);
	}
	.entry-welcome-top {
		font-size: 1rem;
		color: var(--text-muted);
		letter-spacing: 0.05em;
	}
	.entry-welcome-bottom {
		font-family: var(--font-pixel);
		font-size: 1.6rem;
		color: var(--accent-text);
		letter-spacing: 0.2em;
		margin-top: 6px;
	}

	/* =================================================================
	   VIDEO BACKGROUND (optional, behind everything)
	   ================================================================= */
	.video-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
	}
	.video-bg video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 1;
		filter: var(--video-filter);
		transition: filter 0.6s ease;
		transform: translate(-50%, -50%);
		top: 50%;
		left: 50%;
	}
	.video-overlay {
		position: absolute;
		inset: 0;
		background: var(--video-overlay);
		transition: background 0.6s ease;
	}
	/* If the video fails to load, the bg is still fine — .site has its own bg. */

	/* =================================================================
	   PANEL BASE
	   ================================================================= */
	.panel {
		height: 100vh;
		width: 100%;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}
	.panel-footer {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-dim);
		letter-spacing: 0.15em;
		text-align: center;
		padding: 4px 0 0;
	}

	/* =================================================================
	   SHARED CARD CHROME
	   ================================================================= */
	.card {
		background: var(--surface);
		border: 1px solid var(--accent-soft);
		border-radius: var(--radius-card);
		padding: var(--space-card);
		position: relative;
		transition:
			border-color 0.25s ease,
			background 0.25s ease;
		box-shadow: var(--card-shadow);
		min-height: 0;
		overflow: hidden;
	}
	.card:hover {
		border-color: var(--accent-soft);
		background: var(--surface-raised);
	}
	.card-tag {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--accent-text);
		letter-spacing: 0.2em;
		margin-bottom: 10px;
	}

	/* Corner brackets */
	.corner {
		position: absolute;
		width: 12px;
		height: 12px;
		border-color: var(--accent);
		border-style: solid;
		border-width: 0;
		opacity: 0.6;
		pointer-events: none;
	}
	.corner-tl {
		top: 8px;
		left: 8px;
		border-top-width: 1.5px;
		border-left-width: 1.5px;
	}
	.corner-br {
		bottom: 8px;
		right: 8px;
		border-bottom-width: 1.5px;
		border-right-width: 1.5px;
	}

	.ctx-link {
		color: var(--accent-text);
		text-decoration: none;
		border-bottom: 1px dotted var(--accent-dim);
		padding-bottom: 1px;
		transition: border-color 0.15s ease;
	}
	.ctx-link:hover {
		border-bottom-color: var(--accent);
	}

	/* =================================================================
	   PANEL 1 — BENTO GRID
	   Rows: wordmark | banner    | banner
	         bio      | elsewhere | otr
	         bio      | services  | featured
	   ================================================================= */
	.panel-1 .bento {
		flex: 1;
		display: grid;
		gap: 12px;
		min-height: 0;
		grid-template-columns: 220px 1fr 1fr 1fr;
		grid-template-rows: 160px 1fr 1fr 1fr;
		grid-template-areas:
			'wordmark banner    banner banner'
			'bio      services otr otr'
			'bio      services featured featured'
			'bio      elsewhere  featured featured';
	}
	.wordmark {
		grid-area: wordmark;
	}
	.banner {
		grid-area: banner;
	}
	.bio {
		grid-area: bio;
	}
	.elsewhere {
		grid-area: elsewhere;
	}
	.open-to-roles {
		grid-area: otr;
	}
	.services {
		grid-area: services;
	}
	.featured {
		grid-area: featured;
	}

	/* Wordmark */
	.wordmark {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		text-align: center;
		gap: 6px;
	}
	/* Flip wrapper — the button that holds both logos */
	.wordmark-logo-flip {
		position: relative;
		width: 85px;
		height: 85px;
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		transform-style: preserve-3d;
		display: block; /* ADD: button defaults to inline-block */
		perspective: 800px; /* ADD on parent if you want depth on hover */
		transition: transform 0.3s cubic-bezier(0.65, 0, 0.35, 1);
		/* slight lift on hover so it feels clickable */
	}
	.wordmark-logo-flip:hover .wordmark-logo {
		filter: drop-shadow(0 0 12px var(--accent));
	}
	[data-mode='light'] .wordmark-logo-flip {
		transform: rotateY(180deg);
	}
	[data-mode='light'] .wordmark-logo-flip:hover {
		transform: rotateY(180deg);
	}

	.wordmark-logo {
		position: absolute;
		inset: 0;
		width: 85px;
		height: 85px;
		object-fit: contain;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.face-front {
		transform: rotateY(0deg);
	}
	.face-back {
		transform: rotateY(180deg);
	}
	.wordmark-text {
		font-family: var(--font-pixel);
		font-size: 1.2rem;
		color: var(--accent);
		margin-top: 0;
		letter-spacing: -0.5px;
	}

	/* Banner */
	.banner {
		padding: 0;
	}
	.banner-fallback {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(45deg, #0f0f0f 0 8px, #131313 8px 16px);
	}
	.banner-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 150%;
		object-fit: cover;
		object-position: center 55%;
		animation: slowPan 10s ease-in-out infinite alternate;
	}
	@keyframes slowPan {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-16%);
		}
	}
	.banner-vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			linear-gradient(
				to bottom,
				rgba(10, 10, 10, 0.5) 0%,
				transparent 25%,
				transparent 75%,
				rgba(10, 10, 10, 0.6) 100%
			),
			linear-gradient(
				to right,
				rgba(10, 10, 10, 0.3) 0%,
				transparent 20%,
				transparent 80%,
				rgba(10, 10, 10, 0.3) 100%
			);
	}
	.banner .card-tag {
		position: absolute;
		top: 16px;
		left: 20px;
		margin: 0;
		z-index: 2;
	}
	.game-logo {
		position: absolute;
		top: 16px;
		right: 20px;
		width: 160px;
		margin: 0;
		z-index: 2;
		img {
			width: 100%;
			height: 100%;
		}
	}
	.play-now {
		position: absolute;
		bottom: 10px;
		right: 10px;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0.5rem 1rem calc(0.5rem + 5px);
		background: linear-gradient(180deg, #8b2a2a 0%, #6e1e1e 100%);
		/* background: rgba(48, 48, 48); */
		color: rgb(255, 255, 255);
		border: 1px solid rgba(0, 0, 0, 0.5);
		box-shadow:
			rgba(0, 0, 0, 0.5) 0 -5px 0 0 inset,
			0 0 20px rgba(139, 42, 42, 0.25);
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		transition: all 0.1s ease;
		white-space: nowrap;
		flex-shrink: 0;
		margin-left: auto;
		filter: hue-rotate(175deg) brightness(1.5) contrast(1) saturate(1.3);
	}
	.play-now:hover {
		background: linear-gradient(180deg, #a83232 0%, #8b2020 100%);
		/* background: rgb(59, 59, 59); */
		box-shadow:
			rgba(0, 0, 0, 0.5) 0 -3px 0 0 inset,
			0 0 28px rgba(200, 60, 60, 0.3);
		transform: translateY(1px);
		/* color: goldenrod; */
	}
	.play-now:active {
		transform: translateY(4px);
		box-shadow: rgba(0, 0, 0, 0.5) 0 -1px 0 0 inset;
	}
	.banner-caption {
		position: absolute;
		bottom: 16px;
		right: 20px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-dim);
		letter-spacing: 0.2em;
		text-transform: uppercase;
		z-index: 2;
	}

	/* Bio */
	.bio {
		display: flex;
		flex-direction: column;
	}
	.bio-name {
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--accent);
		line-height: 1.1;
		margin-bottom: 4px;
		/* color: #4ade80; */
	}
	.bio-role {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
		letter-spacing: 0.1em;
		margin-bottom: 18px;
	}
	.bio-tagline {
		font-size: 1rem;
		color: var(--text);
		line-height: 1.45;
		margin: 0 0 14px 0;
	}
	.bio-history {
		list-style: none;
		padding: 0;
		margin: 0 0 14px 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.bio-history li {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--text-muted);
		line-height: 1.45;
	}
	.bio-history li:nth-of-type(3) {
		color: var(--text-muted);
		color: #5dcaa5;
		color: var(--accent);
	}
	.bio-links {
		font-size: 0.875rem;
		color: var(--text-muted);
		line-height: 1.7;
		margin: 0 0 auto 0;
	}
	.resume-links {
		margin-top: auto;
		/* line-height: 1.7; */
		font-size: 0.875rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.35rem;
		transition: color 5s ease-in-out;
		a {
			width: fit-content;
			color: var(--accent-dim);
		}
		a:hover {
			color: var(--accent-text);
		}
	}
	.bio-location {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-dim);
		letter-spacing: -0.05em;
		word-spacing: -25%;
		margin-top: 1rem;
	}

	/* Open to roles */
	.open-to-roles {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.status-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--green);
		box-shadow: 0 0 8px var(--green);
		animation: pulse 2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
	.status-label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--accent-text);
		letter-spacing: 0.2em;
		font-weight: 600;
	}
	.role-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.role-list li {
		padding-left: 14px;
		border-left: 1px solid var(--accent-soft);
	}
	.role-title {
		font-size: 1rem;
		color: var(--text);
		font-weight: 500;
		line-height: 1.3;
	}
	.role-meta {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
		letter-spacing: 0.05em;
		margin-top: 2px;
	}

	/* Elsewhere / socials */
	.socials {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.socials a {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--text);
		text-decoration: none;
		transition: color 0.15s ease;
	}
	.social-icon {
		width: 14px;
		height: 14px;
		object-fit: contain;
		opacity: 0.7;
		transition: opacity 0.15s ease;
		filter: var(--icon-filter);
	}
	.social-arrow {
		color: var(--text-dim);
		transition: color 0.15s ease;
	}
	.social-label {
		flex: 1;
	}
	.socials a:hover {
		color: var(--accent-text);
	}
	.socials a:hover .social-arrow {
		color: var(--accent);
	}
	.socials a:hover .social-icon {
		opacity: 1;
	}

	/* Services */
	.services {
		display: flex;
		flex-direction: column;
	}
	.services-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		flex: 1;
		justify-content: space-between;
	}
	.service-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-left: 12px;
		border-left: 1px solid var(--accent-soft);
		transition: border-color 0.2s ease;
	}
	.service-item:hover {
		border-left-color: var(--accent);
	}
	.service-title {
		font-size: 0.9375rem;
		color: var(--text);
		font-weight: 500;
		line-height: 1.25;
	}
	.service-scope {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--text-muted);
		letter-spacing: 0.02em;
		line-height: 1.4;
	}

	/* Featured */
	.featured {
		display: block;
		text-decoration: none;
		color: inherit;
		padding: 0;
		cursor: pointer;
		background-color: transparent;
		/* border: 1px solid transparent; */
		&:hover {
			border: 1px solid var(--accent);
			background-color: transparent;
		}
	}
	.featured-fallback {
		position: absolute;
		inset: 0;
		background-color: transparent;
		/* background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 50%, #141414 100%); */
	}
	.featured-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		transition: transform 0.6s ease;
	}
	.featured:hover .featured-img {
		transform: scale(1.03);
	}
	.featured-vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-color: transparent;
		background:
			linear-gradient(
				to top,
				rgba(10, 10, 10, 0.85) 0%,
				rgba(10, 10, 10, 0.2) 50%,
				transparent 100%
			),
			linear-gradient(to bottom, rgba(10, 10, 10, 0.4) 0%, transparent 30%);
	}
	.featured-text {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 20px;
		z-index: 2;
	}
	.featured-text .card-tag {
		margin-bottom: 8px;
	}
	.featured-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--accent);
		line-height: 1.2;
		margin-bottom: 4px;
	}
	.featured-subtitle {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
		letter-spacing: 0.05em;
	}
	.featured-arrow {
		position: absolute;
		top: 16px;
		right: 20px;
		font-family: var(--font-mono);
		font-size: 1rem;
		color: var(--accent-text);
		z-index: 2;
		transition: transform 0.2s ease;
	}
	.featured:hover .featured-arrow {
		transform: translate(2px, -2px);
	}

	/* =================================================================
	   PANEL 2 — WORK
	   ================================================================= */
	.panel-2-inner {
		flex: 1;
		display: flex;
		/* flex-direction: row-reverse; */
		/* flex-direction: column; */
		gap: 20px;
		min-height: 0;
		overflow: hidden;
	}

	/* History strip */
	.history {
		/* flex-shrink: 0; */
		flex: 1;
		/* min-width: 300px; */
		/* flex-grow: 1; */
		max-width: 400px;
	}
	.history-list {
		list-style: none;
		padding: 0;
		margin: 8px 0 0;
		display: grid;
		grid-template-rows: repeat(4, 1fr);
		gap: 10px;
	}
	.history-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-left: 1px solid var(--accent-soft);
		min-width: 0;
	}
	.history-when {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--accent-text);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.history-what {
		font-size: 0.9375rem;
		font-size: 1rem;
		color: var(--text);
		font-weight: 500;
		line-height: 1.25;
	}
	.history-detail {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.45;
	}

	/* Projects */
	.projects {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
	}
	.projects-tag {
		margin-bottom: 0;
	}
	.project-grid {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: 1.2fr 1fr 1fr;
		gap: 12px;
		min-height: 0;
	}
	.project-grid > :nth-child(1) {
		grid-column: 1 / 3;
		grid-row: 1;
	}
	.project-grid > :nth-child(2) {
		grid-column: 3 / 5;
		grid-row: 1;
	}
	.project-grid > :nth-child(n + 3) {
		grid-row: 2;
	}
	.project-grid > :nth-child(n + 7) {
		grid-row: 3;
	}

	.project-card {
		display: flex;
		text-decoration: none;
		color: inherit;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
		min-height: 0;
	}
	.project-card.hero {
		flex-direction: row;
	}
	.project-card:not(.hero) {
		flex-direction: column;
	}

	.project-cover {
		position: relative;
		flex-shrink: 0;
		overflow: hidden;
		background: #0e0e0e;
	}
	.project-card.hero .project-cover {
		width: 45%;
	}
	.project-card:not(.hero) .project-cover {
		width: 100%;
		height: 45%;
	}
	.project-cover-fallback {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
	}
	.project-cover-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.6s ease;
	}
	.project-card:hover .project-cover-img {
		transform: scale(1.04);
	}
	.project-cover-vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(to right, transparent 60%, rgba(10, 10, 10, 0.5) 100%);
	}

	.project-body {
		flex: 1;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		height: fit-content;
	}
	.project-card:not(.hero) .project-body {
		padding: 12px 14px;
		gap: 4px;
	}
	.project-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.project-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		line-height: 1.2;
	}
	.project-card:not(.hero) .project-title {
		font-size: 0.9375rem;
	}
	.project-arrow {
		font-family: var(--font-mono);
		color: var(--accent-text);
		font-size: 0.875rem;
		flex-shrink: 0;
		transition: transform 0.2s ease;
	}
	.project-card:hover .project-arrow {
		transform: translate(2px, -2px);
	}
	.project-subtitle {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-muted);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.project-blurb {
		font-size: 0.8125rem;
		color: var(--text-muted);
		line-height: 1.5;
		margin: 6px 0 0 0;
		flex: 1;
	}
	.project-card:not(.hero) .project-blurb {
		display: none;
	}
	.project-tools {
		list-style: none;
		padding: 0;
		margin: 8px 0 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.project-tools li {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-muted);
		padding: 3px 8px;
		border: 1px solid var(--accent-soft);
		border-radius: 4px;
		letter-spacing: 0.05em;
	}
	.project-card:not(.hero) .project-tools {
		margin-top: 4px;
		gap: 4px;
	}
	.project-card:not(.hero) .project-tools li {
		font-size: 0.625rem;
		padding: 2px 6px;
	}

	/* =================================================================
	   PANEL 3 — CLOSER
	   ================================================================= */
	.panel-3 {
		justify-content: center;
		align-items: center;
	}
	.panel-3-inner {
		max-width: 1200px;
		width: 100%;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 60px;
		align-items: center;
	}
	.panel-3-left {
		display: flex;
		flex-direction: column;
		gap: 40px;
	}
	.panel-3-right {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 32px;
		text-align: center;
	}

	/* Misc skills card on Panel 3 */
	.misc {
		width: 100%;
		text-align: left;
	}
	.misc .card-tag {
		margin-bottom: 16px;
	}
	.misc-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px 24px;
	}
	.misc-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-left: 10px;
		border-left: 1px solid var(--accent-soft);
	}
	.misc-title {
		font-size: 0.875rem;
		color: var(--text);
		font-weight: 500;
		line-height: 1.3;
	}
	.misc-note {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-muted);
		line-height: 1.45;
	}

	/* Quote panel — old-site structure, GSAP animated */
	.quote-panel {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
		max-width: 100%;
	}
	.quote-panel .quote-line {
		font-family: var(--font-body);
		font-size: 1.4rem;
		color: var(--text);
		line-height: 1.5;
		font-weight: 400;
	}
	.quote-panel .quote-line.sq1 {
		font-size: 1.15rem;
		color: var(--text-muted);
		margin-top: 4px;
	}
	.quote-panel #q1b.quote-swap {
		color: var(--accent-text);
		font-style: italic;
		display: inline-block;
	}
	.quote-panel #q1d {
		color: var(--text-muted);
	}

	/* Petal cube wax seal */
	.seal {
		display: flex;
		justify-content: center;
		perspective: 800px;
		margin-bottom: 2rem;
	}
	@keyframes sealRotate {
		0% {
			transform: rotateX(0deg) rotateY(0deg);
		}
		100% {
			transform: rotateX(360deg) rotateY(360deg);
		}
	}

	.closing-line {
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--text-muted);
		line-height: 1.7;
		margin: 0;
		max-width: 520px;
	}
	.closing-line em {
		color: var(--text);
		font-style: italic;
	}

	.closing-contact {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 10px;
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}
	.closing-contact a {
		color: var(--accent-text);
		text-decoration: none;
		border-bottom: 1px dotted var(--accent-dim);
		padding-bottom: 1px;
	}
	.closing-contact a:hover {
		border-bottom-color: var(--accent);
	}
	.closing-contact .sep {
		color: var(--text-dim);
	}

	.signoff {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-dim);
		letter-spacing: 0.2em;
		text-transform: uppercase;
		display: flex;
		gap: 8px;
		margin-top: 20px;
	}
	.signoff-dot {
		color: var(--accent-dim);
	}

	/* =================================================================
	   RESPONSIVE
	   ================================================================= */
	@media (max-width: 900px) {
		.site {
			scroll-snap-type: none;
			height: auto;
			overflow-y: visible;
		}
		.panel {
			height: auto;
			min-height: 100vh;
		}
		.panel-1 .bento {
			grid-template-columns: 1fr;
			grid-template-rows: auto;
			grid-template-areas:
				'wordmark'
				'banner'
				'bio'
				'otr'
				'services'
				'featured'
				'elsewhere';
		}
		.wordmark {
			min-height: 140px;
		}
		.banner {
			min-height: 160px;
		}
		.featured {
			min-height: 280px;
		}
		.panel-2-inner {
			flex-direction: column;
		}

		.history-list {
			grid-template-columns: 1fr;
		}
		.panel-3-inner {
			grid-template-columns: 1fr;
			gap: 40px;
		}
		.misc-list {
			grid-template-columns: 1fr;
		}
		.project-grid {
			grid-template-columns: 1fr;
			grid-template-rows: auto;
		}
		.project-grid > :nth-child(1),
		.project-grid > :nth-child(2) {
			grid-column: auto;
			grid-row: auto;
		}
		.project-grid > :nth-child(n + 3) {
			grid-row: auto;
		}
		.project-card.hero,
		.project-card:not(.hero) {
			flex-direction: column;
		}
		.project-card.hero .project-cover,
		.project-card:not(.hero) .project-cover {
			width: 100%;
			height: 180px;
		}
		.project-card:not(.hero) .project-blurb {
			display: block;
		}
	}
</style>
