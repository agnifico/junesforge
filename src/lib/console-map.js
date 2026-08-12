import Menu from './screens/Menu.svelte';
import GraphicDesign from './screens/GraphicDesign.svelte';
import WebDesign from './screens/WebDesign.svelte';
import Projects from './screens/Projects.svelte';
import ForgeBlueprints from './screens/projects/ForgeBlueprints.svelte'; // New import
import IsometricCities from './screens/projects/IsometricCities.svelte';
import TheMuses from "./screens/projects/TheMuses.svelte";
import Arboreum from "./screens/projects/Arboreum.svelte";
import InstaHelpRebrand from './screens/projects/InstaHelpRebrand.svelte';

import { currentScreenId, menuHighlightedIndex, projectsLinkIndex } from './console-store.js';
import { get } from 'svelte/store';

// --- Data for Menus ---

export const menuItems = [
    { id: 'graphic-design', label: 'Graphic Design' },
    { id: 'web-design', label: 'Web Dev' },
    { id: 'projects', label: 'Projects' },
];

export const projectItems = [
    { title: 'Forge Blueprints', screenId: 'forge-blueprints' }, // Updated project
    { title: 'Isometric Cities', screenId: 'isometric-cities' },
    { title: 'The Muses', screenId: 'the-muses' },
    { title: 'Arboreum', screenId: 'arboreum' },
    { title: 'Insta Help Rebrand', screenId: 'insta-help-rebrand' },
];

// --- Navigation Map ---

export const consoleMap = {
    'menu': {
        component: Menu,
        controls: {
            up: () => {
                menuHighlightedIndex.update(n => (n - 1 + menuItems.length) % menuItems.length);
            },
            down: () => {
                menuHighlightedIndex.update(n => (n + 1) % menuItems.length);
            },
            a: () => {
                const selectedIndex = get(menuHighlightedIndex);
                const selectedScreenId = menuItems[selectedIndex].id;
                currentScreenId.set(selectedScreenId);
            },
            b: () => { /* No action */ }
        }
    },
    'graphic-design': {
        component: GraphicDesign,
        controls: {
            b: () => currentScreenId.set('menu')
        }
    },
    'web-design': {
        component: WebDesign,
        controls: {
            b: () => currentScreenId.set('menu')
        }
    },
    'projects': {
        component: Projects,
        controls: {
            up: () => {
                projectsLinkIndex.update(n => (n - 1 + projectItems.length) % projectItems.length);
            },
            down: () => {
                projectsLinkIndex.update(n => (n + 1) % projectItems.length);
            },
            a: () => {
                const selectedIndex = get(projectsLinkIndex);
                const selectedScreenId = projectItems[selectedIndex].screenId;
                currentScreenId.set(selectedScreenId);
            },
            b: () => currentScreenId.set('menu')
        }
    },
    'forge-blueprints': {
        component: ForgeBlueprints,
        controls: {
            b: () => currentScreenId.set('projects')
        }
    },
    'isometric-cities': {
        component: IsometricCities,
        controls: {
            b: () => currentScreenId.set('projects')
        }
    },
    'the-muses': {
        component: TheMuses,
        controls: {
            b: () => currentScreenId.set('projects')
        }
    },
    'arboreum': {
        component: Arboreum,
        controls: {
            b: () => currentScreenId.set('projects')
        }
    },
    'insta-help-rebrand': {
        component: InstaHelpRebrand,
        controls: {
            b: () => currentScreenId.set('projects')
        }
    },
};