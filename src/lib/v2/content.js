/* =============================================================
   V2 CONTENT — single source of truth for the deck.
   Everything that is *words* or *links* lives here.
   Change copy here; the panels never hardcode text.
   ============================================================= */

/* ---- 00 · rail / meta ------------------------------------- */
export const LABELS = ['Agni', 'Design', 'Code', 'Products', 'Gallery', 'Roles', 'Contact'];

export const meta = {
	title: 'Junesforge — Agni, Designer & Engineer',
	wordmark: 'Junesforge',
	location: 'Bengaluru, India',
	year: '2026'
};

/* ---- 01 · IDENTITY ----------------------------------------
   The front door. Deliberately sparse: one identity line, one
   tagline, one creed, two doors, one piece of work. Anything
   that wants to be said twice gets said on a later screen. */
export const identity = {
	brand: {
		logo: '/images/Logo_Main.svg',
		wordmark: 'Junesforge'
	},

	/* The little pill at the top-right. Closed it is just the name;
	   hovering (or focusing) unfurls the sell. */
	teaser: {
		flag: 'New',
		short: 'Propsize',
		long: 'Try my new 3D editing app',
		href: '/propsize'
	},

	// One mono line: `greeting` sets light, `name` sets bold and accented.
	// Trailing space on the greeting is load-bearing — the two <span>s are
	// written flush in the markup so no whitespace sneaks between them.
	greeting: 'Hello, I am ',
	name: 'Agni',

	/* The tagline doubles as the navigation. Segments carrying a `goto`
	   become inline links into the deck; the rest is plain text. */
	tagline: [
		{ text: 'At junesforge, I ' },
		{ text: 'design things', goto: 1, tone: 'rust' },
		{ br: true }, // hard break so each link owns a line
		{ text: 'and ' },
		{ text: 'build them', goto: 2, tone: 'jade' },
		{ text: ' too.' }
	],

	/* Signs off the hero, under the creed. */
	signature: {
		role: 'Designer–Engineer', // the hyphenate appears exactly once on this screen
		location: 'Bengaluru, India'
	},
	creed: [
		'Human psychology, math, materials, intent, stories —',
		'for me, all are parameters of the same game called design.',
		"And I'm good at games."
	],

	/* The two big doors, parked for now — the tagline links do this job.
	   Flip `showDoors` back to true to bring the band back. */
	showDoors: false,
	doors: [
		{ n: '01', label: 'Design', goto: 1, tone: 'rust' },
		{ n: '02', label: 'Code', goto: 2, tone: 'jade' }
	],

	/* One highlighted piece. Swap `src` / `href` for whichever
	   project is leading that month. */
	featured: {
		kicker: '◦ Featured work',
		title: 'Fire Fighter Girl',
		meta: 'Role-playing Game · Solo build',
		// The tile cross-fades through these, centre-cropped — no fitting.
		shots: [
			'/images/firefighter/firefighter-1.jpg',
			'/images/firefighter/firefighter-2.jpg',
			'/images/firefighter/firefighter-3.jpg',
			'/images/firefighter/firefighter-4.jpg'
		],
		rotateMs: 5000,
		cta: 'Play now',
		href: 'https://firefightergirl.vercel.app/'
	},

	availability: 'Open to roles',
	docs: [
		{ label: 'Résumé', href: '/docs/Agnihotra Bhattacharya — Resume.pdf' },
		{ label: 'Dark', href: '/docs/Agnihotra Bhattacharya — Resume - Dark.pdf' }
	],

	/* `handle` unfurls on hover and is plain selectable text, so it can be
	   copied rather than only clicked. */
	socials: [
		{
			label: 'Dribbble',
			handle: 'jxnesforge',
			href: 'https://dribbble.com/jxnesforge',
			icon: '/images/dribbble.svg'
		},
		{
			label: 'Instagram',
			handle: 'jxnesforge',
			href: 'https://www.instagram.com/jxnesforge/',
			icon: '/images/insta.svg'
		},
		{
			label: 'LinkedIn',
			handle: 'agnihotra-bhattacharya',
			href: 'https://www.linkedin.com/in/agnihotra-bhattacharya/',
			icon: '/images/linkedin.svg'
		},
		{
			label: 'Email',
			handle: 'junesforge@proton.me',
			href: 'mailto:junesforge@proton.me',
			icon: '/images/mail.svg'
		}
	],

	hint: 'Scroll ↓'
};

/* ---- 02 · DESIGN ------------------------------------------- */
export const design = {
	index: '01',
	kicker: 'What I do — the art half',
	heading: 'DESIGN',
	lede: 'Positioning, language, imagery, storytelling.',
	items: [
		{
			n: '01',
			title: 'Branding',
			blurb:
				'Brand position translated into a design language and imagery, aligned to your goals.'
		},
		{
			n: '02',
			title: 'Logoworks',
			blurb: 'Marks, wordmarks, monograms.'
		},
		{
			n: '03',
			title: 'Graphic Design',
			blurb:
				'All-round editing and design. Posters, decks, editorial, packaging, whatever your org needs.'
		}
	],
	// The mark is inlined as a component (BrandMark.svelte), not loaded from a
	// file — see the note in there. All that is left to configure is its
	// accessible label.
	art: { caption: 'Future Wellbeing Congress — brand mark' }
};

/* ---- 03 · CODE --------------------------------------------- */
export const code = {
	index: '02',
	kicker: 'What I do — the engineering half',
	heading: 'CODE',
	lede: 'Shipped software, start to end.',
	items: [
		{
			n: '01',
			title: 'Applications',
			blurb: 'Tools, CRMs, ERPs, internal systems, databases — whatever an organisation needs for admin.'
		},
		{
			n: '02',
			title: 'Web Sites',
			blurb: 'Static, blogs, e-commerce, and 3D-heavy. Thoughfulness comes first.'
		},
		{
			n: '03',
			title: 'Games',
			blurb:
				'Browser-based games. Quest engines, turn-based combat, character sketching, art, storylining, level design.'
		}
	]
};

/* ---- 04 · PRODUCTS -----------------------------------------
   No `external` flag on these any more: every link out of the deck opens
   in a new tab regardless of whether it leaves the site, so there was
   nothing left reading it.
   Every digital thing I've shipped, in one place. Each card carries
   one wide shot — drop screenshots in at any size, they cover. */
export const products = {
	index: '03',
	kicker: 'Things I made for myself',
	heading: 'Products',
	caption: 'Five apps · built solo',
	cards: [
		{
			status: 'Live',
			live: true,
			title: 'Propsize',
			meta: '3D editor · In-browser',
			blurb: 'Measure, resize and refit props to real-world scale. No install.',
			cta: 'Open the tool',
			href: '/propsize',
			src: '/images/products/propsize.jpg',
			tone: 'jade'
		},
		{
			status: 'Playable',
			title: 'FFG - Fire Fighter Girl',
			meta: 'Game · Solo build',
			blurb: 'An open world you fly through. Built solo, start to finish.',
			cta: 'Play now',
			href: 'https://firefightergirl.vercel.app/',
			src: '/images/products/firefighter-girl.jpg',
			crop: 'hud', // push past the game's own HUD strip
			tone: 'rust'
		},
		{
			status: 'Playable',
			title: "Dawn's Journey",
			meta: 'Browser RPG · Solo build',
			blurb: 'Quest engine, turn-based combat, a hand-drawn world. No backend.',
			cta: 'Play now',
			href: 'https://dawns-journey.vercel.app/',
			src: '/images/products/dawns-journey.jpg',
			tone: 'brass'
		},
		{
			status: 'Playable',
			title: 'Chessboard Battlefield',
			meta: 'Combat sim · Solo build',
			blurb: 'Top-down tactics on a chequered field. Move, hold ground, spend abilities.',
			cta: 'Play now',
			href: 'https://chessboard-combat.vercel.app/',
			src: '/images/products/chessboard-battlefield.jpg',
			tone: 'brass'
		},
		{
			status: 'Live',
			live: true,
			title: 'Arboreum',
			meta: 'Notes app · Solo build',
			blurb: 'A notes app where what you write grows into a garden of trees.',
			cta: 'Open the app',
			href: 'https://arboreum-v1.vercel.app',
			src: '/images/products/arboreum.jpg',
			tone: 'jade'
		}
	]
};

/* ---- 05 · GALLERY (was "Evidence") ------------------------- */
export const gallery = {
	index: '04',
	kicker: 'Selected work',
	heading: 'Gallery',
	outbound: { label: 'The rest lives on Dribbble →', href: 'https://dribbble.com/jxnesforge' },
	// `wide: true` makes a tile span two columns (the hero tile).
	tiles: [
		{
			wide: true,
			kicker: 'Illustration · Series',
			title: 'Isometric Cities',
			src: '/images/project-isometric.jpg',
			href: 'https://dribbble.com/jxnesforge',
			tone: 'ink'
		},
		{
			kicker: 'Conference · Logo',
			title: 'ESG Summit',
			src: '/images/ESG1.png',
			href: 'https://dribbble.com/shots/27290136-ESG-An-Event-Logo',
			tone: 'ink'
		},
		{
			kicker: 'Conference · Logo',
			title: 'Future Wellbeing',
			src: '/images/FWC1.png',
			href: 'https://dribbble.com/shots/27290166-Event-Logo-Future-Wellbeing-Congress',
			tone: 'sand'
		},
		{
			kicker: 'Illustration',
			title: 'Forge Blueprints',
			src: '/images/project-forge.svg',
			href: 'https://dribbble.com/shots/25752613-Forge-Blueprints',
			tone: 'ink'
		},
		{
			kicker: '36 Days of Type',
			title: 'Letterforms',
			src: '/images/project-type.webp',
			href: 'https://dribbble.com/jxnesforge',
			tone: 'sand'
		},
		{
			kicker: 'Logoworks · Conference',
			title: 'Event · Logo',
			src: '/images/GCEC2.jpg',
			fit: 'contain', // a mark on an empty field — cropping it just hides the logo
			href: 'https://dribbble.com/shots/25752613-Forge-Blueprints',
			tone: 'ink'
		}
	]
};

/* ---- 06 · ROLES + HISTORY ---------------------------------- */
export const roles = {
	status: 'Open to roles',
	// One title, not two: "Product Designer · Designer–Engineer" wrapped to a
	// second line on every phone and repeated a role the landing screen already
	// states. The Freelance / Design · Branding · Web aside is gone for the same
	// reason — the Design and Code panels establish the service list in full.
	primary: {
		title: 'Product Designer and Developer',
		meta: 'Full-time · Remote'
	},
	docs: [
		{ label: 'Résumé', href: '/docs/Agnihotra Bhattacharya — Resume.pdf' },
		{ label: 'Dark', href: '/docs/Agnihotra Bhattacharya — Resume - Dark.pdf' }
	],
	historyKicker: '◦ Somewhere behind',
	history: [
		{
			when: '2015–2019',
			what: 'MIT Manipal',
			detail: 'Computer & Communication Engineering.',
			tone: 'rust'
		},
		{
			when: '2017–2019',
			what: 'Editor-in-Chief, MTTN',
			detail: '150+ writers, artists and photographers across 22 colleges.'
		},
		{
			when: '2019–2023',
			what: 'Juniper Networks',
			detail: 'Internal AI tools. A network-focused language model for ~150 engineers.'
		},
		{
			when: 'Since 2023',
			what: 'Independent',
			detail: 'A studio of one. Currently: games, tools, and whatever counts as fun.',
			tone: 'jade'
		}
	],
	toolbeltKicker: '◦ Also in the toolbelt',
	toolbelt:
		'Data analytics · AI image & video · Video editing · Audio mixing · Photography · Content writing'
};

/* ---- 07 · CONTACT ------------------------------------------ */
export const contact = {
	quote: 'Out beyond the world of code and art, there is a field where they merge.',
	quoteTail: "I'll meet you there.",
	monogram: 'JF',
	links: [
		{ label: 'junesforge@proton.me', href: 'mailto:junesforge@proton.me', primary: true },
		// Icon-only in the closing panel: the landing screen already spells these
		// out in its utility strip, so repeating the wordmarks here just competes
		// with the address, which is the one thing this panel is asking for.
		{
			label: 'LinkedIn',
			href: 'https://www.linkedin.com/in/agnihotra-bhattacharya/',
			icon: '/images/linkedin.svg'
		},
		{ label: 'Dribbble', href: 'https://dribbble.com/jxnesforge', icon: '/images/dribbble.svg' },
		{ label: 'Instagram', href: 'https://www.instagram.com/jxnesforge/', icon: '/images/insta.svg' }
	],
	footLeft: 'Junesforge · Bengaluru · 2026',
	footRight: 'Designed & built by Agni'
};
