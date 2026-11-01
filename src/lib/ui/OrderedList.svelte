<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Numbered steps in running text (step 1.15). -->
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		class?: string;
		children: Snippet;
	}

	const { class: className = "", children }: Props = $props();
</script>

<ol class={["list-inside list-decimal space-y-1 text-sm", className].filter(Boolean).join(" ")}>
	{@render children()}
</ol>
