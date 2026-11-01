<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Header card (photo or cover + title, subtitle and key facts + the page's actions at its bottom
     right) followed by tabs (§3.18). The top bar shows the kind of page (`heading`, "Scheda del
     libro"), the same for every record, so it keeps one height and never changes with the record;
     the record's own title is the page's heading, in the card (9.13, round 25). -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import { onDestroy, untrack, type Snippet } from "svelte";
	import type { IconName } from "./icons.js";
	import { usePageHeader } from "./page-header.svelte.js";
	import Card from "#lib/ui/Card.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		/** The kind of page, shown in the top bar ("Scheda del libro"). */
		heading: string;
		icon?: IconName;
		/** Photo, cover or placeholder. */
		media?: Snippet;
		title: string;
		subtitle?: string;
		/** Status badges and quick facts. */
		facts?: Snippet;
		actions?: Snippet;
		/** The tabs (a Tabs component) or any body content. */
		children: Snippet;
		/** Link to the list page, rendered as a back arrow in the bar. */
		backHref?: ResolvedPathname;
		backLabel?: string;
	}

	const {
		heading,
		icon,
		media,
		title,
		subtitle,
		facts,
		actions,
		children,
		backHref,
		backLabel,
	}: Props = $props();
	const store = usePageHeader();
	const token = Symbol("detail-layout");
	// the bar's text is not the page's heading: the record's title in the card is
	const publish = (): void =>
		store?.set(token, { title: heading, icon, backHref, backLabel, titleTag: "p" });
	// published synchronously so server rendering already has it; the effect keeps it in sync
	untrack(publish);
	$effect(publish);
	onDestroy(() => store?.clear(token));
</script>

<div class="space-y-6" data-testid="detail-layout">
	{#if backHref && !store}
		<a href={backHref} class="text-sm text-primary-700 hover:underline"
			>← {backLabel ?? backHref}</a
		>
	{/if}
	<Card as="section" class="flex flex-col gap-4">
		<!-- the title and the facts first, the cover or photo under them on phones and tablets; side
		     by side from wide windows, the picture on the left: on a tablet held upright the title
		     would be left a narrow column beside it (9.13, round 26) -->
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start">
			<div class="min-w-0 grow space-y-2 lg:order-2">
				<h1 class="h2 break-words" data-testid="detail-title">{title}</h1>
				{#if subtitle}<p class="opacity-70" data-testid="detail-subtitle">
						{subtitle}
					</p>{/if}
				{#if facts}<Row>{@render facts()}</Row>{/if}
			</div>
			{#if media}
				<div class="shrink-0 lg:order-1" data-testid="detail-media">{@render media()}</div>
			{/if}
		</div>
		{#if actions}
			<Row align="center" justify="end" data-testid="page-actions">{@render actions()}</Row>
		{/if}
	</Card>
	<Card as="section">{@render children()}</Card>
</div>
