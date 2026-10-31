/* =============================================================
   BRAND GRAPH — everything an agency makes for a brand, as objects.
   Source data for the board on /next (screen 02).

   The model: a brand is one object. Every other node is derived
   from it, and `from` lists the objects whose values it takes
   (a Meta ad does not pick a colour, it takes `colour`). Nothing
   on an outer ring invents anything; it only combines what the
   inner rings already decided.

   ring  — distance from the source of truth (0 = the brand itself)
   dept  — the agency team that would usually own it; an edge that
           crosses departments is a handoff between two teams
   params — the parameters the object is defined by
   group — its sub-pillar: one of its ring's `groups`
   ============================================================= */

/* The five pillars around the brand, read outward: substance, given
   material, held by rules, takes form and goes out as signal.
   `name` is the one word the board shows, `label` says it plainly,
   and `about` is the card that opens when a visitor clicks the
   name. `groups` are the sub-pillars, in the order they sit on the
   board. `key` is the shorthand used in code. */
export const RINGS = [
	{ id: 0, key: 'brand', name: 'Brand', label: 'The brand', groups: [], about: '' },
	{
		id: 1,
		key: 'substance',
		name: 'Substance',
		label: 'Who it is',
		groups: ['Insight', 'Stance', 'Story'],
		about: 'Your brand as a person: what it believes, who it talks to and what it has to say. Everything else is made to match.'
	},
	{
		id: 2,
		key: 'material',
		name: 'Material',
		label: 'What it is made of',
		groups: ['Mark', 'Image', 'Sound'],
		about: 'The pieces that person is made of: logo, colour, type, pictures, voice and sound. Every design is cut from them.'
	},
	{
		id: 3,
		key: 'rules',
		name: 'Rules',
		label: 'How it is used',
		groups: ['Space', 'Time', 'Library'],
		about: 'How the material gets used, and when: layouts that hold, a steady rhythm of posting, and a library of words and pictures ready to go.'
	},
	{
		id: 4,
		key: 'form',
		name: 'Form',
		label: 'How it is served',
		groups: ['Screen', 'Feed', 'In person'],
		about: 'The plating. With the ingredients ready, this is how they are served: every page, post, ad and package the public actually sees.'
	},
	{
		id: 5,
		key: 'signal',
		name: 'Signal',
		label: 'How it reaches people',
		groups: ['Reach', 'Read', 'Return'],
		about: 'How it travels and what comes back: getting found, reading what worked, and bringing people back again.'
	}
];

export const DEPTS = {
	core: 'Brand',
	strategy: 'Strategy',
	identity: 'Identity',
	copy: 'Copy',
	digital: 'Web & product',
	production: 'Photo, video & motion',
	social: 'Social',
	performance: 'Performance',
	physical: 'Print, packaging & space',
	sales: 'Sales & PR'
};

export const NODES = [
	/* ---- 0 · the brand ---------------------------------------- */
	{ id: 'brand', label: 'Brand', ring: 0, dept: 'core', params: ['purpose', 'promise', 'personality', 'category'], from: [] },

	/* ---- 1 · substance: what it stands for -------------------- */
	{ id: 'research', label: 'Research', ring: 1, dept: 'strategy', group: 'Insight', params: ['interviews', 'market data', 'sales calls', 'past performance'], from: ['brand'] },
	{ id: 'audience', label: 'Audience', ring: 1, dept: 'strategy', group: 'Insight', params: ['segments', 'jobs to be done', 'objections', 'where they look'], from: ['research'] },
	{ id: 'competitors', label: 'Competitors', ring: 1, dept: 'strategy', group: 'Insight', params: ['players', 'price points', 'visual codes', 'white space'], from: ['research'] },
	{ id: 'positioning', label: 'Positioning', ring: 1, dept: 'strategy', group: 'Stance', params: ['category', 'differentiator', 'proof', 'reason to believe'], from: ['brand', 'audience', 'competitors'] },
	{ id: 'naming', label: 'Naming', ring: 1, dept: 'strategy', group: 'Stance', params: ['name', 'tagline', 'domain', 'trademark'], from: ['positioning'] },
	{ id: 'messaging', label: 'Messaging', ring: 1, dept: 'copy', group: 'Story', params: ['value props', 'pillars', 'proof points', 'one-liner'], from: ['positioning', 'audience'] },
	{ id: 'architecture', label: 'Brand architecture', ring: 1, dept: 'strategy', group: 'Stance', params: ['master brand', 'sub-brands', 'product names'], from: ['positioning', 'naming'] },
	{ id: 'contentStrategy', label: 'Content strategy', ring: 1, dept: 'social', group: 'Story', params: ['themes', 'formats', 'cadence', 'channel mix'], from: ['messaging', 'audience'] },

	/* ---- 2 · material: the parameters everything inherits ----- */
	{ id: 'logo', label: 'Logo', ring: 2, dept: 'identity', group: 'Mark', params: ['wordmark', 'symbol', 'lockups', 'clear space', 'min size'], from: ['naming', 'positioning'] },
	{ id: 'colour', label: 'Colour', ring: 2, dept: 'identity', group: 'Mark', params: ['primary', 'secondary', 'neutrals', 'contrast pairs', 'ratios'], from: ['positioning', 'competitors'] },
	{ id: 'type', label: 'Typography', ring: 2, dept: 'identity', group: 'Mark', params: ['display face', 'text face', 'scale', 'weights', 'licences'], from: ['positioning'] },
	{ id: 'voice', label: 'Voice & tone', ring: 2, dept: 'copy', group: 'Sound', params: ['traits', 'vocabulary', 'do / don’t', 'tone by context'], from: ['messaging', 'audience'] },
	{ id: 'photoDirection', label: 'Photo direction', ring: 2, dept: 'production', group: 'Image', params: ['subject', 'light', 'composition', 'grade', 'casting'], from: ['positioning', 'colour'] },
	{ id: 'illustration', label: 'Illustration style', ring: 2, dept: 'identity', group: 'Image', params: ['line', 'palette', 'figures', 'spot vs scene'], from: ['colour', 'logo'] },
	{ id: 'icons', label: 'Icons', ring: 2, dept: 'identity', group: 'Mark', params: ['grid', 'stroke', 'corners', 'metaphors'], from: ['logo', 'illustration'] },
	{ id: 'shape', label: 'Shape & pattern', ring: 2, dept: 'identity', group: 'Mark', params: ['graphic devices', 'patterns', 'textures'], from: ['logo'] },
	{ id: 'layout', label: 'Grid & spacing', ring: 2, dept: 'identity', group: 'Mark', params: ['columns', 'spacing scale', 'margins', 'density'], from: ['type'] },
	{ id: 'motion', label: 'Motion', ring: 2, dept: 'production', group: 'Image', params: ['easing', 'durations', 'transitions', 'logo animation'], from: ['logo', 'brand'] },
	{ id: 'material', label: '3D & materials', ring: 2, dept: 'production', group: 'Image', params: ['materials', 'lighting', 'render style'], from: ['colour', 'photoDirection'] },
	{ id: 'sonic', label: 'Sonic identity', ring: 2, dept: 'production', group: 'Sound', params: ['audio logo', 'music direction', 'voiceover'], from: ['voice'] },

	/* ---- 3 · rules: material assembled into reusable kits ----- */
	{ id: 'guidelines', label: 'Brand guidelines', ring: 3, dept: 'identity', group: 'Space', params: ['rules', 'examples', 'misuse', 'asset links'], from: ['logo', 'colour', 'type', 'voice', 'photoDirection', 'illustration', 'shape', 'motion'] },
	{ id: 'designSystem', label: 'Design system', ring: 3, dept: 'digital', group: 'Space', params: ['tokens', 'components', 'states', 'docs'], from: ['colour', 'type', 'layout', 'icons', 'motion'] },
	{ id: 'ia', label: 'Sitemap & flows', ring: 3, dept: 'digital', group: 'Time', params: ['pages', 'hierarchy', 'navigation', 'user flows'], from: ['messaging', 'audience'] },
	{ id: 'templates', label: 'Templates', ring: 3, dept: 'identity', group: 'Space', params: ['social frames', 'ad frames', 'deck', 'documents'], from: ['logo', 'colour', 'type', 'layout'] },
	{ id: 'copyBank', label: 'Copy library', ring: 3, dept: 'copy', group: 'Library', params: ['headlines', 'CTAs', 'boilerplate', 'FAQs'], from: ['voice', 'messaging'] },
	{ id: 'assets', label: 'Asset library', ring: 3, dept: 'production', group: 'Library', params: ['photos', 'renders', 'footage', 'logo files', 'naming'], from: ['photoDirection', 'illustration', 'logo', 'material'] },
	{ id: 'campaign', label: 'Campaign idea', ring: 3, dept: 'strategy', group: 'Time', params: ['insight', 'big idea', 'line', 'key visual', 'flight dates'], from: ['messaging', 'contentStrategy', 'photoDirection', 'voice'] },
	{ id: 'calendar', label: 'Content calendar', ring: 3, dept: 'social', group: 'Time', params: ['dates', 'formats', 'pillars', 'owners'], from: ['contentStrategy'] },

	/* ---- 4 · form: what the customer actually sees ------------ */
	// web & product
	{ id: 'website', label: 'Website', ring: 4, dept: 'digital', group: 'Screen', params: ['pages', 'CMS', 'forms', 'speed', 'accessibility'], from: ['designSystem', 'ia', 'copyBank', 'assets'] },
	{ id: 'landing', label: 'Landing pages', ring: 4, dept: 'digital', group: 'Screen', params: ['offer', 'hero', 'proof', 'form', 'variants'], from: ['website', 'campaign'] },
	{ id: 'store', label: 'Online store', ring: 4, dept: 'digital', group: 'Screen', params: ['catalogue', 'product pages', 'checkout', 'payments'], from: ['website', 'productPhoto'] },
	{ id: 'webapp', label: 'Web app', ring: 4, dept: 'digital', group: 'Screen', params: ['flows', 'dashboards', 'auth', 'data'], from: ['designSystem', 'ia'] },
	{ id: 'mobileApp', label: 'Mobile app', ring: 4, dept: 'digital', group: 'Screen', params: ['screens', 'store listing', 'notifications'], from: ['designSystem', 'ia'] },
	{ id: 'email', label: 'Email', ring: 4, dept: 'digital', group: 'Feed', params: ['templates', 'sequences', 'subject lines'], from: ['templates', 'copyBank'] },
	// production
	{ id: 'productPhoto', label: 'Product photography', ring: 4, dept: 'production', group: 'Feed', params: ['packshots', 'angles', 'backdrops', 'retouching'], from: ['photoDirection'] },
	{ id: 'lifestylePhoto', label: 'Lifestyle photography', ring: 4, dept: 'production', group: 'Feed', params: ['locations', 'casting', 'shot list'], from: ['photoDirection', 'campaign'] },
	{ id: 'brandFilm', label: 'Brand film', ring: 4, dept: 'production', group: 'Feed', params: ['script', 'storyboard', 'shoot', 'edit', 'grade', 'music'], from: ['campaign', 'sonic', 'photoDirection'] },
	{ id: 'reels', label: 'Reels & short-form', ring: 4, dept: 'production', group: 'Feed', params: ['hook', 'length', 'captions', 'aspect', 'audio'], from: ['calendar', 'templates', 'motion'] },
	{ id: 'motionGfx', label: 'Motion graphics', ring: 4, dept: 'production', group: 'Feed', params: ['explainers', 'logo sting', 'UI animation'], from: ['motion', 'illustration'] },
	{ id: 'illustrations', label: 'Illustrations', ring: 4, dept: 'identity', group: 'Feed', params: ['hero art', 'spot art', 'editorial'], from: ['illustration'] },
	{ id: 'renders', label: '3D renders & AR', ring: 4, dept: 'production', group: 'Feed', params: ['product renders', 'scenes', 'configurators'], from: ['material'] },
	{ id: 'ugc', label: 'Creator content', ring: 4, dept: 'social', group: 'Feed', params: ['briefs', 'usage rights', 'whitelisting'], from: ['campaign', 'voice'] },
	// social
	{ id: 'posts', label: 'Posts & carousels', ring: 4, dept: 'social', group: 'Feed', params: ['grid', 'captions', 'hashtags', 'alt text'], from: ['templates', 'copyBank', 'calendar'] },
	{ id: 'profiles', label: 'Social profiles', ring: 4, dept: 'social', group: 'Feed', params: ['avatar', 'cover', 'bio', 'highlights'], from: ['logo', 'voice'] },
	// paid
	{ id: 'metaAds', label: 'Meta ads', ring: 4, dept: 'performance', group: 'Feed', params: ['formats', 'hooks', 'variants', 'primary text'], from: ['campaign', 'templates', 'reels'] },
	{ id: 'searchAds', label: 'Search ads', ring: 4, dept: 'performance', group: 'Feed', params: ['keywords', 'headlines', 'extensions'], from: ['copyBank', 'landing'] },
	{ id: 'displayAds', label: 'Display & video ads', ring: 4, dept: 'performance', group: 'Feed', params: ['sizes', 'frames', 'end cards'], from: ['campaign', 'motionGfx'] },
	{ id: 'ooh', label: 'Outdoor & press ads', ring: 4, dept: 'performance', group: 'In person', params: ['billboards', 'transit', 'press'], from: ['campaign', 'layout'] },
	// physical
	{ id: 'packaging', label: 'Packaging', ring: 4, dept: 'physical', group: 'In person', params: ['dieline', 'labels', 'legal text', 'finishes'], from: ['logo', 'colour', 'type', 'illustration'] },
	{ id: 'print', label: 'Print collateral', ring: 4, dept: 'physical', group: 'In person', params: ['cards', 'letterhead', 'brochures', 'menus'], from: ['templates'] },
	{ id: 'signage', label: 'Signage & space', ring: 4, dept: 'physical', group: 'In person', params: ['storefront', 'wayfinding', 'interiors'], from: ['logo', 'layout', 'colour'] },
	{ id: 'merch', label: 'Merch & uniforms', ring: 4, dept: 'physical', group: 'In person', params: ['apparel', 'totes', 'stickers'], from: ['logo', 'shape'] },
	{ id: 'eventKit', label: 'Event kit', ring: 4, dept: 'physical', group: 'In person', params: ['booth', 'lanyards', 'stage screens', 'badges'], from: ['templates', 'signage'] },
	// sales & pr
	{ id: 'deck', label: 'Pitch & sales decks', ring: 4, dept: 'sales', group: 'In person', params: ['narrative', 'slides', 'case studies'], from: ['templates', 'messaging'] },
	{ id: 'proposals', label: 'One-pagers & proposals', ring: 4, dept: 'sales', group: 'In person', params: ['offer', 'pricing', 'proof'], from: ['copyBank', 'templates'] },
	{ id: 'caseStudies', label: 'Case studies', ring: 4, dept: 'sales', group: 'In person', params: ['story', 'numbers', 'quotes'], from: ['copyBank', 'lifestylePhoto'] },
	{ id: 'pressKit', label: 'Press kit', ring: 4, dept: 'sales', group: 'In person', params: ['release', 'bios', 'logos', 'images'], from: ['assets', 'copyBank'] },

	/* ---- 5 · signal: getting it in front of people ------------ */
	{ id: 'seo', label: 'SEO & listings', ring: 5, dept: 'performance', group: 'Reach', params: ['keywords', 'technical', 'content', 'business profile'], from: ['website', 'contentStrategy'] },
	{ id: 'analytics', label: 'Analytics', ring: 5, dept: 'performance', group: 'Read', params: ['events', 'pixels', 'dashboards', 'attribution'], from: ['website', 'landing', 'store', 'webapp'] },
	{ id: 'cro', label: 'Conversion testing', ring: 5, dept: 'performance', group: 'Read', params: ['hypotheses', 'A/B tests', 'heatmaps'], from: ['analytics', 'landing'] },
	{ id: 'media', label: 'Media buying', ring: 5, dept: 'performance', group: 'Reach', params: ['budget', 'audiences', 'bids', 'placements'], from: ['metaAds', 'searchAds', 'displayAds', 'ooh'] },
	{ id: 'community', label: 'Community management', ring: 5, dept: 'social', group: 'Return', params: ['replies', 'DMs', 'moderation', 'reports'], from: ['posts', 'voice'] },
	{ id: 'creators', label: 'Creator partnerships', ring: 5, dept: 'social', group: 'Reach', params: ['shortlist', 'briefs', 'contracts'], from: ['ugc'] },
	{ id: 'crm', label: 'CRM & automation', ring: 5, dept: 'digital', group: 'Return', params: ['lists', 'segments', 'flows', 'lead scoring'], from: ['email', 'analytics'] },
	{ id: 'marketplaces', label: 'Marketplace listings', ring: 5, dept: 'performance', group: 'Reach', params: ['listings', 'A+ content', 'reviews'], from: ['productPhoto', 'copyBank', 'packaging'] },
	{ id: 'pr', label: 'PR & outreach', ring: 5, dept: 'sales', group: 'Reach', params: ['media list', 'pitches', 'coverage'], from: ['pressKit'] }
];

/* What gets measured flows back into what gets decided. Kept apart
   from `from` so the main graph stays a clean inward-to-outward tree. */
export const FEEDBACK = [
	{ from: 'analytics', to: 'research' },
	{ from: 'cro', to: 'messaging' },
	{ from: 'community', to: 'audience' },
	{ from: 'media', to: 'campaign' }
];
