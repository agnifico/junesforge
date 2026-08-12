<script lang="ts">
	/**
	 * Save/load, in one popover.
	 *
	 * The two rows are deliberately separate systems. The autosave runs on its
	 * own and is only ever a recovery path — "Load last" reaches for it, not for
	 * whatever the user saved by hand. The numbered slots are theirs; nothing
	 * automatic ever writes to them.
	 */
	import { onDestroy } from 'svelte';
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { autosaveInfo, loadAutosave, loadSlot, saveSlot, slotInfo, SLOT_COUNT } from '$lib/propsize/core/serialize';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';

	let { engine }: { engine: SceneEngine } = $props();

	// localStorage isn't reactive, so `version` (bumped on save) and `now`
	// (ticking) are read purely to drive these re-reads — that's what keeps
	// "36s ago" honest while the menu is open.
	let now = $state(Date.now());
	let version = $state(0);
	let auto = $derived.by(() => {
		void version;
		void now;
		return autosaveInfo();
	});
	let slots = $derived.by(() => {
		void version;
		return Array.from({ length: SLOT_COUNT }, (_, i) => ({ n: i + 1, info: slotInfo(i + 1) }));
	});

	const timer = setInterval(() => (now = Date.now()), 1000);
	onDestroy(() => clearInterval(timer));

	function ago(ts: number) {
		if (!ts) return 'earlier';
		const s = Math.max(0, Math.round((now - ts) / 1000));
		if (s < 60) return `${s}s ago`;
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		return `${Math.floor(s / 86400)}d ago`;
	}

	/** A loaded document is a different document — its ids can collide with what
	 *  is on screen, so the scene is rebuilt rather than reconciled. */
	function afterLoad(ok: boolean, label: string) {
		if (!ok) {
			editorStore.toast(`Nothing saved in ${label}`);
			return;
		}
		engine.resetSceneObjects();
		editorStore.toast(`${label} loaded`);
		editorStore.sessionOpen = false;
	}

	function onSave(n: number) {
		const existing = slotInfo(n);
		if (saveSlot(n)) {
			version++;
			editorStore.toast(existing ? `Slot ${n} overwritten` : `Saved to slot ${n}`);
		} else {
			editorStore.toast('Save failed — try Export instead');
		}
	}
</script>

<div class="ps-pop session-pop">
	<div class="pop-sec">
		<div class="pop-head">
			<span>Autosave</span>
			{#if auto}<span class="dot ok"></span>{/if}
		</div>
		<div class="pop-row">
			<span class="pop-meta">
				{#if auto}
					{ago(auto.savedAt)} · {auto.nodes} object{auto.nodes === 1 ? '' : 's'}
				{:else}
					nothing captured yet
				{/if}
			</span>
			<button class="btn sm" disabled={!auto} onclick={() => afterLoad(loadAutosave(), 'Autosave')}>
				Load last
			</button>
		</div>
		<div class="pop-note">Runs on its own after every edit. Never overwrites your slots.</div>
	</div>

	<div class="pop-sec">
		<div class="pop-head"><span>Your sessions</span></div>

		<div class="pop-row">
			<span class="pop-label">Save session</span>
			{#each slots as slot (slot.n)}
				<button
					class="btn sm slot"
					class:filled={!!slot.info}
					title={slot.info ? `Overwrite slot ${slot.n} (saved ${ago(slot.info.savedAt)})` : `Save to slot ${slot.n}`}
					onclick={() => onSave(slot.n)}
				>
					S{slot.n}
				</button>
			{/each}
		</div>

		<div class="pop-row">
			<span class="pop-label">Load session</span>
			{#each slots as slot (slot.n)}
				<button
					class="btn sm slot"
					class:filled={!!slot.info}
					disabled={!slot.info}
					title={slot.info ? `${slot.info.nodes} objects, saved ${ago(slot.info.savedAt)}` : 'Empty'}
					onclick={() => afterLoad(loadSlot(slot.n), `Slot ${slot.n}`)}
				>
					{slot.info ? `S${slot.n}` : '––'}
				</button>
			{/each}
		</div>

		<div class="pop-note">
			{#if slots.some((s) => s.info)}
				{#each slots as slot (slot.n)}
					{#if slot.info}
						{@const info = slot.info}
						<div>S{slot.n} · {ago(info.savedAt)} · {info.nodes} objects</div>
					{/if}
				{/each}
			{:else}
				Both slots are empty. Saving writes the whole scene into that slot.
			{/if}
		</div>
	</div>
</div>
