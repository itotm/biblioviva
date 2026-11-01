<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Plain HTML table for short lists (step 1.15): full width, small text, left-aligned padded
     headers; rows come as children (`<thead>`/`<tbody>`). -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLTableAttributes } from "svelte/elements";

	interface Props extends HTMLTableAttributes {
		/** Rows of form fields: a line between rows, padded cells aligned to the top. */
		form?: boolean;
		class?: string;
		children: Snippet;
	}

	const { form = false, class: className = "", children, ...rest }: Props = $props();
	const FORM =
		"[&_tbody_tr]:border-t [&_tbody_tr]:border-surface-200 [&_tbody_td]:p-2 [&_tbody_td]:align-top";
</script>

<table
	class={["table w-full text-sm", form ? FORM : "", className].filter(Boolean).join(" ")}
	{...rest}
>
	{@render children()}
</table>

<style>
	table :global(th) {
		padding: 0.5rem;
		text-align: left;
	}
</style>
