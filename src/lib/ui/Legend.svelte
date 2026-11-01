<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The title of a group of choices (a `<fieldset>`), in the look of a field's label (step 1.15). -->
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();
</script>

<legend class="mb-2 label-text">{@render children()}</legend>
