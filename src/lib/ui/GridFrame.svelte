<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The card around a data grid (step 1.15): rounded, clipped to its corners. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		children: Snippet;
	}

	const { children, ...rest }: Props = $props();
</script>

<div class="overflow-hidden card" {...rest}>{@render children()}</div>
