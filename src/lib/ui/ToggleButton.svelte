<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A small toggle of a choice group (9.13, round 2): filled when chosen, otherwise tonal on hover
     (or outlined). As a radio (`role="radio"`) it reports `aria-checked`, else `aria-pressed`. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";

	interface Props extends HTMLButtonAttributes {
		pressed: boolean;
		/** Unchosen look: tonal on hover (default) or outlined. */
		outlined?: boolean;
		/** `md`: the height of a form's buttons (a main choice of a form). */
		size?: "sm" | "md";
		class?: string;
		children: Snippet;
	}

	const {
		pressed,
		outlined = false,
		size = "sm",
		class: className = "",
		role,
		children,
		...rest
	}: Props = $props();
	const off = $derived(outlined ? "preset-outlined-primary-500" : "hover:preset-tonal");
</script>

<button
	type="button"
	{role}
	aria-checked={role === "radio" ? pressed : undefined}
	aria-pressed={role === "radio" ? undefined : pressed}
	class="btn {size === 'sm' ? 'btn-sm' : ''} {pressed
		? 'preset-filled-primary-500'
		: off} {className}"
	{...rest}>{@render children()}</button
>
