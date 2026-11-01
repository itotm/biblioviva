<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A picture chosen next to a form (9.13, round 11): the cover of a new book, the photo of a new
     patron. The thumbnail (or its placeholder) on the left, a title, a status line and the actions. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import Card from "./Card.svelte";
	import Hint from "./Hint.svelte";
	import Row from "./Row.svelte";

	interface Props extends HTMLAttributes<HTMLElement> {
		title: string;
		/** The status line (what the picture is, or why there is none). */
		status: string;
		statusTestId?: string;
		/** The thumbnail or its placeholder. */
		media: Snippet;
		actions?: Snippet;
		class?: string;
	}

	const {
		title,
		status,
		statusTestId,
		media,
		actions,
		class: className = "",
		...rest
	}: Props = $props();
</script>

<Card
	as="section"
	class="flex flex-wrap items-center gap-4 {className}"
	aria-label={title}
	{...rest}
>
	{@render media()}
	<div class="min-w-0 flex-1 space-y-2">
		<p class="font-semibold">{title}</p>
		<Hint data-testid={statusTestId}>{status}</Hint>
		{#if actions}
			<Row gap="2">{@render actions()}</Row>
		{/if}
	</div>
</Card>
