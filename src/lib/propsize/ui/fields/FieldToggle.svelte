<script lang="ts">
	let {
		label,
		value,
		mixed = false,
		onchange
	}: { label: string; value: boolean; mixed?: boolean; onchange: (v: boolean) => void } = $props();

	function toggle() {
		onchange(!value);
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	}
</script>

<div class="toggle-row">
	<span class="fname">{label}</span>
	<div
		class="switch"
		class:on={value}
		class:mixed
		role="switch"
		aria-checked={value}
		tabindex="0"
		onclick={toggle}
		onkeydown={onKeydown}
	>
		<div class="knob"></div>
	</div>
</div>
