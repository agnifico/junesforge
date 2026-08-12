<script lang="ts">
	import { editorStore } from '$lib/propsize/core/editor.svelte';
</script>

<div class="toast" class:show={!!editorStore.toastMsg} class:actionable={!!editorStore.toastAction}>
	<span>{editorStore.toastMsg}</span>
	{#if editorStore.toastAction}
		<button
			class="toast-action"
			onclick={() => {
				const action = editorStore.toastAction;
				editorStore.dismissToast();
				action?.run();
			}}
		>
			{editorStore.toastAction.label}
		</button>
	{/if}
</div>
