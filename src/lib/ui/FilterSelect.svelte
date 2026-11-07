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

<!-- never wider than the window: a long choice is cut in the closed select, whole in its list
     (WCAG 1.4.10) -->
<label class="inline-block max-w-full">
	<span class="sr-only">{label}</span>
	<Select auto class="max-w-full" bind:value aria-label={label} {onchange} {...rest}>
		{#if all !== undefined}<option value="">{label}: {all}</option>{/if}
		{@render children()}
	</Select>
</label>
