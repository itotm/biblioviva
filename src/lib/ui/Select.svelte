<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Native select with the Skeleton look (step 1.15); `auto` keeps it as wide as its content
     (toolbar filters). Options come as children; `bind:value` works. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLSelectAttributes } from "svelte/elements";

	interface Props extends HTMLSelectAttributes {
		auto?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		auto = false,
		class: className = "",
		value = $bindable(),
		children,
		...rest
	}: Props = $props();
	const classes = $derived(["select", auto ? "w-auto" : "", className].filter(Boolean).join(" "));
</script>

<select class={classes} bind:value {...rest}>{@render children()}</select>
