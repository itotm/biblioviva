<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The <main> of every page (step 1.15): centred, one of four widths, page padding and gap. -->
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		width?: "md" | "lg" | "xl" | "2xl";
		gap?: "6" | "8";
		class?: string;
		children: Snippet;
	}

	const { width = "lg", gap = "6", class: className = "", children }: Props = $props();
	// the limits grow with large windows (owner request): unchanged up to the 1280 px reference,
	// wider from the 2xl breakpoint (96rem, 1536 px) and again from 112.5rem (1800 px; in rem so that
	// Tailwind orders it after 2xl)
	const WIDTH = {
		md: "max-w-4xl 2xl:max-w-5xl",
		lg: "max-w-5xl 2xl:max-w-6xl min-[112.5rem]:max-w-7xl",
		xl: "max-w-6xl 2xl:max-w-7xl min-[112.5rem]:max-w-[100rem]",
		"2xl": "max-w-7xl 2xl:max-w-[96rem] min-[112.5rem]:max-w-[120rem]",
	} as const;
	const classes = $derived(
		["mx-auto p-4 md:p-8", WIDTH[width], gap === "8" ? "space-y-8" : "space-y-6", className]
			.filter(Boolean)
			.join(" "),
	);
</script>

<main class={classes}>{@render children()}</main>
