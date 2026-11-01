<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A group of fields with a title shown as a pill on the top border (same size as the step badges,
     outlined like the group itself — owner review); `collapsible` hides advanced fields. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { ICON_SIZE, icons } from "./icons.js";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";

	interface Props {
		title: string;
		description?: string;
		collapsible?: boolean;
		open?: boolean;
		children: Snippet;
	}

	let {
		title,
		description,
		collapsible = false,
		open = $bindable(true),
		children,
	}: Props = $props();
	const ChevronIcon = icons.more;
</script>

{#snippet pill()}
	<span
		class="badge border border-surface-200 bg-surface-50 text-surface-900"
		data-testid="form-section-title">{title}</span
	>
{/snippet}

{#if collapsible}
	<details class="card preset-outlined-surface-200-800 p-4" bind:open>
		<summary
			class="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"
		>
			<ChevronIcon
				size={ICON_SIZE.sm}
				class="transition-transform {open ? 'rotate-0' : '-rotate-90'}"
				aria-hidden="true"
			/>
			{@render pill()}
		</summary>
		{#if description}<p class="mt-2 text-sm opacity-70">{description}</p>{/if}
		<div class="mt-4 grid gap-4 md:grid-cols-2">{@render children()}</div>
	</details>
{:else}
	<Card variant="outlined" as="section" class="relative mt-3 pt-6" aria-label={title}>
		<!-- the title sits on the top border, like a legend -->
		<h3 class="absolute -top-3 left-4 flex items-center">{@render pill()}</h3>
		{#if description}<p class="mb-3 text-sm opacity-70">{description}</p>{/if}
		<Grid>{@render children()}</Grid>
	</Card>
{/if}
