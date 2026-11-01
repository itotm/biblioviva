<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A filter of a list toolbar: a select as wide as its content, named by `label` (read by screen
     readers, not shown), whose first option "<label>: <all>" means no filter. The choices come as
     children; `bind:value` works. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import Select from "./Select.svelte";

	interface Props {
		label: string;
		/** The word of the empty choice ("tutti", "tutte"); without it there is no empty choice. */
		all?: string;
		value: string;
		onchange?: () => void;
		"data-testid"?: string;
		children: Snippet;
	}

	let { label, all, value = $bindable(), onchange, children, ...rest }: Props = $props();
</script>

<label class="inline-block">
	<span class="sr-only">{label}</span>
	<Select auto bind:value aria-label={label} {onchange} {...rest}>
		{#if all !== undefined}<option value="">{label}: {all}</option>{/if}
		{@render children()}
	</Select>
</label>
