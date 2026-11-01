<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The floating panel of a Skeleton Menu (step 1.15): portal + positioner + styled content. -->
<script lang="ts">
	import { Menu, Portal } from "@skeletonlabs/skeleton-svelte";
	import type { Snippet } from "svelte";

	interface Props {
		/** Minimum width (`min-w-*` step). */
		minWidth?: "44" | "48" | "56";
		children: Snippet;
	}

	const { minWidth = "48", children }: Props = $props();
	const WIDTH = { "44": "min-w-44", "48": "min-w-48", "56": "min-w-56" } as const;
</script>

<Portal>
	<Menu.Positioner>
		<Menu.Content
			class="z-50 {WIDTH[minWidth]} card preset-filled-surface-100-900 p-2 shadow-xl"
		>
			{@render children()}
		</Menu.Content>
	</Menu.Positioner>
</Portal>
