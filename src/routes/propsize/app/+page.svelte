<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/stores';
	import '$lib/propsize/ui/theme.css';
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { libraryStore } from '$lib/propsize/library/library-store.svelte';
	import { seedStarterScene } from '$lib/propsize/core/seed';
	import { scheduleAutosave, serializeProject, loadProjectFromJSON } from '$lib/propsize/core/serialize';
	import { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';
	import Topbar from '$lib/propsize/ui/Topbar.svelte';
	import LeftPanel from '$lib/propsize/ui/LeftPanel.svelte';
	import Viewport from '$lib/propsize/ui/Viewport.svelte';
	import Inspector from '$lib/propsize/ui/Inspector.svelte';
	import HelpOverlay from '$lib/propsize/ui/HelpOverlay.svelte';
	import ExportModal from '$lib/propsize/ui/ExportModal.svelte';
	import Toast from '$lib/propsize/ui/Toast.svelte';
	import PromptModal from '$lib/propsize/ui/PromptModal.svelte';

	const engine = new SceneEngine();

	// The Library tab needs more room than the tree, and a collapsed panel
	// gives its width back to the viewport.
	let leftWidth = $derived(
		!editorStore.leftPanelOpen ? '0px' : editorStore.leftTab === 'library' ? '340px' : '250px'
	);
	let rightWidth = $derived(editorStore.rightPanelOpen ? '320px' : '0px');

	/**
	 * The home page's hero/marquee link here with `?sample=<slug>` to open one
	 * of the bundled showcase models pre-loaded — same documents that drive
	 * the propsize-stage previews there, fetched from the static copy so the
	 * editor doesn't need its own bundled duplicate.
	 */
	async function loadSampleFromUrl(): Promise<boolean> {
		const slug = $page.url.searchParams.get('sample');
		if (!slug) return false;
		try {
			const res = await fetch(`/showcase/models/${slug}.json`);
			if (!res.ok) return false;
			const json = await res.text();
			const ok = loadProjectFromJSON(json);
			if (ok) {
				const name = (JSON.parse(json)?.name as string | undefined) ?? slug;
				editorStore.toast(`Loaded ${name} from the sample library`);
			}
			return ok;
		} catch (e) {
			console.error('Propsize: could not load sample', slug, e);
			return false;
		}
	}

	onMount(() => {
		editorStore.loadRecentColors();
		// Preferences before the first render of the scene, so the saved
		// background colour doesn't flash the default first.
		editorStore.loadSettings();
		engine.setBgColor(editorStore.bgColor);
		engine.setLightIntensity(editorStore.lightIntensity);
		engine.setLightColor(editorStore.lightColor);
		engine.setAmbientIntensity(editorStore.ambientIntensity);
		engine.setLightAngle(editorStore.lightAzimuth, editorStore.lightElevation);
		(async () => {
			const loadedSample = await loadSampleFromUrl();
			if (!loadedSample) seedStarterScene();
			engine.requestSync();
		})();
	});

	// Library models can't be re-read without folder permission, so a restored
	// document may reference models we can't draw yet. Try a silent reconnect
	// first; whatever's still missing after that gets surfaced as a prompt
	// (see the banner in Library.svelte) rather than silent placeholder boxes.
	$effect(() => {
		const missing = engine.missingAssetIds();
		if (!missing.length) {
			libraryStore.missingCount = 0;
			return;
		}
		untrack(async () => {
			if (!libraryStore.connected) await libraryStore.trySilentReconnect();
			if (libraryStore.connected) await libraryStore.restoreMissing(engine);
			else libraryStore.refreshMissingCount(engine);
			const n = libraryStore.missingCount;
			if (n > 0) {
				editorStore.toast(
					`${n} model${n === 1 ? ' needs' : 's need'} the folder reconnected — open Model library`
				);
			}
		});
	});

	// Debounced autosave: serializeProject() walks the whole document, so
	// reading it here tracks every node/material as an effect dependency —
	// any edit anywhere reschedules the save.
	$effect(() => {
		serializeProject();
		scheduleAutosave();
	});
</script>

<svelte:head>
	<title>Propsize Editor</title>
</svelte:head>

<div class="propsize-shell">
	<div class="propsize-app" style="--left-w:{leftWidth}; --right-w:{rightWidth};">
		<Topbar {engine} />
		{#if editorStore.leftPanelOpen}
			<LeftPanel {engine} />
		{/if}
		<Viewport {engine} />
		{#if editorStore.rightPanelOpen}
			<Inspector {engine} />
		{/if}
	</div>
	<HelpOverlay />
	<ExportModal />
	<Toast />
	<PromptModal />
</div>

<style>
	.propsize-shell {
		margin: 0;
		padding: 0;
	}
</style>
