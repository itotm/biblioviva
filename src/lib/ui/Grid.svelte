<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A responsive grid (step 1.15): N columns from the `sm`/`md` breakpoint, or auto-fill tiles. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		/** Columns at the breakpoint (`auto` = as many 11 rem tiles as fit). */
		cols?: "2" | "3" | "auto";
		/** Breakpoint from which the columns apply. */
		from?: "sm" | "md";
		/** Three columns from `lg` as well (with `cols="2"`). */
		lg3?: boolean;
		gap?: "2" | "3" | "4";
		/** Span both columns of a parent two-column grid (`md:col-span-2`). */
		span?: boolean;
		as?: "div" | "ul" | "ol" | "nav" | "form";
		class?: string;
		children: Snippet;
	}

	const {
		cols = "2",
		from = "md",
		lg3 = false,
		gap = "4",
		span = false,
		as = "div",
		class: className = "",
		children,
		...rest
	}: Props = $props();
	const COLS = {
		"2": { sm: "sm:grid-cols-2", md: "md:grid-cols-2" },
		"3": { sm: "sm:grid-cols-3", md: "md:grid-cols-3" },
		auto: {
			sm: "grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]",
			md: "grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]",
		},
	} as const;
	const classes = $derived(
		[
			"grid",
			`gap-${gap}`,
			COLS[cols][from],
			lg3 ? "lg:grid-cols-3" : "",
			span ? "md:col-span-2" : "",
			className,
		]
			.filter(Boolean)
			.join(" "),
	);
</script>

<svelte:element this={as} class={classes} {...rest}>{@render children()}</svelte:element>
