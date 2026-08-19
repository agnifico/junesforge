<script lang="ts">
	/**
	 * Propsize's one generic popup: a title, an optional line of body text, and
	 * a row of buttons. Anything that needs to ask a small yes/no or
	 * pick-one-of-a-few question — or just notify with an OK — should call
	 * editorStore.prompt(...) rather than growing a bespoke modal for it.
	 */
	import { editorStore } from '$lib/propsize/core/editor.svelte';

	$effect(() => {
		if (!editorStore.activePrompt) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') editorStore.resolvePrompt(null);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

{#if editorStore.activePrompt}
	{@const p = editorStore.activePrompt}
	<div
		class="ps-modal-backdrop show"
		onclick={(e) => {
			if (e.target === e.currentTarget) editorStore.resolvePrompt(null);
		}}
	>
		<div class="ps-modal prompt-modal">
			<div class="ps-modal-head">
				<h2>{p.title}</h2>
			</div>
			{#if p.body}
				<div class="ps-modal-body"><p class="prompt-body">{p.body}</p></div>
			{/if}
			<div class="ps-modal-foot">
				{#each p.choices as choice (choice.value)}
					<button
						type="button"
						class="btn"
						class:primary={choice.primary}
						class:danger={choice.danger}
						onclick={() => editorStore.resolvePrompt(choice.value)}
					>
						{choice.label}
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}
