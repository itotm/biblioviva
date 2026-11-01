<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Text input (step 1.15): the Skeleton `input` look, monospace option, every attribute passes
     through (remote-form spreads included); `bind:value` works. -->
<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";

	interface Props extends HTMLInputAttributes {
		mono?: boolean;
		class?: string;
	}

	let { mono = false, class: className = "", value = $bindable(), ...rest }: Props = $props();
	const classes = $derived(
		["input", mono ? "font-mono" : "", className].filter(Boolean).join(" "),
	);
</script>

<input class={classes} bind:value {...rest} />
