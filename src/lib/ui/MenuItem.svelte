<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One entry of a Skeleton Menu (step 1.15): a link (`href`) or an action (`onclick`), with an
     optional icon; the highlighted look is shared; a destructive action in red (`tone="error"`), an
     entry that cannot be used now greyed (`disabled`). -->
<script lang="ts">
	import { Menu } from "@skeletonlabs/skeleton-svelte";
	import type { ResolvedPathname } from "$app/types";
	import type { Snippet } from "svelte";
	import { ICON_SIZE, type IconComponent } from "./icons.js";

	interface Props {
		value: string;
		href?: ResolvedPathname;
		download?: boolean;
		icon?: IconComponent;
		iconSize?: "sm" | "md";
		/** Bold entry (e.g. "all lists"). */
		strong?: boolean;
		tone?: "error";
		disabled?: boolean;
		onclick?: () => void;
		"data-testid"?: string;
		children: Snippet;
	}

	const {
		value,
		href,
		download = false,
		icon,
		iconSize = "sm",
		strong = false,
		tone,
		disabled = false,
		onclick,
		children,
		...rest
	}: Props = $props();
	const Icon = $derived(icon);
	const size = $derived(iconSize === "sm" ? ICON_SIZE.sm : ICON_SIZE.md);
	const inner = $derived(
		// the link fills the whole row, its padding included: a tap past the words or near the
		// edge lands on it too (a phone's finger rarely hits the text, and the row alone only
		// closes the menu)
		[
			"flex flex-1 items-center gap-2 self-stretch px-5 py-3",
			strong ? "font-semibold" : "",
		].join(" "),
	);
</script>

<Menu.Item
	{value}
	{disabled}
	class="flex rounded-base p-0! {disabled
		? 'cursor-not-allowed opacity-50'
		: tone === 'error'
			? 'text-error-700 hover:preset-tonal-error data-[highlighted]:preset-tonal-error'
			: 'hover:preset-tonal data-[highlighted]:preset-tonal'}"
	{onclick}
	{...rest}
>
	{#if href !== undefined}
		<a {href} class={inner} download={download ? "" : undefined}>
			{#if Icon}<Icon {size} aria-hidden="true" />{/if}
			<span>{@render children()}</span>
		</a>
	{:else}
		<span class={inner}>
			{#if Icon}<Icon {size} aria-hidden="true" />{/if}
			<span>{@render children()}</span>
		</span>
	{/if}
</Menu.Item>
