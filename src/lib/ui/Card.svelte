<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A surface with padding and vertical rhythm (step 1.15): plain, outlined or filled. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		variant?: "plain" | "outlined" | "filled";
		/** Padding: `md` = p-4, `lg` = p-4 md:p-6. */
		padding?: "md" | "lg" | "none";
		/** Vertical gap between children (space-y-N), none by default. */
		gap?: "2" | "3" | "4";
		as?: "div" | "section" | "article" | "li" | "form" | "nav";
		class?: string;
		children: Snippet;
	}

	const {
		variant = "plain",
		padding = "md",
		gap,
		as = "div",
		class: className = "",
		children,
		...rest
	}: Props = $props();
	const VARIANT = {
		plain: "",
		outlined: "preset-outlined-surface-200-800",
		filled: "preset-filled-surface-100-900",
	} as const;
	const PADDING = { md: "p-4", lg: "p-4 md:p-6", none: "" } as const;
	const classes = $derived(
		["card", VARIANT[variant], PADDING[padding], gap ? `space-y-${gap}` : "", className]
			.filter(Boolean)
			.join(" "),
	);
</script>

<svelte:element this={as} class={classes} {...rest}>{@render children()}</svelte:element>
