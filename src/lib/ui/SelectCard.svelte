<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A selectable card (step 1.15): a full-width button styled as a card, with the selected state
     as a filled, fully bordered surface (never an underline) and hover feedback. Its content is its
     accessible name, so what it shows is what a screen reader says (WCAG 2.5.3). As one choice of
     a `radiogroup` (`role="radio"`: the colour sets, the classification tiles) it reports
     `aria-checked`, else `aria-pressed`; `row` lays out a picture beside its text. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";

	interface Props extends HTMLButtonAttributes {
		selected: boolean;
		/** A picture and its text side by side, as wide as its grid cell. */
		row?: boolean;
		padding?: "2" | "3" | "4";
		class?: string;
		children: Snippet;
	}

	const {
		selected,
		row = false,
		padding = "4",
		role,
		class: className = "",
		children,
		...rest
	}: Props = $props();
	const PADDING = { "2": "p-2", "3": "p-3", "4": "p-4" } as const;
	const classes = $derived(
		[
			row ? "flex items-center gap-3" : "block w-full",
			"rounded-container border-2 text-left transition-[border-color,background-color,box-shadow] duration-150 hover:shadow-[var(--bv-shadow-raised)]",
			PADDING[padding],
			selected
				? "border-primary-500 bg-primary-50 shadow-[var(--bv-shadow-card)]"
				: "border-surface-200 bg-surface-50 hover:border-primary-300 hover:bg-primary-50",
			className,
		]
			.filter(Boolean)
			.join(" "),
	);
</script>

<button
	type="button"
	class={classes}
	{role}
	aria-checked={role === "radio" ? selected : undefined}
	aria-pressed={role === "radio" ? undefined : selected}
	{...rest}
>
	{@render children()}
</button>
