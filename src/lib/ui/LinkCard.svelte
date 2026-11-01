<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A card that leads somewhere: the whole card is a link (`href`) or a button (`onclick`), or a
     plain card with neither. `raised`: white with a shadow, the border turning primary on hover
     (the dashboard tiles, the reports); `outlined`: tonal on hover (the section links of
     Administration). The caller lays out the content (an `IconTile` and text, as a rule). -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { ResolvedPathname } from "$app/types";

	interface Props {
		href?: ResolvedPathname;
		onclick?: () => void;
		variant?: "raised" | "outlined";
		class?: string;
		"data-testid"?: string;
		children: Snippet;
	}

	const {
		href,
		onclick,
		variant = "raised",
		class: className = "",
		children,
		...rest
	}: Props = $props();
	const LOOK = {
		raised: "card border border-surface-200 bg-white shadow-[var(--bv-shadow-card)]",
		outlined: "card preset-outlined-surface-200-800",
	} as const;
	const ACTIVE = {
		raised: "cursor-pointer transition hover:border-primary-400 hover:shadow-lg",
		outlined: "hover:preset-tonal",
	} as const;
	const classes = $derived(
		[LOOK[variant], href || onclick ? ACTIVE[variant] : "", className]
			.filter(Boolean)
			.join(" "),
	);
</script>

{#if href}
	<a {href} class={classes} {...rest}>{@render children()}</a>
{:else if onclick}
	<button type="button" {onclick} class={classes} {...rest}>{@render children()}</button>
{:else}
	<div class={classes} {...rest}>{@render children()}</div>
{/if}
