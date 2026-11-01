<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The bordered pill container of a group of toggle buttons (step 1.15): kind switch, class
     choice, template variants… `fit` keeps it as wide as its content. With `options` it draws the
     toggles itself, the one whose value is `value` pressed, `onselect` called on a click; `radio`
     makes it a radio group (one choice of several), else each toggle reports its pressed state.
     Children (toggles drawn by hand) follow the options. -->
<script lang="ts" generics="V extends string | number">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import ToggleButton from "./ToggleButton.svelte";

	interface Option {
		value: V;
		label: string;
		testid?: string;
	}

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "onselect"> {
		fit?: boolean;
		options?: readonly Option[];
		/** The current choice (none pressed when it is no option's value). */
		value?: string | number | null;
		onselect?: (value: V) => void;
		radio?: boolean;
		/** The toggles' size and extra classes. */
		size?: "sm" | "md";
		toggleClass?: string;
		class?: string;
		children?: Snippet;
	}

	const {
		fit = false,
		options = [],
		value,
		onselect,
		radio = false,
		size = "sm",
		toggleClass = "",
		class: className = "",
		role,
		children,
		...rest
	}: Props = $props();
</script>

<div
	class={[
		"flex gap-1 rounded-container border border-surface-200 bg-surface-100 p-1",
		fit ? "w-fit" : "",
		className,
	]
		.filter(Boolean)
		.join(" ")}
	role={radio ? "radiogroup" : role}
	{...rest}
>
	{#each options as o (o.value)}
		<ToggleButton
			pressed={o.value === value}
			role={radio ? "radio" : undefined}
			{size}
			class={toggleClass}
			onclick={() => onselect?.(o.value)}
			data-testid={o.testid}>{o.label}</ToggleButton
		>
	{/each}
	{@render children?.()}
</div>
