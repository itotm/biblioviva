<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Catalogue grid cell (step 5.1): copies on the shelf out of the total, colour + icon + text. -->
<script lang="ts">
	import type { GridRow } from "#lib/components/DataGrid.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";

	interface Props {
		row: GridRow;
	}

	const { row }: Props = $props();
	const available = $derived(Number(row.available ?? 0));
	const total = $derived(Number(row.total ?? 0));
	const look = $derived(
		available > 0
			? { icon: icons.available, tone: "preset-tonal-success" }
			: total > 0
				? { icon: icons.loan, tone: "preset-tonal-warning" }
				: { icon: icons.inactive, tone: "preset-tonal" },
	);
	const Icon = $derived(look.icon);
</script>

<span class="flex h-full items-center">
	<span
		class="badge {look.tone} inline-flex items-center gap-1 text-xs"
		data-testid="availability"
	>
		<Icon size={ICON_SIZE.sm} aria-hidden="true" />
		{String(row.copies ?? "")}
	</span>
</span>
