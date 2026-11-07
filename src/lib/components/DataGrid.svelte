<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
  The one and only wrapper around SVAR DataGrid (PLAN.md §3.19, step 0.4).
  Pages never import @svar-ui/svelte-grid directly, so the grid could be swapped in one place.
-->
<script lang="ts" module>
	import type { IColumnConfig, IRow } from "@svar-ui/svelte-grid";
	export type GridColumn = IColumnConfig;
	export type GridRow = IRow;
</script>

<script lang="ts">
	import { Grid, Willow } from "@svar-ui/svelte-grid";
	import { Locale } from "@svar-ui/svelte-core";
	import { gridWords } from "./data-grid-locale.js";
	import { useFormat } from "#lib/ui/format.js";
	import type { IApi } from "@svar-ui/svelte-grid";
	type TID = string | number;

	interface Props {
		/** Row objects; every row needs a unique `id`. */
		data: GridRow[];
		columns: GridColumn[];
		/** Height of the grid area (CSS length). Rows are virtualised inside it. */
		height?: string;
		rowHeight?: number;
		/** Allow row selection on click (single or multiple with Shift/Ctrl). */
		select?: boolean;
		multiselect?: boolean;
		selectedRows?: TID[];
		/** Text shown when `data` is empty. */
		emptyText?: string;
		/**
		 * Called when a row is opened: clicked (selected; `modifier` is true for a Ctrl/Shift
		 * multi-selection) or Enter pressed on its focused cell. The arrows only move between the rows
		 * (WCAG 2.1.1, 3.2.2): they select without opening.
		 */
		onrowclick?: (row: GridRow, modifier: boolean) => void;
		/** Called with the current selection whenever it changes. */
		onselectionchange?: (ids: TID[]) => void;
		init?: (api: IApi) => void;
	}

	const {
		data,
		columns,
		height = "60vh",
		rowHeight = 40,
		select = true,
		multiselect = false,
		selectedRows = [],
		emptyText,
		onrowclick,
		onselectionchange,
		init,
	}: Props = $props();

	// the grid's own labels in the installation's language
	const fmt = useFormat();
	const words = $derived(gridWords(fmt.locale));
	const overlay = $derived(data.length === 0 ? (emptyText ?? words.core["No data"]) : undefined);
	let api: IApi | undefined;
	/** Whether the grid opened a row during the click being handled. */
	let opened = false;

	function handleInit(gridApi: IApi): void {
		api = gridApi;
		api.on("select-row", (ev) => {
			const row = api?.getRow(ev.id);
			// a click passes `toggle` and `range`; the keyboard's moves pass the row only
			const byPointer = "toggle" in ev || "range" in ev;
			if (row && onrowclick && byPointer) {
				opened = true;
				onrowclick(row, Boolean(ev.toggle || ev.range));
			}
			if (onselectionchange) {
				onselectionchange(api?.getState().selectedRows ?? []);
			}
		});
		init?.(gridApi);
	}

	/**
	 * A click on the row already selected alone (reached with the arrows) opens it too: the grid
	 * selects only rows that are not selected yet.
	 */
	function openClicked(event: MouseEvent): void {
		const wasOpened = opened;
		opened = false;
		if (wasOpened || !api || !onrowclick || event.ctrlKey || event.metaKey || event.shiftKey) {
			return;
		}
		if (!(event.target instanceof Element) || !event.target.closest(".wx-row")) {
			return;
		}
		const focus = api.getState().focusCell;
		const selected = api.getState().selectedRows ?? [];
		const row = focus ? api.getRow(focus.row) : undefined;
		if (row && selected.length === 1 && selected[0] === focus?.row) {
			onrowclick(row, false);
		}
	}

	/** Enter on a focused cell opens its row, as a click does. */
	function openFocused(event: KeyboardEvent): void {
		if (event.key !== "Enter" || !api || !onrowclick) {
			return;
		}
		const focus = api.getState().focusCell;
		const row = focus ? api.getRow(focus.row) : undefined;
		if (row) {
			event.preventDefault();
			onrowclick(row, false);
		}
	}
</script>

<div
	class="bv-grid"
	class:bv-grid-opens={onrowclick !== undefined}
	style:height
	data-testid="data-grid"
	onkeydown={openFocused}
	onclick={openClicked}
	role="presentation"
>
	<Locale {words}>
		<Willow fonts={false}>
			<Grid
				{data}
				{columns}
				{select}
				{multiselect}
				{selectedRows}
				sizes={{ rowHeight }}
				{overlay}
				init={handleInit}
			/>
		</Willow>
	</Locale>
</div>

<style>
	.bv-grid {
		width: 100%;
		min-height: 8rem;
		overflow: hidden;
	}
	/* rows that open something say so: the pointer and a tint under it (owner review) */
	.bv-grid-opens :global(.wx-row) {
		cursor: pointer;
	}
	.bv-grid-opens :global(.wx-row:hover) {
		background-color: var(--color-primary-50);
	}
</style>
