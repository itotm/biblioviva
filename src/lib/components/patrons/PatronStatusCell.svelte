<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Patron grid cell (9.13, round 3): what needs attention at a glance — loans in progress, overdue
     loans (the same loan icon, in red) and, when photos are required, a missing photo. Colour, icon
     and text together: colour is never the only cue. -->
<script lang="ts">
	import type { GridRow } from "#lib/components/DataGrid.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";

	interface Props {
		row: GridRow;
	}

	const { row }: Props = $props();
	const i18n = useI18n();
	const open = $derived(Number(row.openLoans ?? 0));
	const overdue = $derived(Number(row.overdueLoans ?? 0));
	const LoanIcon = icons.loan;
	const NoPhotoIcon = icons.noPhoto;
</script>

<span class="flex h-full flex-wrap items-center gap-1" data-testid="patron-status">
	{#if open - overdue > 0}
		<span
			class="badge inline-flex items-center gap-1 preset-tonal-primary text-xs"
			data-testid="status-loans"
		>
			<LoanIcon size={ICON_SIZE.sm} aria-hidden="true" />
			{i18n.t("patrons.list.status.loans", { count: open - overdue })}
		</span>
	{/if}
	{#if overdue > 0}
		<span
			class="badge inline-flex items-center gap-1 preset-tonal-error text-xs"
			data-testid="status-overdue"
		>
			<LoanIcon size={ICON_SIZE.sm} aria-hidden="true" />
			{i18n.t("patrons.list.status.overdue", { count: overdue })}
		</span>
	{/if}
	{#if row.noPhoto}
		<span
			class="badge inline-flex items-center gap-1 preset-tonal-warning text-xs"
			data-testid="status-no-photo"
		>
			<NoPhotoIcon size={ICON_SIZE.sm} aria-hidden="true" />
			{i18n.t("patrons.list.status.noPhoto")}
		</span>
	{/if}
</span>
