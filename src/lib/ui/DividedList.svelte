<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A list with a thin line between the entries (step 1.15): open loans, list entries, the
     session of the desk. `ordered` renders an <ol>. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		ordered?: boolean;
		class?: string;
		children: Snippet;
	}

	const { ordered = false, class: className = "", children, ...rest }: Props = $props();
	const classes = $derived(["divide-y divide-surface-200", className].filter(Boolean).join(" "));
</script>

{#if ordered}
	<ol class={classes} {...rest}>{@render children()}</ol>
{:else}
	<ul class={classes} {...rest}>{@render children()}</ul>
{/if}
