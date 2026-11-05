import { redirect } from '@sveltejs/kit';

/** The studio home was staged here; it is `/` now. Old links keep working. */
export function load() {
	redirect(308, '/');
}
