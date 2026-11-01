<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Catalogue grid cell (step 5.1): the genre or class pictogram as a badge with its label; the
     row's `pictogram` is the image URL (`pictogramSrc`). -->
<script lang="ts">
	import type { GridRow } from "#lib/components/DataGrid.svelte";

	interface Props {
		row: GridRow;
	}

	const { row }: Props = $props();
	const src = $derived(typeof row.pictogram === "string" ? row.pictogram : "");
</script>

<span class="flex h-full items-center gap-2">
	{#if src}
		<img {src} alt="" class="size-6 shrink-0 object-contain" loading="lazy" />
	{/if}
	<span class="truncate">{String(row.classification ?? "")}</span>
</span>
