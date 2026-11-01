<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A colour picker the size of a small button, with hover feedback (step 11.10). -->
<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";

	interface Props extends Omit<HTMLInputAttributes, "type" | "value"> {
		value: string;
	}

	let { value = $bindable(), ...rest }: Props = $props();
</script>

<input
	type="color"
	class="input h-9 w-14 cursor-pointer p-1 hover:ring-2 hover:ring-primary-300"
	bind:value
	{...rest}
/>
