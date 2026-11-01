<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The rounded square that holds a large icon (sidebar items, census classes, dashboard tiles,
     section links, the page icon): the colours come from the caller (9.13, round 2), the size too
     when it is not the usual 48 px (`size="size-10 sm:size-12"`). -->
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		/** Tailwind size classes of the square. */
		size?: string;
		class?: string;
		"data-testid"?: string;
		children: Snippet;
	}

	const { size = "size-12", class: className = "", children, ...rest }: Props = $props();
</script>

<span
	class="flex {size} shrink-0 items-center justify-center rounded-container {className}"
	{...rest}>{@render children()}</span
>
