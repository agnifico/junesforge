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

/* =============================================================
   STUDIO — the freelance-facing home at /next.
   The deck above is still what `/` renders. Design, Code and
   Contact are shared and locked; everything below is new.
   Lines marked REVIEW are provisional claims or numbers that
   only Agni can confirm.
   ============================================================= */

export const STUDIO_LABELS = ['Home', 'Design', 'Code', 'Work', 'Why', 'Process', 'Packages', 'Contact'];

const EMAIL = 'junesforge@proton.me';

/* A mailto that opens with the three questions every first call needs. */
export const enquiry = {
	label: 'Start a project',
	href:
		`mailto:${EMAIL}?subject=${encodeURIComponent('New project enquiry')}` +
		`&body=${encodeURIComponent("Hi Agni,\n\nWhat I'm building:\n\nRough budget:\n\nWhen I'd like it live:\n\n")}`
};

export const studioMeta = {
	title: 'Junesforge — Websites and web apps, designed and built by one person',
	description:
		'Junesforge is an independent design and development studio in Bengaluru. Websites, brands and web apps for small businesses, from first call to launch.'
};

/* ---- HERO --------------------------------------------------
   The nav sits on the home screen; the claim, lede and buttons
   sit beside the exploded chip on the second screen. */
export const hero = {
	nav: [
		{ label: 'Work', goto: 3 },
		{ label: 'Packages', goto: 6 },
		{ label: 'Process', goto: 5 },
		{ label: 'FAQ', goto: 6 } // Packages and FAQ now share a screen
	],
	// Rendered as two lines; the second takes the accent.
	headline: ['Agency-grade work.', 'Without the agency.'],
	/* "works from the whole map", not "holds every part": which parts
	   of the circuit Agni owns, directs or brings a partner in for is
	   still to be marked (see the board). */
	lede:
		'Junesforge is one person: me. I design and build brands, websites and web apps, working from the whole map you see here, from a brand’s voice to its code. No departments, no handoffs, no contractor you never meet.',
	place: 'Bengaluru, India · working with clients anywhere'
};

/* ---- THE CHIP (the home scene) -----------------------------
   The home scene (panels/Board.svelte) opens on two words and the
   circuit; scrolled, it takes the circuit apart beside the hero's
   claim above (panels/Claim.svelte). Pillar names and their cards
   are in brand-graph.js. */
export const board = {
	// Over the resting board, as large as the page allows.
	words: ['Integrated', 'Unified'],
	// The button bottom right that opens the whole circuit, and closes it.
	expand: { open: 'Open the full circuit', close: 'Close the full circuit' },
	// Read out to screen readers when it opens.
	keys: 'Arrow keys step through the parts. Escape closes.',
	// The chip readout: what a part takes its values from.
	takesFrom: 'Takes from',
	source: 'Everything else starts here',
	/* Not on the page right now. Agni's own line: no Ogilvy original
	   turned up, so it carries no attribution if it comes back. */
	line: ['Marketing is 10% creativity', 'and 90% systems.'],
	/* The processor is all of marketing. `maker`, `name` and `part`
	   are lettered on its lid; `does` is read out to screen readers.
	   `lid: 'logo'` shows the Junesforge logo there instead, on the
	   home screen.
	   REVIEW: the part number is a nod to the line, 10% and 90%. */
	chip: {
		maker: 'Junesforge',
		part: 'MK-1090',
		name: 'Marketing',
		does: 'Turns attention into revenue',
		lid: 'name' // 'name' | 'logo'
	},
	alt: 'Marketing as one integrated circuit: the brand at its core, wired to its substance, material, rules, form and signal.'
};

/* ---- 05 · WORK ---------------------------------------------
   `kind` drives the tag: concept work is always labelled as such.
   Visuals: `image` wins; otherwise `preview` renders the live page
   as a thumbnail; with neither, a labelled slot holds the space.
   Drop screenshots into /static/images/work/ and set `image`.
   `hidden: true` keeps an item out of the page (and out of the
   prerender crawl) without deleting it. */
export const work = {
	heading: 'Work',
	// The carousel's arrows, read out to screen readers.
	prev: 'Previous project',
	next: 'Next project',
	items: [
		{
			kind: 'Concept',
			title: 'Halden Physio',
			type: 'Website and booking flow',
			brief: 'A neighbourhood clinic losing patients to phone tag and a booking form nobody finishes.',
			did: 'Brand, a five-section site, and a booking flow that goes from treatment to confirmed slot in four taps.',
			hidden: true, // off for now: the prerender can't resolve /concepts/*/
			links: [{ label: 'Open the prototype', href: '/concepts/halden/' }],
			preview: '/concepts/halden/',
			image: null,
			wide: true
		},
		{
			kind: 'Concept',
			title: 'Mise',
			type: 'Web app · onboarding and dashboard',
			brief: 'A cloud kitchen running stock on a notebook and a WhatsApp group.',
			did: 'Onboarding that builds the kitchen as you answer, then a dashboard for orders, stock alerts and the morning prep list.',
			hidden: true, // off for now: the prerender can't resolve /concepts/*/
			links: [{ label: 'Open the prototype', href: '/concepts/mise/' }],
			preview: '/concepts/mise/#dashboard',
			image: null,
			wide: true
		},
		{
			kind: 'Client',
			title: 'Conference identities',
			type: 'Logo and brand marks',
			brief: 'Three international events, each needing a mark that works on a lanyard and on a stage screen.',
			did: 'GCC Conference on Energy Communication, an ESG summit, and the Future Wellbeing Congress.',
			links: [{ label: 'See them on Dribbble', href: 'https://dribbble.com/jxnesforge' }],
			strip: [
				{ src: '/images/GCEC2.jpg', alt: 'GCEC monogram for the GCC Conference on Energy Communication', fit: 'contain' },
				{ src: '/images/ESG1.png', alt: 'ESG summit banner mark', fit: 'contain' },
				{ src: '/images/FWC1.png', alt: 'Future Wellbeing Congress butterfly mark', fit: 'cover' }
			]
		},
		{
			kind: 'Product',
			title: 'Propsize',
			type: '3D editor · live',
			brief: 'Measure, resize and refit 3D props to real-world scale, in the browser.',
			did: 'Product design, the 3D engine, and the editor UI. Built and shipped solo.',
			links: [{ label: 'Open the tool', href: '/propsize' }],
			image: '/images/products/propsize.jpg'
		},
		{
			kind: 'Game',
			title: "Dawn's Journey",
			type: 'Browser RPG · playable',
			brief: 'A role-playing game in a hand-drawn world, that runs entirely in the browser.',
			did: 'Quest engine, turn-based combat and the world itself. Built solo, with no backend.',
			links: [{ label: 'Play it', href: 'https://dawns-journey.vercel.app/' }],
			image: '/images/products/dawns-journey.jpg'
		},
		{
			kind: 'Product',
			title: 'Arboreum',
			type: 'Notes app · live',
			brief: 'A notes app where what you write grows into a garden of trees.',
			did: 'Concept, interface and build, start to finish.',
			links: [{ label: 'Open the app', href: 'https://arboreum-v1.vercel.app' }],
			image: '/images/products/arboreum.jpg'
		},
		{
			kind: 'Game',
			title: 'Fire Fighter Girl',
			type: 'Browser game · playable',
			brief: 'An open world you fly through.',
			did: 'Built solo, start to finish.',
			links: [{ label: 'Play it', href: 'https://firefightergirl.vercel.app/' }],
			image: '/images/products/firefighter-girl.jpg'
		},
		{
			kind: 'Game',
			title: 'Chessboard Battlefield',
			type: 'Tactics game · playable',
			brief: 'Top-down tactics on a chequered field: move, hold ground, spend abilities.',
			did: 'Rules, interface and build. Built solo.',
			links: [{ label: 'Play it', href: 'https://chessboard-combat.vercel.app/' }],
			image: '/images/products/chessboard-battlefield.jpg'
		}
	]
};

/* ---- PACKAGES (screen 07, with the FAQ) --------------------
   The page shows each one's name, who it is for and how long it
   takes. `includes`, `from` and `priceFallback` are not on the page
   any more; they are kept for the call. REVIEW all of it. */
export const packages = {
	// "Packages" stays only as the screen's id: on the page it reads as a price list.
	heading: 'Ways to work together',
	items: [
		{
			name: 'Launch',
			for: 'A new business, or a relaunch that is overdue.',
			includes: [
				'Up to five pages, mobile first',
				'Help writing the copy',
				'Contact or booking form',
				'Search basics and analytics',
				'Hosting set up in your name'
			],
			time: '2–3 weeks',
			from: null
		},
		{
			name: 'Brand + Site',
			for: 'When you need to look like yourself before you go live.',
			includes: [
				'Logo and wordmark',
				'Colour and type system',
				'Social and print kit',
				'Everything in Launch'
			],
			time: '4–6 weeks',
			from: null,
			featured: true
		},
		{
			name: 'Web app',
			for: 'Bookings, dashboards, inventory, admin panels, the internal tool you keep doing by hand.',
			includes: [
				'Workflow mapping before any screens',
				'Designed and built end to end',
				'Logins, roles and a real database',
				'Handover docs your next developer can read'
			],
			time: 'Scoped on a call',
			from: null
		},
		{
			name: 'Care',
			for: 'After launch, for anyone who would rather not think about it.',
			includes: [
				'Updates, fixes and small changes',
				'Uptime and backup checks',
				'A monthly report in plain language'
			],
			time: 'Monthly',
			from: null
		}
	],
	priceFallback: 'Fixed quote after a 20-minute call'
};

/* ---- 07 · PROCESS + ABOUT ---------------------------------- */
export const process = {
	heading: 'How a project runs',
	steps: [
		{ title: 'A 20-minute call', blurb: 'Free. What you need, and whether I’m the right fit.' },
		{ title: 'A written proposal', blurb: 'Scope, timeline and a fixed price in two working days.' },
		{ title: 'Design, then build', blurb: 'A live preview link from the first week.' },
		{ title: 'Launch and handover', blurb: 'The code, domain and accounts are yours, with notes.' }
	],
	about: {
		heading: 'Who is behind it',
		photo: null, // REVIEW: a real photo does more here than anything else on the page
		body: [
			'I am Agni. I spent four years at Juniper Networks building internal AI tools, including a language model for network engineers.',
			'Before that I studied computer engineering at MIT Manipal and edited the student paper, MTTN, with 150 writers, artists and photographers. Junesforge is where both halves meet.'
		],
		link: { label: 'More about me on Agnifico', href: '' } // REVIEW: Agnifico URL
	}
};

/* ---- WHY (screen 06) ----------------------------------------
   The agencies argument, on the home page: the receipt (its figures
   and story are in `versus` below, shared with /next/agencies), each
   charge against an agency paired with what you get here instead,
   and the close. The long read stays at /next/agencies. No charge
   rests on Agni being a contractor now: Agni isn't. */
export const why = {
	// the premise, over the whole screen
	eyebrow: 'Why not work with an agency?',
	instead: 'How I work instead',
	// who each line of a pair is about
	sides: { agency: 'An agency', here: 'Junesforge' },
	pairs: [
		{
			charge: 'The people in the pitch are not the people on the job.',
			answer: 'You talk to the maker.',
			blurb: 'No account manager relaying your feedback. The person on the call does the work.'
		},
		{
			charge: 'Your website is outsourced.',
			answer: 'Design and code in one head.',
			blurb: 'No handoff between a designer and a developer, so nothing gets lost.'
		},
		{
			charge: 'You cannot see who you are hiring.',
			answer: 'You see exactly who you’re hiring.',
			blurb: 'The work above is mine. What I make for you is yours: the code, the domain, every account.'
		}
	],
	more: { label: 'Read the whole argument', href: '/next/agencies' }
};

/* ---- 07 · PACKAGES + FAQ (one screen) ----------------------- */
export const faq = {
	heading: 'Questions',
	lede: 'Anything else, ask me directly.',
	items: [
		{
			q: 'Should I hire an agency instead?',
			a: 'Sometimes. Running a national TV campaign, fifty deliverables a month, or crores in media spend? Hire one: the good ones exist, mostly at the very top, and they earn their fee. For a brand, a website or a product built properly, you do not need five layers of people. You need the one doing the work.'
		},
		{
			q: 'How much does a website cost?',
			a: 'It depends on the pages, the features and whether you need a brand first. After a short call you get a fixed quote in writing, and that is the price.'
		},
		{
			q: 'How long will it take?',
			a: 'A Launch site usually takes two to three weeks, a brand and site four to six. Web apps are scoped individually. You will have a date before we start.'
		},
		{
			q: 'I do not have my content ready. Is that a problem?',
			a: 'No. Most clients do not. I help write and structure the copy, and I can source or create the imagery.'
		},
		{
			q: 'What do you build with?',
			a: 'A modern web stack: SvelteKit or React, three.js when something needs to be 3D, and a simple editor if you want to update content yourself.'
		},
		{
			q: 'Will I own the site?',
			a: 'Yes. The code, the domain and the hosting account are in your name from day one.'
		},
		{
			q: 'What happens after launch?',
			a: 'Two weeks of fixes are included. After that you can take the Care plan, book changes as you need them, or hand it to anyone you like.'
		},
		{
			q: 'Do you work with clients outside India?',
			a: 'Yes. Everything runs remotely, and I keep a few hours of overlap with your working day.'
		}
	]
};

/* ---- VERSUS (/next/agencies) -------------------------------
   The case against the agency model, from someone who has been
   inside agencies and has been the freelancer they call. Every
   claim is first-hand or framed as what Agni saw; no agency or
   client is named, and none should be.
   REVIEW the receipt: the numbers are as Agni remembers them. */
export const versus = {
	meta: {
		title: 'Junesforge vs the agency: your agency was going to hire me anyway',
		description:
			'A lot of agencies in India sell you a name, then subcontract the work to freelancers. Hire the freelancer directly.'
	},
	hero: {
		label: 'Junesforge vs the agency',
		headline: ['Your agency', 'was going to', 'hire me anyway.'],
		lede:
			'A lot of agencies in India are a founder, a salesperson and a phone full of freelancers. You pay for the name on the invoice. The work goes to someone like me, hired on contract after you sign, for a fraction of what you paid.'
	},
	/* In the flow: one number and two bars. The story itself opens
	   on demand, in a card. REVIEW the figures: they are as Agni
	   remembers them, and the multiple and bars are worked out
	   from them. */
	receipt: {
		label: 'This happened',
		heading: 'Same project. Same person. Two prices.',
		multiple: 'the price through an agency, for the same person doing the same work',
		bars: {
			direct: 'Hiring me',
			agency: 'Hiring the agency',
			work: 'the work',
			markup: 'markup',
			fee: 'fee'
		},
		coda: 'Freelancers in India quote low to compete with agency names. Agencies hire those same freelancers and bill you as if they had a team. You pay twice for one person: once for the work, and once for the letterhead.',
		open: 'Read what happened',
		story: [
			'A client asked me to quote for a website. I pitched it at ₹80,000.',
			'Some time later an agency messaged me. They needed a website built. As the details came in, I recognised the brief. It was the same project.',
			'The agency offered me ₹1,50,000 to build it. They had told the client the developer was charging ₹2,00,000, and added their own 10% on top: ₹2,20,000 in all.'
		],
		// direct: what Agni quoted. agency: what the developer was offered,
		// what the client was told it cost, and the agency's fee on top.
		figures: { direct: 80000, paid: 150000, billed: 200000, fee: 20000 }
	},
	inside: {
		label: 'From the inside',
		heading: 'What you are actually paying for',
		items: [
			{
				title: 'The people in the pitch are not the people on the job.',
				body: 'Many small agencies are two or three founders and someone in business development. Selling is their job. They stay short-staffed on purpose, because every salary they do not pay is margin, so your project goes to whoever is free, or to whoever they hire after you sign. I have worked in these teams.'
			},
			{
				title: 'One video person. Fifteen other projects.',
				body: 'A good videographer or video editor is rare, so most agencies keep one. Your shoot joins their queue, and your edit gets whatever time is left.'
			},
			{
				title: 'Your website is outsourced.',
				body: 'Most agencies do not keep developers. They find one per project, on contract, at the lowest rate they can get. I know because I am who they call.'
			},
			{
				title: 'You cannot see who you are hiring.',
				body: 'The best designers leave small agencies fast, for in-house roles, top studios or their own practice. The portfolio you were shown was made by people who may be gone. Who gets your project is decided after you pay.'
			}
		]
	},
	proof: {
		label: 'Judge the thinking',
		heading: 'Ask an agency to show you how it thinks.',
		body: [
			'On my home page is how I see marketing: 67 functions, from the brand’s voice to its packaging to its posting schedule, wired into one integrated circuit. It is the map I work from on every project.',
			'An agency splits that map across five departments and a contractor. Here, one person holds all of it.'
		],
		link: { label: 'See the circuit', href: '/next' }
	},
	fair: {
		label: 'To be fair',
		heading: 'When you should hire an agency',
		body: 'Running a national TV campaign, fifty deliverables a month, or crores in media spend? Hire one. The good ones exist, mostly at the very top, and they earn their fee. For a brand, a website or a product built properly, you do not need five layers of people. You need the one doing the work.'
	},
	close: {
		heading: ['Cut out', 'the middle.'],
		lede: 'Same work, no markup. You talk to the person building it, from the first call to launch day.',
		back: { label: 'Back to Junesforge', href: '/next' }
	}
};
