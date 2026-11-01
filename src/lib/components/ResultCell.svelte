<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A grid cell of search results: the row's `label` (a title, a name), its `secondary` text in a
     lighter italic (the original title of a translation, 9.23, so a book found by it shows why),
     and the "Simile" mark of an approximate result (9.24). -->
<script lang="ts">
	import type { GridRow } from "#lib/components/DataGrid.svelte";
	import SimilarBadge from "#lib/components/SimilarBadge.svelte";

	interface Props {
		row: GridRow;
	}

	const { row }: Props = $props();
	const secondary = $derived(typeof row.secondary === "string" ? row.secondary : "");
</script>

<span class="flex h-full min-w-0 items-center gap-2">
	{#if row.similar === true}<SimilarBadge />{/if}
	<span class="truncate">{String(row.label ?? "")}</span>
	{#if secondary}
		<span class="truncate text-sm italic opacity-70" data-testid="title-original"
			>{secondary}</span
		>
	{/if}
</span>
