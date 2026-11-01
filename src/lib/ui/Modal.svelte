<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A dialog of the app (step 1.15): the Skeleton Dialog, its portal, the frame and the header with
     the title and the close button, mounted only while open (several dialogs on one page leave no
     hidden buttons around). The caller renders the body and the footer. `onclose` runs when the
     dialog is closed from inside it (Escape, the backdrop, the close button). -->
<script lang="ts">
	import { Dialog, Portal } from "@skeletonlabs/skeleton-svelte";
	import type { Snippet } from "svelte";
	import DialogFrame from "./DialogFrame.svelte";
	import DialogHeader from "./DialogHeader.svelte";

	interface Props {
		open: boolean;
		title: string;
		/** Shown after the title, muted (e.g. "· 32 copie"). */
		note?: string;
		onclose?: () => void;
		width?: "md" | "lg" | "xl";
		animated?: boolean;
		scroll?: boolean;
		"data-testid"?: string;
		children: Snippet;
	}

	let {
		open = $bindable(),
		title,
		note,
		onclose,
		width,
		animated,
		scroll,
		children,
		...rest
	}: Props = $props();
</script>

<Dialog
	{open}
	onOpenChange={(d) => {
		open = d.open;
		if (!d.open) {
			onclose?.();
		}
	}}
>
	{#if open}
		<Portal>
			<DialogFrame {width} {animated} {scroll} {...rest}>
				<DialogHeader {title} {note} />
				{@render children()}
			</DialogFrame>
		</Portal>
	{/if}
</Dialog>
