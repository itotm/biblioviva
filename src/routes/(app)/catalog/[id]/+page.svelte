<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Bibliographic record (step 3.1): cover placeholder, facts, copies with their status and
     borrower, item actions (add copies, edit, change status with reason, delete, reprint labels),
     record edit and deletion, labels of every copy and print lists (step 3.8). -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import { resolve } from "$app/paths";
	import CoverPhotoPanel from "#lib/components/catalog/CoverPhotoPanel.svelte";
	import { coversOn } from "#lib/ui/features.js";
	import { goto } from "$app/navigation";
	import { Tabs } from "@skeletonlabs/skeleton-svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		deleteBiblio,
		deleteCover,
		fetchCover,
		getBiblioDetail,
	} from "#lib/remote/catalog.remote.js";
	import { isOnShelfLendable } from "#lib/shared/copy-status.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { formatSeries } from "#lib/shared/series.js";
	import { toaster } from "#lib/ui/toaster.js";
	import AddToPrintList from "#lib/components/AddToPrintList.svelte";
	import ClassificationBadge from "#lib/components/catalog/ClassificationBadge.svelte";
	import CopiesTab from "#lib/components/catalog/CopiesTab.svelte";
	import LabelPrintDialog from "#lib/components/catalog/LabelPrintDialog.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import RecordLoanHistory from "#lib/components/circulation/RecordLoanHistory.svelte";
	import DetailLayout from "#lib/ui/DetailLayout.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import PageActions from "#lib/ui/PageActions.svelte";
	import Page from "#lib/ui/Page.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";
	import Row from "#lib/ui/Row.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const detail = $derived(getBiblioDetail(data.id));
	const canEdit = $derived(hasPermission(data.user, "catalog"));
	const canSeeLoans = $derived(hasPermission(data.user, "loans"));
	// the patron page needs `patrons`: without it the borrower is plain text (9.13, round 16)
	const canOpenPatrons = $derived(hasPermission(data.user, "patrons"));
	const BookIcon = icons.book;
	const CameraIcon = icons.camera;
	const DownloadIcon = icons.download;
	const EditIcon = icons.edit;
	const SeriesIcon = icons.series;
	const ToClassifyIcon = icons.toClassify;
	const DeleteIcon = icons.delete;
	const AddIcon = icons.add;
	const PrintIcon = icons.print;
	const ListIcon = icons.lists;

	let confirmDelete = $state(false);
	let addToList = $state(false);
	let copiesTab = $state<CopiesTab>();

	// --- labels (step 3.8): every copy from the header, one copy from its row
	let labelDialog = $state(false);
	let labelIds = $state<number[]>([]);
	function openLabels(ids: number[]): void {
		labelIds = ids;
		labelDialog = true;
	}

	// --- cover (step 3.7)
	let coverMode = $state(false);
	let confirmDeleteCover = $state(false);
	let coverVersion = $state(0);

	let downloading = $state(false);
	async function doFetchCover(): Promise<void> {
		downloading = true;
		try {
			const r = await fetchCover({ id: data.id });
			if (r.ok) {
				coverVersion += 1;
				toaster.success({
					title: i18n.t("catalog.cover.downloaded", { provider: r.name }),
				});
			} else {
				toaster.error({
					title: i18n.t(
						r.reason === "no_isbn"
							? "catalog.cover.downloadNoIsbn"
							: "catalog.cover.downloadNotFound",
					),
				});
			}
		} finally {
			downloading = false;
		}
	}

	async function doDeleteCover(): Promise<void> {
		await deleteCover({ id: data.id });
		coverVersion += 1;
		toaster.success({ title: i18n.t("catalog.cover.deleted") });
	}

	async function doDeleteBiblio(): Promise<void> {
		const r = await deleteBiblio({ id: data.id });
		if (!r.ok) {
			toaster.error({ title: i18n.t("catalog.detail.hasItems", { count: r.items }) });
			return;
		}
		toaster.success({ title: i18n.t("catalog.detail.deleted") });
		await goto(resolve("catalog"));
	}
</script>

<svelte:head>
	<title
		>{detail.current?.title ?? i18n.t("catalog.list.title")} · {i18n.t(
			"common.app.name",
		)}</title
	>
</svelte:head>

<Page>
	<QueryState query={detail} mode="notFound" back="/catalog">
		{#snippet children(b)}
			{@const available = b.items.filter(isOnShelfLendable).length}
			<!-- the cover and its buttons, left out while covers are switched off (9.38) -->
			{#snippet coverMedia()}
				<Row column align="center">
					{#if b.hasCover}
						<img
							src="/media/covers/{b.id}/main?v={coverVersion}"
							alt={i18n.t("catalog.cover.alt", { title: b.title })}
							class="h-44 w-auto max-w-32 rounded-container object-contain shadow"
							data-testid="cover-image"
						/>
					{:else}
						<div
							class="flex h-40 w-28 items-center justify-center rounded-container bg-surface-200 text-surface-500"
							role="img"
							aria-label={i18n.t("catalog.cover.placeholder")}
							data-testid="cover-placeholder"
						>
							<BookIcon size={40} aria-hidden="true" />
						</div>
					{/if}
					{#if canEdit}
						<Row gap="1" class="justify-center">
							<Button
								size="sm"
								icon={CameraIcon}
								onclick={() => (coverMode = !coverMode)}
								data-testid="cover-open"
								>{b.hasCover
									? i18n.t("catalog.cover.change")
									: i18n.t("catalog.cover.take")}</Button
							>
							{#if b.isbn}
								<Button
									icon={DownloadIcon}
									size="sm"
									onclick={doFetchCover}
									disabled={downloading}
									data-testid="cover-download"
									>{downloading
										? i18n.t("catalog.cover.downloading")
										: i18n.t("catalog.cover.download")}</Button
								>
							{/if}
							{#if b.hasCover}
								<Button
									size="sm"
									icon={DeleteIcon}
									onclick={() => (confirmDeleteCover = true)}
									data-testid="cover-delete"
									>{i18n.t("catalog.cover.delete")}</Button
								>
							{/if}
						</Row>
					{/if}
				</Row>
			{/snippet}
			<DetailLayout
				heading={i18n.t("catalog.detail.heading")}
				icon="catalog"
				title={b.title}
				subtitle={[b.author, b.publisher, b.publicationYear].filter(Boolean).join(" · ")}
				backHref="/catalog"
				backLabel={i18n.t("catalog.list.title")}
				media={coversOn() ? coverMedia : undefined}
			>
				{#snippet facts()}
					{#if b.kind === null}
						<!-- a record still to classify: its copies do not circulate (step 9.21) -->
						<Badge
							tone="warning"
							icon={ToClassifyIcon}
							title={i18n.t("catalog.toClassify.badgeHint")}
							data-testid="to-classify-badge"
							>{i18n.t("catalog.toClassify.badge")}</Badge
						>
						{#if canEdit}
							<Button
								size="sm"
								variant="primary"
								href={resolve(`catalog/to-classify/${b.id}`)}
								data-testid="classify-record"
								>{i18n.t("catalog.toClassify.classify")}</Button
							>
						{/if}
					{:else}
						<Badge tone="primary" data-testid="kind-badge"
							>{i18n.t(`catalog.kinds.${b.kind}`)}</Badge
						>
						<ClassificationBadge
							node={b.classification}
							readingLevel={b.readingLevel}
						/>
					{/if}
					{#if b.series}
						<!-- the other books of the series, in their order (step 9.14) -->
						<a
							class="badge inline-flex items-center gap-1 preset-tonal-secondary transition-colors hover:preset-filled-secondary-500"
							href={resolve(`catalog?series=${encodeURIComponent(b.series)}`)}
							title={i18n.t("catalog.detail.seriesLink", { series: b.series })}
							data-testid="series-badge"
						>
							<SeriesIcon size={ICON_SIZE.sm} aria-hidden="true" />
							{formatSeries(b.series, b.seriesNumber)}
						</a>
					{/if}
					<!-- the material is the record's, the same for every copy (9.45) -->
					<Badge data-testid="item-type-badge"
						>{data.options.itemTypes.find((t) => t.code === b.itemType)?.label ??
							b.itemType}</Badge
					>
					{#if b.isbn}<Badge class="font-mono" data-testid="isbn-badge"
							>{i18n.t("catalog.fields.isbn")} {b.isbn}</Badge
						>{/if}
					<Badge data-testid="copies-badge">
						{i18n.t("catalog.detail.copies", {
							available,
							total: b.items.filter((i) => i.status !== "withdrawn").length,
						})}
					</Badge>
				{/snippet}
				{#snippet actions()}
					{#if canEdit}
						<!-- the main action first, Aggiungi alla lista beside it; the rest in the menu when
					     the row does not fit (9.13, rounds 21–22) -->
						<PageActions
							actions={[
								{
									key: "edit",
									label: i18n.t("catalog.detail.edit"),
									icon: EditIcon,
									href: resolve(`catalog/${b.id}/edit`),
									primary: true,
									testid: "edit-biblio",
								},
								{
									key: "list",
									label: i18n.t("printing.addTo.button"),
									icon: ListIcon,
									disabled: b.items.length === 0,
									onclick: () => (addToList = true),
									testid: "add-to-list",
								},
								{
									key: "copies",
									label: i18n.t("catalog.detail.addCopies"),
									icon: AddIcon,
									onclick: () => copiesTab?.openAdd(),
									testid: "add-copies",
								},
								{
									key: "labels",
									label: i18n.t("printing.labels.button"),
									icon: PrintIcon,
									disabled: b.items.length === 0,
									onclick: () => openLabels(b.items.map((it) => it.id)),
									testid: "print-labels",
								},
								{
									key: "delete",
									label: i18n.t("catalog.detail.delete"),
									icon: DeleteIcon,
									danger: true,
									onclick: () => (confirmDelete = true),
									testid: "delete-biblio",
								},
							]}
						/>
					{/if}
				{/snippet}

				{#if coverMode && coversOn()}
					<CoverPhotoPanel
						biblioId={b.id}
						width={data.coverWidth}
						onsaved={() => {
							coverMode = false;
							coverVersion += 1;
							toaster.success({ title: i18n.t("catalog.cover.saved") });
						}}
						oncancel={() => (coverMode = false)}
					/>
				{/if}
				<Tabs defaultValue="copies">
					<Tabs.List>
						<Tabs.Trigger value="copies"
							>{i18n.t("catalog.detail.tabs.copies")} ({b.items.length})</Tabs.Trigger
						>
						<Tabs.Trigger value="details"
							>{i18n.t("catalog.detail.tabs.details")}</Tabs.Trigger
						>
						{#if canSeeLoans}
							<Tabs.Trigger value="history" data-testid="tab-history"
								>{i18n.t("circulation.history.title")}</Tabs.Trigger
							>
						{/if}
					</Tabs.List>
					<Tabs.Content value="copies" class="py-4">
						<CopiesTab
							bind:this={copiesTab}
							biblio={b}
							options={data.options}
							{canEdit}
							{canOpenPatrons}
							onlabels={openLabels}
						/>
					</Tabs.Content>
					<Tabs.Content value="details" class="space-y-3 py-4">
						<dl
							class="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]"
							data-testid="biblio-details"
						>
							{#each [["subtitle", b.subtitle], ["originalTitle", b.originalTitle], ["responsibility", b.responsibility], ["publicationPlace", b.publicationPlace], ["physicalDescription", b.physicalDescription], ["issn", b.issn], ["ean", b.ean], ["dewey", b.dewey], ["notes", b.notes]] as [key, value] (key)}
								{#if value}
									<dt class="font-semibold">{i18n.t(`catalog.fields.${key}`)}</dt>
									<dd class="whitespace-pre-line">{value}</dd>
								{/if}
							{/each}
							{#if b.subjects.length}
								<dt class="font-semibold">{i18n.t("catalog.fields.subjects")}</dt>
								<dd>{b.subjects.join(", ")}</dd>
							{/if}
						</dl>
						<Hint tone="faint">
							{i18n.t("catalog.detail.source", { source: b.source })} ·
							{i18n.t("catalog.detail.created", {
								when: fmt.dateTime(b.createdAt),
							})} ·
							{i18n.t("catalog.detail.updated", {
								when: fmt.dateTime(b.updatedAt),
							})}
						</Hint>
					</Tabs.Content>
					{#if canSeeLoans}
						<Tabs.Content value="history" class="py-4">
							<RecordLoanHistory biblioId={b.id} openPatrons={canOpenPatrons} />
						</Tabs.Content>
					{/if}
				</Tabs>
			</DetailLayout>

			<LabelPrintDialog bind:open={labelDialog} ids={labelIds} count={labelIds.length} />

			<ConfirmDialog
				bind:open={confirmDelete}
				title={i18n.t("catalog.detail.deleteTitle", { title: b.title })}
				description={i18n.t("catalog.detail.deleteDescription")}
				tone="error"
				confirmLabel={i18n.t("catalog.detail.delete")}
				onconfirm={doDeleteBiblio}
			/>
			<ConfirmDialog
				bind:open={confirmDeleteCover}
				title={i18n.t("catalog.cover.deleteTitle")}
				description={i18n.t("catalog.cover.deleteDescription")}
				tone="error"
				confirmLabel={i18n.t("catalog.cover.delete")}
				onconfirm={doDeleteCover}
			/>
			<AddToPrintList kind="items" biblioIds={[b.id]} trigger={false} bind:open={addToList} />
		{/snippet}
	</QueryState>
</Page>
