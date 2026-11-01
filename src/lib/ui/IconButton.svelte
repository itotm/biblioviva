<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Icon-only button (step 1.15): always needs an accessible name (`label` → aria-label + title). -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	import { ICON_SIZE, type IconComponent } from "./icons.js";

	interface Props extends HTMLButtonAttributes {
		/** A page of the app (renders a link): a route path or `resolve(…)`. */
		href?: ResolvedPathname;
		icon: IconComponent;
		label: string;
		variant?: "ghost" | "tonal" | "error";
		size?: "md" | "sm";
		class?: string;
	}

	let {
		icon,
		label,
		variant = "ghost",
		size = "md",
		href,
		class: className = "",
		type = "button",
		...rest
	}: Props = $props();

	const PRESET = {
		ghost: "hover:preset-tonal",
		tonal: "preset-tonal",
		error: "preset-tonal-error",
	} as const;
	const classes = $derived(
		["btn-icon", size === "sm" ? "btn-sm" : "", PRESET[variant], className]
			.filter(Boolean)
			.join(" "),
	);
	const Icon = $derived(icon);
	const iconSize = $derived(size === "sm" ? ICON_SIZE.sm : ICON_SIZE.md);
</script>

{#if href !== undefined}
	<a {href} class={classes} aria-label={label} title={label} {...rest as HTMLAnchorAttributes}>
		<Icon size={iconSize} aria-hidden="true" />
	</a>
{:else}
	<button {type} class={classes} aria-label={label} title={label} {...rest}>
		<Icon size={iconSize} aria-hidden="true" />
	</button>
{/if}
