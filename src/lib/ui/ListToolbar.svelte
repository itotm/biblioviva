<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Search box on its own row, filter chips (or the selection actions) aligned below it, above a
     grid (§3.18, §3.19; layout unified across lists on the owner's review). Exports
     live under the grid (`GridFooter`), not here. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "./icons.js";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		/** Bound search text; the parent runs the query. */
		search?: string;
		searchPlaceholder?: string;
		/** Number of selected rows; when > 0 the selection actions replace the filters. */
		selectedCount?: number;
		filters?: Snippet;
		selectionActions?: Snippet;
		/** Other secondary actions, right-aligned on the search row. */
		actions?: Snippet;
		onsearch?: (value: string) => void;
	}

	let {
		search = $bindable(""),
		searchPlaceholder,
		selectedCount = 0,
		filters,
		selectionActions,
		actions,
		onsearch,
	}: Props = $props();
	const i18n = useI18n();
	const SearchIcon = icons.search;
</script>

<Row column gap="3" data-testid="list-toolbar">
	<Row align="center">
		<label
			class="input-group flex max-w-md grow items-center gap-2 rounded-base border border-surface-300 bg-white px-3 focus-within:border-primary-500"
		>
			<SearchIcon size={ICON_SIZE.md} aria-hidden="true" class="opacity-60" />
			<input
				type="search"
				class="grow bg-transparent py-2 outline-none"
				placeholder={searchPlaceholder ?? i18n.t("common.actions.search")}
				aria-label={i18n.t("common.actions.search")}
				bind:value={search}
				oninput={() => onsearch?.(search)}
			/>
		</label>
		{#if actions}
			<Row align="center" class="md:ml-auto">{@render actions()}</Row>
		{/if}
	</Row>
	{#if selectedCount > 0 && selectionActions}
		<Row
			align="center"
			class="self-start rounded-base bg-primary-100 px-3 py-1"
			role="group"
			aria-label={i18n.t("common.list.selected", { count: selectedCount })}
		>
			<span class="text-sm font-semibold"
				>{i18n.t("common.list.selected", { count: selectedCount })}</span
			>
			{@render selectionActions()}
		</Row>
	{:else if filters}
		<Row align="center">{@render filters()}</Row>
	{/if}
</Row>
