<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A short line that opens a detail list (warnings, lists of files): a native `<details>` with
     small text and a summary that underlines on hover. -->
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		summary: string;
		"data-testid"?: string;
		children: Snippet;
	}

	const { summary, children, ...rest }: Props = $props();
</script>

<details class="text-sm" {...rest}>
	<summary class="cursor-pointer hover:underline">{summary}</summary>
	{@render children()}
</details>
