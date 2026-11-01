<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A bulleted list inside a message or a panel (problems, warnings); `muted` for secondary lists
     under a summary. Items come as children (`<li>`). -->
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		muted?: boolean;
		class?: string;
		children: Snippet;
	}

	const { muted = false, class: className = "", children }: Props = $props();
	const classes = $derived(
		["list-inside list-disc", muted ? "mt-1 opacity-80" : "", className]
			.filter(Boolean)
			.join(" "),
	);
</script>

<ul class={classes}>{@render children()}</ul>
