<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The wishlist (step 9.15, Q88): a form to note a wish (title, author, series and number, note,
     who asked), with what the catalogue and the list already have shown while typing; the list as a
     grid with search, sort, export, "+1 richiesta", "Cataloga" (opens "Nuovo libro" prefilled) and
     "Elimina" on the selection; a click on a row edits it. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import PatronPicker from "#lib/components/patrons/PatronPicker.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { getSeriesNames } from "#lib/remote/catalog.remote.js";
	import SimilarBadge from "#lib/components/SimilarBadge.svelte";
	import {
		addWishRequest,
		getWishes,
		getWishSimilar,
		removeWishes,
		saveWish,
	} from "#lib/remote/wishlist.remote.js";
	import type { QuickPatron } from "#lib/server/services/patron-search.js";
	import type { WishRow } from "#lib/server/services/wishlist.js";
	import { formatSeries } from "#lib/shared/series.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import GridFooter from "#lib/ui/GridFooter.svelte";
	import GridFrame from "#lib/ui/GridFrame.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Link from "#lib/ui/Link.svelte";
	import ListToolbar from "#lib/ui/ListToolbar.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import FilterSelect from "#lib/ui/FilterSelect.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const AddIcon = icons.add;
	const SaveIcon = icons.save;
	const RequestIcon = icons.wishlist;
	const CatalogueIcon = icons.book;
	const DeleteIcon = icons.delete;
	const t = (key: string, params?: Record<string, unknown>): string =>
		i18n.t(`circulation.wishlist.${key}`, params);

	// --- the form (a new wish, or the one being edited)
	let editing = $state<number | null>(null);
	let title = $state("");
	let author = $state("");
	let series = $state("");
	let seriesNumber = $state("");
	let note = $state("");
	let requester = $state<{ id: number; name: string } | null>(null);
	let problem = $state<string | null>(null);
	let saving = $state(false);
	const seriesNames = getSeriesNames();

	function clearForm(): void {
		editing = null;
		title = "";
		author = "";
		series = "";
		seriesNumber = "";
		note = "";
		requester = null;
		problem = null;
	}

	function edit(row: WishRow): void {
		editing = row.id;
		title = row.title ?? "";
		author = row.author ?? "";
		series = row.series ?? "";
		seriesNumber = row.seriesNumber ?? "";
		note = row.note ?? "";
		requester =
			row.patronId && row.patronName ? { id: row.patronId, name: row.patronName } : null;
		problem = null;
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	async function save(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (!title.trim() && !author.trim() && !series.trim()) {
			problem = t("form.needOne");
			return;
		}
		saving = true;
		try {
			const r = await saveWish({
				...(editing ? { id: editing } : {}),
				title,
				author,
				series,
				seriesNumber,
				note,
				patronId: requester?.id ?? null,
			});
			if (!r.ok) {
				problem = t(`errors.${r.error}`);
				return;
			}
			toaster.success({
				title: editing ? t("updated") : r.merged ? t("merged") : t("added"),
			});
			clearForm();
			void list.refresh();
		} finally {
			saving = false;
		}
	}

	// --- what the catalogue and the list already have, while typing (3 letters at least)
	const longEnough = (s: string): boolean => s.trim().length >= 3;
	const similar = $derived(
		editing === null && (longEnough(title) || longEnough(author) || longEnough(series))
			? getWishSimilar({ title, author, series })
			: null,
	);
	const found = $derived(similar?.current ?? null);

	// --- the list
	let q = $state("");
	let sort = $state<"recent" | "requests" | "title" | "author">("recent");
	let selectedIds = $state<(string | number)[]>([]);
	let confirmRemove = $state(false);
	const params = $derived({ q, sort });
	const list = $derived(getWishes(params));
	const rows = $derived(list.current ?? []);
	const selected = $derived(rows.filter((r) => selectedIds.includes(r.id)));

	async function addRequests(ids: number[]): Promise<void> {
		const r = await addWishRequest({ ids });
		toaster.success({ title: t("actions.counted", { count: r.counted }) });
		void list.refresh();
		void similar?.refresh();
	}

	async function remove(): Promise<void> {
		const r = await removeWishes({ ids: selected.map((w) => w.id) });
		confirmRemove = false;
		selectedIds = [];
		toaster.success({ title: t("actions.removed", { count: r.removed }) });
		void list.refresh();
	}

	function catalogue(row: WishRow): void {
		void goto(resolve(`cataloging/new?wish=${String(row.id)}`));
	}

	const columns: GridColumn[] = [
		{ id: "title", header: t("columns.title"), width: 240, flexgrow: 2 },
		{ id: "author", header: t("columns.author"), width: 170, flexgrow: 1 },
		{ id: "series", header: t("columns.series"), width: 170 },
		{ id: "requests", header: t("columns.requests"), width: 100 },
		...(data.seesRequester
			? [{ id: "requester", header: t("columns.requester"), width: 170 }]
			: []),
		{ id: "note", header: t("columns.note"), width: 200, flexgrow: 1 },
		{ id: "createdAt", header: t("columns.createdAt"), width: 150 },
	];
	const gridRows = $derived(
		rows.map((r) => ({
			id: r.id,
			title: r.title ?? "",
			author: r.author ?? "",
			series: formatSeries(r.series, r.seriesNumber),
			requests: r.requests,
			requester: r.patronName ?? "",
			note: r.note ?? "",
			createdAt: fmt.dateTime(r.createdAt),
		})),
	);
</script>

<Page width="2xl">
	<PageHeader title={t("title")} icon="wishlist">
		{#snippet views()}
			{#if data.hasLoans}
				<AreaTabs area="circulation" current="wishlist" />
			{:else}
				<AreaTabs area="catalog" current="wishlist" />
			{/if}
		{/snippet}
	</PageHeader>

	<Card as="form" gap="3" onsubmit={save} data-testid="wish-form">
		<h2 class="h4">{editing ? t("form.edit") : t("form.new")}</h2>
		<Grid cols="3" span>
			<Field label={t("form.title")} class="md:col-span-2"
				><Input bind:value={title} maxlength={300} data-testid="wish-title" /></Field
			>
			<Field label={t("form.author")}
				><Input bind:value={author} maxlength={200} data-testid="wish-author" /></Field
			>
			<Field label={t("form.series")} class="md:col-span-2">
				<Input
					bind:value={series}
					list="wish-series-names"
					maxlength={200}
					autocomplete="off"
					data-testid="wish-series"
				/>
				<datalist id="wish-series-names">
					{#each seriesNames.current ?? [] as name (name)}
						<option value={name}></option>
					{/each}
				</datalist>
			</Field>
			<Field label={t("form.seriesNumber")}
				><Input
					bind:value={seriesNumber}
					maxlength={20}
					data-testid="wish-series-number"
				/></Field
			>
			<Field label={t("form.note")} hint={t("form.noteHint")} class="md:col-span-2"
				><Input bind:value={note} maxlength={500} data-testid="wish-note" /></Field
			>
			{#if data.canSetRequester}
				<div>
					{#if requester}
						<Field label={t("form.requester")}>
							<Row align="center" gap="2" wrap={false}>
								<span class="font-semibold" data-testid="wish-requester"
									>{requester.name}</span
								>
								<Button size="sm" onclick={() => (requester = null)}
									>{t("form.requesterRemove")}</Button
								>
							</Row>
						</Field>
					{:else}
						<PatronPicker
							label={t("form.requester")}
							testid="wish-requester-picker"
							onpick={(p: QuickPatron) =>
								(requester = { id: p.id, name: patronSortName(p) })}
						/>
					{/if}
				</div>
			{/if}
		</Grid>
		{#if problem}
			<Alert data-testid="wish-problem">{problem}</Alert>
		{/if}
		{#if found && (found.catalog.length > 0 || found.wishes.length > 0)}
			<Alert tone="info" as="div" live={false} data-testid="wish-similar">
				{#if found.catalog.length > 0}
					<p class="font-semibold">{t("similar.catalog")}</p>
					<ul class="mb-2 space-y-0.5" data-testid="wish-similar-catalog">
						{#each found.catalog as b (b.id)}
							<li>
								{#if b.similar}<SimilarBadge />{/if}
								<Link href="/catalog/{b.id}">{b.title}</Link> · {b.author}
								<span class="opacity-70"
									>· {b.copiesTotal === 0
										? t("similar.noCopies")
										: t("similar.copies", {
												available: b.copiesAvailable,
												total: b.copiesTotal,
											})}</span
								>
							</li>
						{/each}
					</ul>
				{/if}
				{#if found.wishes.length > 0}
					<p class="font-semibold">{t("similar.wishes")}</p>
					<ul class="space-y-1" data-testid="wish-similar-wishes">
						{#each found.wishes as w (w.id)}
							<li class="flex flex-wrap items-center gap-2">
								<span
									>{[w.title, w.author, formatSeries(w.series, w.seriesNumber)]
										.filter(Boolean)
										.join(" · ")}
									<span class="opacity-70"
										>({t("similar.requests", { count: w.requests })})</span
									></span
								>
								<Button
									size="sm"
									icon={RequestIcon}
									onclick={() => addRequests([w.id])}
									data-testid="wish-similar-request"
									>{t("similar.addRequest")}</Button
								>
							</li>
						{/each}
					</ul>
				{/if}
			</Alert>
		{/if}
		<Row>
			<Button
				type="submit"
				variant="primary"
				icon={editing ? SaveIcon : AddIcon}
				disabled={saving}
				data-testid="wish-save">{editing ? t("form.save") : t("form.add")}</Button
			>
			{#if editing}
				<Button onclick={clearForm} data-testid="wish-cancel">{t("form.cancel")}</Button>
			{/if}
		</Row>
	</Card>

	<ListToolbar
		bind:search={q}
		searchPlaceholder={t("list.search")}
		selectedCount={selectedIds.length}
	>
		{#snippet selectionActions()}
			<Button
				size="sm"
				icon={RequestIcon}
				onclick={() => addRequests(selected.map((w) => w.id))}
				data-testid="wish-add-request">{t("actions.addRequest")}</Button
			>
			{#if data.canCatalog && selected.length === 1 && selected[0]}
				{@const one = selected[0]}
				<Button
					size="sm"
					variant="primary"
					icon={CatalogueIcon}
					onclick={() => catalogue(one)}
					data-testid="wish-catalogue">{t("actions.catalogue")}</Button
				>
			{/if}
			<Button
				size="sm"
				variant="error-tonal"
				icon={DeleteIcon}
				onclick={() => (confirmRemove = true)}
				data-testid="wish-remove">{t("actions.remove")}</Button
			>
		{/snippet}
		{#snippet filters()}
			<FilterSelect label={t("list.sort")} bind:value={sort} data-testid="wish-sort">
				{#each ["recent", "requests", "title", "author"] as s (s)}
					<option value={s}>{t("list.sort")}: {t(`list.sorts.${s}`)}</option>
				{/each}
			</FilterSelect>
		{/snippet}
	</ListToolbar>

	<div class="space-y-2">
		<QueryState query={list} isEmpty={(wishes) => wishes.length === 0}>
			{#snippet empty()}
				<EmptyState title={t("list.empty")} icon="wishlist" />
			{/snippet}
			<Hint tone="count" data-testid="wish-count"
				>{t("list.count", { count: rows.length })}</Hint
			>
			<GridFrame data-testid="wish-grid">
				<DataGrid
					data={gridRows}
					{columns}
					height="56vh"
					multiselect
					onselectionchange={(ids) => (selectedIds = ids)}
					onrowclick={(row, modifier) => {
						const wish = rows.find((r) => r.id === row.id);
						if (!modifier && selectedIds.length <= 1 && wish) {
							edit(wish);
						}
					}}
				/>
			</GridFrame>
			<GridFooter exportTable="wishlist" exportParams={params} />
		</QueryState>
	</div>

	<ConfirmDialog
		open={confirmRemove}
		title={t("actions.confirmTitle")}
		description={t("actions.confirmText", { count: selected.length })}
		tone="error"
		confirmLabel={t("actions.remove")}
		onconfirm={remove}
		oncancel={() => (confirmRemove = false)}
	/>
</Page>
