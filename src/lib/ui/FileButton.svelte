<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A button that opens the file picker (step 1.15): a label styled as a tonal button around a
     visually hidden file input. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { ICON_SIZE, type IconComponent } from "./icons.js";

	interface Props extends HTMLInputAttributes {
		icon?: IconComponent;
		class?: string;
		children: Snippet;
	}

	const { icon, class: className = "", children, ...rest }: Props = $props();
	const Icon = $derived(icon);
</script>

<label class={["btn preset-tonal", className].filter(Boolean).join(" ")}>
	{#if Icon}<Icon size={ICON_SIZE.md} aria-hidden="true" />{/if}
	<span>{@render children()}</span>
	<input type="file" class="sr-only" {...rest} />
</label>
