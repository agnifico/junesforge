<script lang="ts">
	import { round3 } from '$lib/propsize/core/utils';

	let {
		label,
		value,
		min,
		max,
		step,
		int = false,
		unit = '',
		mixed = false,
		oninput
	}: {
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		int?: boolean;
		unit?: string;
		mixed?: boolean;
		oninput: (v: number) => void;
	} = $props();

	// The slider's own step is for dragging comfortably; it shouldn't cap how
	// precise a value can be. Typing into the box is the exact path, so the
	// track gets a fine step and min/max become soft limits — a typed value may
	// sit past the end of the track, the way parametric editors usually work.
	let sliderStep = $derived(int ? Math.max(1, Math.round(step)) : Math.min(step, 0.01));

	// While the box has focus its raw text wins, so partial input like "0." or
	// "1.20" isn't reformatted from under the cursor mid-keystroke.
	let typing = $state<string | null>(null);
	let shown = $derived(typing ?? String(int ? Math.round(value) : round3(value)));

	function commit(raw: string, clampToMin: boolean) {
		if (raw.trim() === '') return;
		const v = int ? parseInt(raw, 10) : parseFloat(raw);
		if (!Number.isFinite(v)) return;
		// Mid-typing we only block values that would break the geometry
		// (negative sizes, too few segments). The full clamp waits for commit,
		// so typing "0.5" isn't snapped to the minimum at the "0" keystroke.
		oninput(clampToMin || int ? Math.max(min, v) : Math.max(0, v));
	}

	function onSlider(e: Event) {
		typing = null;
		const raw = (e.currentTarget as HTMLInputElement).value;
		oninput(int ? parseInt(raw, 10) : parseFloat(raw));
	}
	function onNumberInput(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value;
		typing = raw;
		commit(raw, false);
	}
	function onNumberBlur(e: Event) {
		commit((e.currentTarget as HTMLInputElement).value, true);
		typing = null;
	}
</script>

<div class="field">
	<div class="field-label">
		<span class="fname">{label}</span>
		{#if mixed}
			<span class="fval">mixed</span>
		{:else}
			<span class="fnum-wrap">
				<input
					class="fnum"
					type="number"
					step={int ? 1 : 'any'}
					value={shown}
					oninput={onNumberInput}
					onblur={onNumberBlur}
					onkeydown={(e) => {
						if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
					}}
				/>{#if unit}<span class="funit">{unit}</span>{/if}
			</span>
		{/if}
	</div>
	<input type="range" {min} {max} step={sliderStep} {value} oninput={onSlider} />
</div>
