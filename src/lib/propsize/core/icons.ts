export const ICONS = {
	group: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke-dasharray="2.5 2.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg>`,
	box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z"/><path d="M4 7.5 L12 12 L20 7.5 M12 12 L12 21"/></svg>`,
	sphere: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="8.5" ry="3.2"/><path d="M12 3.5 V20.5"/></svg>`,
	icosa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.5 L21 8.5 L18 19.5 L6 19.5 L3 8.5 Z"/><path d="M12 2.5 L12 12 M3 8.5 L12 12 L21 8.5 M6 19.5 L12 12 L18 19.5"/></svg>`,
	octa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.5 L21 12 L12 21.5 L3 12 Z"/><path d="M3 12 L12 9 L21 12 M12 9 L12 21.5"/></svg>`,
	dodeca: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.5 L19.5 8 L17 17 L7 17 L4.5 8 Z"/><path d="M12 2.5 L12 8 M19.5 8 L12 8 L4.5 8 M12 8 L7 17 M12 8 L17 17"/></svg>`,
	tetra: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3 L21 19.5 L3 19.5 Z"/><path d="M12 3 L12 19.5 M12 3 L7.2 19.5 M12 3 L16.8 19.5"/></svg>`,
	torus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="9" ry="5.5"/><ellipse cx="12" cy="12" rx="3.4" ry="2"/></svg>`,
	torusKnot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8c0-3 3-4.5 6-3s3 5-1 6-6 3-3 6 7 1.5 8-1.5-1-6-4-6.5"/></svg>`,
	cylinder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6 V18 A8 3 0 0 0 20 18 V6"/></svg>`,
	cone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="18" rx="8" ry="3"/><path d="M12 3 L4 18 M12 3 L20 18"/></svg>`,
	plane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 8 L16 5 L20 15 L8 18 Z"/><path d="M4 8 L20 15 M16 5 L8 18"/></svg>`,
	// The flat shapes are drawn face-on, so they read as flat — and so Ring
	// can't be mistaken for Torus, which is the same two ellipses in perspective.
	circle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/></svg>`,
	ring: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>`,
	capsule: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="3" width="8" height="18" rx="4"/></svg>`,
	// A turned silhouette either side of its axis of revolution.
	lathe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9.5 3C9 6 7 8 7 11.5S9 17 9 21"/><path d="M14.5 3C15 6 17 8 17 11.5S15 17 15 21"/><path d="M9 21h6"/></svg>`,
	imported: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>`
} as const;

export const TOOLBAR_ICONS = {
	groupBtn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="8.5" y="13" width="7" height="7" rx="1"/></svg>`,
	ungroupBtn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6 H21 M6 10 V21" stroke-dasharray="2 2"/></svg>`,
	dupBtn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M4 16 V5.5 A1.5 1.5 0 0 1 5.5 4 H16"/></svg>`,
	delBtn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7 H19 M9 7 V4.5 A1 1 0 0 1 10 3.5 H14 A1 1 0 0 1 15 4.5 V7 M7 7 L8 20.5 A1 1 0 0 0 9 21.5 H15 A1 1 0 0 0 16 20.5 L17 7"/></svg>`,
	chev: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6 L15 12 L9 18"/></svg>`,
	settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.08A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`,
	session: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>`,
	eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.6"/></svg>`,
	eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 5.3A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.3M6.7 6.7C4 8.6 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4.2-.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`,
	grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /><rect x="3" y="3" width="18" height="18" rx="1"/></svg>`,
	wire: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.5 L21 8.5 L18 19.5 L6 19.5 L3 8.5 Z M12 2.5 L12 12 M3 8.5 L12 12 L21 8.5 M6 19.5 L12 12 L18 19.5"/></svg>`,
	focus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/><circle cx="12" cy="12" r="3"/></svg>`,
	bg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18Z"/></svg>`,
	close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6L18 18M18 6L6 18"/></svg>`
} as const;
