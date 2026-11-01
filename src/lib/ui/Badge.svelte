<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Small label (step 1.15): tonal by default (`filled` for a strong state), coloured by `tone`,
     with an optional icon before the text. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { ICON_SIZE, type IconComponent } from "./icons.js";

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		tone?: "neutral" | "primary" | "secondary" | "success" | "warning" | "error";
		icon?: IconComponent;
		/** The strong look: the tone's solid colour with white text (a state that must stand out). */
		filled?: boolean;
		/** `li` inside a list of badges. */
		as?: "span" | "li";
		class?: string;
		children: Snippet;
	}

	const {
		tone = "neutral",
		icon: Icon,
		filled = false,
		as = "span",
		class: className = "",
		children,
		...rest
	}: Props = $props();
	const TONE = {
		neutral: "preset-tonal",
		primary: "preset-tonal-primary",
		secondary: "preset-tonal-secondary",
		success: "preset-tonal-success",
		warning: "preset-tonal-warning",
		error: "preset-tonal-error",
	} as const;
	const FILLED = {
		neutral: "preset-filled-surface-500",
		primary: "preset-filled-primary-500",
		secondary: "preset-filled-secondary-500",
		success: "preset-filled-success-500",
		warning: "preset-filled-warning-500",
		error: "preset-filled-error-500",
	} as const;
	const classes = $derived(
		[
			"badge",
			filled ? FILLED[tone] : TONE[tone],
			Icon ? "inline-flex items-center gap-1" : "",
			className,
		]
			.filter(Boolean)
			.join(" "),
	);
</script>

<svelte:element this={as} class={classes} {...rest}
	>{#if Icon}<Icon
			size={ICON_SIZE.sm}
			aria-hidden="true"
		/>{/if}{@render children()}</svelte:element
>
