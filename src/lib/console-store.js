import { writable } from 'svelte/store';

// The ID of the currently visible screen
export const currentScreenId = writable('menu');

// The index of the highlighted item in the main menu
export const menuHighlightedIndex = writable(0);

// The index of the highlighted link on the Projects screen
export const projectsLinkIndex = writable(0);

// Controls the visibility of the background video
export const isVideoBackgroundOn = writable(true);

// You can add more state variables here for other screens as needed
// For example, for the projects screen:
// export const projectsHighlightedIndex = writable(0);
