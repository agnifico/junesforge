import { redirect } from '@sveltejs/kit';

/**
 * The deck moved to `/` when it went into production. This keeps any link or
 * bookmark from the staging period working instead of 404-ing; 308 so the move
 * is recorded as permanent.
 */
export function load() {
	redirect(308, '/');
}
