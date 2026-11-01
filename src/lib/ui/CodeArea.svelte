<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A text area for code (SQL, JSON): monospace, no spell check; `small` for the secondary parts. -->
<script lang="ts">
	import type { HTMLTextareaAttributes } from "svelte/elements";

	interface Props extends HTMLTextareaAttributes {
		small?: boolean;
		value?: string | null;
	}

	let { small = false, value = $bindable(), ...rest }: Props = $props();
</script>

<textarea
	class={["textarea font-mono", small ? "text-xs" : "text-sm"]}
	spellcheck="false"
	bind:value
	{...rest}></textarea>
