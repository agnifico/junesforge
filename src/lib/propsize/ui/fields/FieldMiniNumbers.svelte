<script lang="ts">
	import { round3 } from '$lib/propsize/core/utils';

	const AXES = ['x', 'y', 'z'] as const;

	let {
		label,
		triple,
		step = 0.1,
		onchange
	}: {
		label: string;
		triple: { x: number; y: number; z: number };
		step?: number;
		onchange: (axis: 'x' | 'y' | 'z', v: number) => void;
	} = $props();

	const uid = $props.id();
</script>

<div class="field">
	<div class="field-label"><span class="fname">{label}</span></div>
	<div class="row3">
		{#each AXES as axis (axis)}
			<div class="minifield">
				<label for="{uid}-{axis}">{axis.toUpperCase()}</label>
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
