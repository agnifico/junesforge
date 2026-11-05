import { redirect } from '@sveltejs/kit';

/** Staged here before it went live at `/agencies`. Old links keep working. */
export function load() {
	redirect(308, '/agencies');
}
