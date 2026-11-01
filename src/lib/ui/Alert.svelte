<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Inline message box (step 1.15): error, warning, info or success tone; `role="alert"` for
     errors, `role="status"` for the outcome of a check or a scan that screen readers announce
     politely; an optional icon before the text (9.13, round 24). -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { ICON_SIZE, type IconComponent } from "./icons.js";

	interface Props extends HTMLAttributes<HTMLElement> {
		tone?: "error" | "warning" | "info" | "success";
		/** Larger padding for a standalone box (default: compact line). */
		padded?: boolean;
		/** Lighter background (template diagnostics). */
		soft?: boolean;
		/** Monospace small text (compiler messages). */
		mono?: boolean;
		as?: "p" | "div" | "span";
		/** Announce as a live alert (default for the error tone); false for static diagnostics. */
		live?: boolean;
		/** An icon before the text (the text then sits in a block of its own). */
		icon?: IconComponent;
		class?: string;
		children: Snippet;
	}

	const {
		tone = "error",
		padded = false,
		soft = false,
		mono = false,
		as = "p",
		live,
		icon,
		class: className = "",
		children,
		role,
		...rest
	}: Props = $props();
	const SOFT = {
		error: "bg-error-50 text-error-800",
		warning: "bg-warning-50 text-warning-900",
		info: "bg-primary-50 text-primary-900",
		success: "bg-success-50 text-success-900",
	} as const;
	const TONE = {
		error: "bg-error-100 text-error-900",
		warning: "bg-warning-100 text-warning-950",
		info: "bg-primary-100 text-primary-900",
		success: "bg-success-100 text-success-900",
	} as const;
	const classes = $derived(
		[
			"rounded-base",
			mono ? "font-mono text-xs whitespace-pre-wrap" : "text-sm",
			padded ? "px-4 py-3" : soft ? "p-3" : "px-3 py-2",
			soft ? SOFT[tone] : TONE[tone],
			icon ? "flex items-start gap-3" : "",
			className,
		]
			.filter(Boolean)
			.join(" "),
	);
</script>

<svelte:element
	this={as}
	class={classes}
	role={role ?? ((live ?? tone === "error") ? "alert" : undefined)}
	{...rest}
>
	{#if icon}
		{@const Icon = icon}
		<Icon size={ICON_SIZE.md} class="shrink-0" aria-hidden="true" />
		<div class="min-w-0">{@render children()}</div>
	{:else}
		{@render children()}
	{/if}
</svelte:element>
