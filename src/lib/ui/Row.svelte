<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A flex row (step 1.15): wrapping by default, with alignment, justification and gap options. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		wrap?: boolean;
		align?: "start" | "center" | "end" | "stretch";
		justify?: "start" | "between" | "end";
		gap?: "0" | "1" | "2" | "3" | "4";
		/** Stack vertically. */
		column?: boolean;
		/** A thin line above, set apart from what precedes it in a card (a second row of actions). */
		divided?: boolean;
		as?:
			| "div"
			| "span"
			| "header"
			| "footer"
			| "nav"
			| "form"
			| "label"
			| "li"
			| "p"
			| "ul"
			| "h2"
			| "h3";
		class?: string;
		children: Snippet;
	}

	const {
		wrap = true,
		align = "stretch",
		justify = "start",
		gap = "2",
		column = false,
		divided = false,
		as = "div",
		class: className = "",
		children,
		...rest
	}: Props = $props();
	const ALIGN = {
		start: "items-start",
		center: "items-center",
		end: "items-end",
		stretch: "",
	} as const;
	const JUSTIFY = { start: "", between: "justify-between", end: "justify-end" } as const;
	const classes = $derived(
		[
			"flex",
			column ? "flex-col" : wrap ? "flex-wrap" : "",
			ALIGN[align],
			JUSTIFY[justify],
			gap === "0" ? "" : `gap-${gap}`,
			divided ? "border-t border-surface-200 pt-3" : "",
			className,
		]
			.filter(Boolean)
			.join(" "),
	);
</script>

<svelte:element this={as} class={classes} {...rest}>{@render children()}</svelte:element>
