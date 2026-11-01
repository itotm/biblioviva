<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The row under a grid: secondary actions on the right (the export menu by default), any status
     text on the left. Right alignment keeps the actions where a table's controls are expected. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import ExportMenu from "#lib/components/ExportMenu.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		/** Registered export table: renders the "Esporta" menu (CSV/ODS) with `exportParams`. */
		exportTable?: string;
		exportParams?: Record<string, string | number | undefined | null>;
		/** Text or badges shown on the left. */
		status?: Snippet;
		/** Other actions rendered before the export menu. */
		actions?: Snippet;
	}

	const { exportTable, exportParams = {}, status, actions }: Props = $props();
</script>

<Row align="center" justify="between" data-testid="grid-footer">
	<div class="text-sm opacity-70">
		{#if status}{@render status()}{/if}
	</div>
	<Row align="center">
		{#if actions}{@render actions()}{/if}
		{#if exportTable}<ExportMenu table={exportTable} params={exportParams} />{/if}
	</Row>
</Row>
