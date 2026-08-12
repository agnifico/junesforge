import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EntryGenerator, PageServerLoad } from './$types';

const PRESETS: Record<string, { title: string; description: string }> = {
	'starter-crate': {
		title: 'Starter crate',
		description: 'A simple wooden crate built from parametric primitives — a good first scene to remix.'
	}
};

// Tells the prerenderer which /propsize/[slug] pages actually exist, so each
// showcase model gets its own real, crawlable static page instead of the
// route being skipped entirely. Reads the same index the marquee stage
// pulls from, so adding a model to static/showcase/models/ is enough to
// get it a page here (falling back to generic copy until PRESETS — or a
// real tutorial — is written for it). Lives in +page.server.ts (not
// +page.ts) specifically so node:fs never has a chance to end up in the
// client bundle.
export const entries: EntryGenerator = () => {
	const indexPath = join(process.cwd(), 'static/showcase/models/index.json');
	const models: { slug: string }[] = JSON.parse(readFileSync(indexPath, 'utf-8'));
	return [...models.map((m) => ({ slug: m.slug })), ...Object.keys(PRESETS).map((slug) => ({ slug }))];
};

export const load: PageServerLoad = ({ params }) => {
	const preset = PRESETS[params.slug];
	if (!preset) {
		return {
			title: params.slug.replace(/-/g, ' '),
			description: 'Preset scene — wire up URL decoding to load the document here.'
		};
	}
	return preset;
};
