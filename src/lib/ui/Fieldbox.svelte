<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A bordered group inside a card (step 11.8): one Z39.50 catalogue, the properties of the box
     chosen in the template designer. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		children: Snippet;
	}

	const { children, ...rest }: Props = $props();
</script>

<section class="space-y-3 rounded-container border border-surface-200 p-3" {...rest}>
	{@render children()}
</section>
