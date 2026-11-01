<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The backdrop, positioner and card of a Skeleton Dialog (step 1.15), shared by every dialog
     of the app; the caller renders the header, body and footer inside. -->
<script lang="ts">
	import { Dialog } from "@skeletonlabs/skeleton-svelte";
	import type { Snippet } from "svelte";

	interface Props {
		/** `xl`: a wide dialog (a gallery of pictures). */
		width?: "md" | "lg" | "xl";
		/** Enter transition of the card (opacity and a small rise). */
		animated?: boolean;
		/** A tall body scrolls inside the dialog, which never exceeds 90 % of the visible window. */
		scroll?: boolean;
		class?: string;
		"data-testid"?: string;
		children: Snippet;
	}

	const {
		width = "md",
		animated = false,
		scroll = false,
		class: className = "",
		children,
		...rest
	}: Props = $props();
	const animation =
		"transition transition-discrete opacity-0 translate-y-4 starting:data-[state=open]:opacity-0 data-[state=open]:opacity-100 data-[state=open]:translate-y-0";
	const classes = $derived(
		[
			"my-auto w-full space-y-4 card preset-filled-surface-100-900 p-4 shadow-xl",
			width === "xl" ? "max-w-4xl" : width === "lg" ? "max-w-lg" : "max-w-md",
			animated ? animation : "",
			scroll ? "max-h-[90dvh] overflow-y-auto" : "",
			className,
		]
			.filter(Boolean)
			.join(" "),
	);
</script>

<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/40" />
<!-- centred while it fits; taller than the window (a phone with its keyboard open, which shrinks
     the window: app.html) the positioner scrolls, so every field and button can be reached -->
<Dialog.Positioner class="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4">
	<Dialog.Content class={classes} {...rest}>
		{@render children()}
	</Dialog.Content>
</Dialog.Positioner>
