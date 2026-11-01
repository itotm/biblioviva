<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The app's button (PLAN.md step 1.15): one place for the Skeleton presets, sizes and the
     icon + label layout. Renders an <a> when `href` is given. Extra attributes (data-testid,
     aria-*, onclick, type, disabled, title…) pass through. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	import { isExternal, type Href } from "./href.js";
	import { ICON_SIZE, type IconComponent } from "./icons.js";

	export type ButtonVariant =
		| "primary"
		| "tonal"
		| "outlined"
		| "error"
		| "error-outlined"
		| "error-tonal"
		| "success-tonal"
		| "primary-tonal";

	interface Props
		extends HTMLButtonAttributes, Pick<HTMLAnchorAttributes, "download" | "target" | "rel"> {
		/** Renders a link: a page of the app or an outside address (see `href.ts`). */
		href?: Href;
		variant?: ButtonVariant;
		size?: "md" | "sm";
		/** Icon rendered before the label, sized after the button. */
		icon?: IconComponent;
		/** Stretch to the container's width. */
		full?: boolean;
		class?: string;
		children?: Snippet;
	}

	let {
		variant = "tonal",
		size = "md",
		icon,
		full = false,
		href,
		download,
		target,
		rel,
		class: className = "",
		children,
		type = "button",
		...rest
	}: Props = $props();

	const PRESET: Record<ButtonVariant, string> = {
		primary: "preset-filled-primary-500",
		tonal: "preset-tonal",
		outlined: "preset-outlined-surface-200-800",
		error: "preset-filled-error-500",
		"error-outlined": "preset-outlined-error-500 hover:preset-tonal-error",
		"error-tonal": "preset-tonal-error",
		"success-tonal": "preset-tonal-success",
		"primary-tonal": "preset-tonal-primary",
	};
	const classes = $derived(
		["btn", size === "sm" ? "btn-sm" : "", PRESET[variant], full ? "w-full" : "", className]
			.filter(Boolean)
			.join(" "),
	);
	const Icon = $derived(icon);
	const iconSize = $derived(size === "sm" ? ICON_SIZE.sm : ICON_SIZE.md);
</script>

{#snippet content()}
	{#if Icon}<Icon size={iconSize} aria-hidden="true" />{/if}
	{#if children}
		{#if Icon}<span>{@render children()}</span>{:else}{@render children()}{/if}
	{/if}
{/snippet}

{#if href !== undefined && isExternal(href)}
	<a
		{href}
		{download}
		{target}
		rel="external noopener"
		class={classes}
		{...rest as HTMLAnchorAttributes}>{@render content()}</a
	>
{:else if href !== undefined}
	<a {href} {download} {target} {rel} class={classes} {...rest as HTMLAnchorAttributes}
		>{@render content()}</a
	>
{:else}
	<button {type} class={classes} {...rest}>{@render content()}</button>
{/if}
