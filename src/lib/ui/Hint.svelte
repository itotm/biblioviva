<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Secondary text under a field, a title or a count (step 1.15): small and muted, or the field
     error in red, or the emphasised primary line. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		tone?: "muted" | "faint" | "soft" | "error" | "error-soft" | "primary" | "count";
		/** Monospace, extra small (technical detail). */
		mono?: boolean;
		/** `p` (default) or an inline `span`. */
		as?: "p" | "span";
		class?: string;
		children: Snippet;
	}

	const {
		tone = "muted",
		as = "p",
		mono = false,
		class: className = "",
		children,
		...rest
	}: Props = $props();
	const TONE = {
		muted: "text-sm opacity-70",
		/** Extra small and quieter: drag hints, timestamps. */
		faint: "text-xs opacity-60",
		soft: "text-sm opacity-80",
		error: "text-sm text-error-700",
		"error-soft": "text-sm text-error-800",
		primary: "text-sm font-semibold text-primary-700",
		/** The number of rows of a list without filters (a filtered one uses `primary`). */
		count: "text-sm font-semibold opacity-70",
	} as const;
	const classes = $derived(
		[mono ? TONE[tone].replace("text-sm", "font-mono text-xs") : TONE[tone], className]
			.filter(Boolean)
			.join(" "),
	);
</script>

{#if as === "span"}
	<span class={classes} {...rest}>{@render children()}</span>
{:else}
	<p class={classes} {...rest}>{@render children()}</p>
{/if}
