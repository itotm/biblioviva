<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A code shown in large monospace type: a barcode example, a segnatura computed for a copy.
     `p` by default, `dd` inside a description list. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: "p" | "dd";
		children: Snippet;
	}

	const { as = "p", children, ...rest }: Props = $props();
</script>

<svelte:element this={as} class="font-mono text-lg font-semibold" {...rest}
	>{@render children()}</svelte:element
>
