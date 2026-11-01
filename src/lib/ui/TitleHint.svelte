<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A bold line with a muted line under it (step 1.15): option labels, list entries, section
     links. Inline markup, so it fits inside labels, links and buttons. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import Hint from "./Hint.svelte";

	interface Props {
		title: string;
		/** Cut a long title with an ellipsis instead of wrapping. */
		truncate?: boolean;
		/** Monospace muted line (barcodes, card numbers). */
		mono?: boolean;
		class?: string;
		/** The muted line. */
		children: Snippet;
	}

	const {
		title,
		truncate = false,
		mono = false,
		class: className = "",
		children,
	}: Props = $props();
</script>

<span class={className}>
	<span class="block font-semibold {truncate ? 'truncate' : ''}">{title}</span>
	<Hint as="span" {mono} class="block">{@render children()}</Hint>
</span>
