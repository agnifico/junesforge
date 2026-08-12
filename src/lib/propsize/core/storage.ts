/**
 * localStorage access, with one thing worth centralising: the app used to be
 * called Propsmith and stored everything under a `propsmith:` prefix.
 *
 * Renaming the keys outright would have silently emptied anyone's saved
 * sessions, slots and preferences — the data would still be sitting in the
 * browser under names nothing reads any more. So writes go to the new prefix
 * and reads fall back to the old one, which migrates each key the first time
 * it's written and needs no migration step to have run at the right moment.
 *
 * Once no browser in use still holds `propsmith:` keys, LEGACY_PREFIX and the
 * fallback in readLocal can go.
 */

const PREFIX = 'propsize:';
const LEGACY_PREFIX = 'propsmith:';

export function readLocal(key: string): string | null {
	try {
		const current = localStorage.getItem(key);
		if (current !== null) return current;
		// Same key under the pre-rename name.
		if (key.startsWith(PREFIX)) {
			return localStorage.getItem(LEGACY_PREFIX + key.slice(PREFIX.length));
		}
		return null;
	} catch {
		// Private browsing and blocked-storage modes throw on access.
		return null;
	}
}

export function writeLocal(key: string, value: string): boolean {
	try {
		localStorage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}
