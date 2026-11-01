<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Checkbox with its label on the right (step 1.15); `bind:checked` works, spreads too. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";

	interface Props extends HTMLInputAttributes {
		/** Smaller text, right-aligned in a toolbar (`ml-auto`). */
		compact?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		compact = false,
		class: className = "",
		checked = $bindable(),
		children,
		...rest
	}: Props = $props();
	const classes = $derived(
		["flex items-center gap-2", compact ? "ml-auto text-sm" : "", className]
			.filter(Boolean)
			.join(" "),
	);
</script>

<label class={classes}>
	<input type="checkbox" class="checkbox" bind:checked {...rest} />
	<span>{@render children()}</span>
</label>
