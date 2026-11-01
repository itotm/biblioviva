<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Inline text link (step 1.15): primary colour, underline on hover. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAnchorAttributes } from "svelte/elements";
	import { isExternal, type Href } from "./href.js";

	interface Props extends Omit<HTMLAnchorAttributes, "href"> {
		/** A page of the app or an outside address (see `href.ts`). */
		href: Href;
		class?: string;
		children: Snippet;
	}

	const { href, class: className = "", children, ...rest }: Props = $props();
	const classes = $derived(
		["text-primary-700 hover:underline", className].filter(Boolean).join(" "),
	);
</script>

{#if isExternal(href)}
	<a {href} rel="external noopener" class={classes} {...rest}>{@render children()}</a>
{:else}
	<a {href} class={classes} {...rest}>{@render children()}</a>
{/if}
