<script lang="ts">
	import { round3 } from '$lib/propsize/core/utils';
	import type { Axis } from '$lib/propsize/core/editor.svelte';

	const AXES = ['x', 'y', 'z'] as const;

	let {
		label,
		triple,
		step = 0.1,
		onchange,
		locks,
		onLockToggle
	}: {
		label: string;
		triple: { x: number; y: number; z: number };
		step?: number;
		onchange: (axis: Axis, v: number) => void;
		locks?: { x: boolean; y: boolean; z: boolean };
		onLockToggle?: (axis: Axis) => void;
	} = $props();

	const uid = $props.id();
</script>

<div class="field">
	<div class="field-label"><span class="fname">{label}</span></div>
	<div class="row3">
		{#each AXES as axis (axis)}
			<div class="minifield">
				<label for="{uid}-{axis}">
					{axis.toUpperCase()}
					{#if locks && onLockToggle}
						<button
							type="button"
							class="axis-link"
							class:on={locks[axis]}
							title={locks[axis]
								? `Unlink ${axis.toUpperCase()} from the other locked axes`
								: `Link ${axis.toUpperCase()} — lock two or three axes to scale them together`}
							onclick={() => onLockToggle(axis)}
						></button>
					{/if}
				</label>
				<input
					id="{uid}-{axis}"
					type="number"
					{step}
					value={round3(triple[axis])}
					oninput={(e) => onchange(axis, parseFloat((e.currentTarget as HTMLInputElement).value) || 0)}
				/>
			</div>
		{/each}
	</div>
</div>
