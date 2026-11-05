import { redirect } from '@sveltejs/kit';

/**
 * The old deck was staged here before it went to `/`; it now lives at
 * /legacy2. This keeps old links and bookmarks landing on the live home
 * instead of 404-ing; 308 so the move is recorded as permanent.
 */
export function load() {
	redirect(308, '/');
}
