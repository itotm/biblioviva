<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Patron detail (steps 2.1–2.7): photo, facts, open loans, history with export, cards, editable
     notes, and the irreversible removal (anonymization). -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import { resolve } from "$app/paths";
	import { Tabs } from "@skeletonlabs/skeleton-svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		deletePhoto,
		getPatronDetail,
		getPatronHistory,
		removePatron,
	} from "#lib/remote/patrons.remote.js";
	import AddToPrintList from "#lib/components/AddToPrintList.svelte";
	import PatronCardTab from "#lib/components/patrons/PatronCardTab.svelte";
	import PatronHistoryTab from "#lib/components/patrons/PatronHistoryTab.svelte";
	import PatronLoansTab from "#lib/components/patrons/PatronLoansTab.svelte";
	import PatronNotesTab from "#lib/components/patrons/PatronNotesTab.svelte";
	import PatronPhotoPanel from "#lib/components/patrons/PatronPhotoPanel.svelte";
	import { photosOn } from "#lib/ui/features.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { icons } from "#lib/ui/icons.js";
	import { PATRON_STATUS } from "#lib/ui/status.js";
	import { toaster } from "#lib/ui/toaster.js";
	import DetailLayout from "#lib/ui/DetailLayout.svelte";
	import StatusBadge from "#lib/ui/StatusBadge.svelte";
	import ClassBadge from "#lib/components/ClassBadge.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import Button from "#lib/ui/Button.svelte";
	import PageActions from "#lib/ui/PageActions.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Page from "#lib/ui/Page.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";
	import Row from "#lib/ui/Row.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const detail = $derived(getPatronDetail(data.id));
	const history = $derived(getPatronHistory(data.id));
	const PhotoIcon = icons.patron;
	const EditIcon = icons.edit;
	const CardIcon = icons.card;
	const EmailIcon = icons.email;
	const RemoveIcon = icons.delete;
	const ListIcon = icons.lists;
	const ExportIcon = icons.download;
	const canRemove = $derived(hasPermission(data.user, "anonymize"));
	const canRenew = $derived(hasPermission(data.user, "loans"));
	const isAdmin = $derived(hasPermission(data.user, "admin"));

	let confirmRemove = $state(false);
	let addToList = $state(false);
	let confirmDeletePhoto = $state(false);
	let photoMode = $state(false);
	let photoVersion = $state(0);

	async function refresh(withHistory: boolean): Promise<void> {
		await Promise.all([detail.refresh(), withHistory ? history.refresh() : undefined]);
	}

	async function doRemove(): Promise<void> {
		const r = await removePatron({ id: data.id });
		if (!r.ok) {
			toaster.error({
				title: i18n.t("patrons.detail.removeOpenLoans", { count: r.openLoans }),
			});
			return;
		}
		toaster.success({ title: i18n.t("patrons.detail.removed") });
	}

	function onPhotoSaved(): void {
		photoMode = false;
		photoVersion += 1;
		toaster.success({ title: i18n.t("patrons.photo.saved") });
	}

	async function doDeletePhoto(): Promise<void> {
		await deletePhoto({ id: data.id });
		photoVersion += 1;
		toaster.success({ title: i18n.t("patrons.photo.deleted") });
	}
</script>

<svelte:head>
	<title
		>{detail.current ? patronSortName(detail.current) : i18n.t("patrons.list.title")} · {i18n.t(
			"common.app.name",
		)}</title
	>
</svelte:head>

<Page>
	<QueryState query={detail} mode="notFound" back="/patrons">
		{#snippet children(p)}
			<!-- the photo and its buttons, left out while photos are switched off (9.38) -->
			{#snippet photoMedia()}
				<div class="space-y-2">
					{#if p.hasPhoto}
						<img
							src="/media/patrons/{p.id}/main?v={photoVersion}"
							alt={i18n.t("patrons.photo.alt", { name: patronSortName(p) })}
							class="h-40 w-30 rounded-container object-cover ring-1 ring-surface-200"
							width="120"
							height="160"
							data-testid="patron-photo"
						/>
					{:else}
						<div
							class="flex h-40 w-30 items-center justify-center rounded-container bg-surface-200 text-surface-500"
							data-testid="patron-photo-placeholder"
							role="img"
							aria-label={i18n.t("patrons.photo.placeholder")}
						>
							<PhotoIcon size={48} aria-hidden="true" />
						</div>
					{/if}
					{#if p.status !== "anonymized"}
						<Row column gap="1">
							<Button
								size="sm"
								onclick={() => (photoMode = !photoMode)}
								data-testid="photo-toggle">{i18n.t("patrons.photo.title")}</Button
							>
							{#if p.hasPhoto}
								<Button
									size="sm"
									variant="error-tonal"
									onclick={() => (confirmDeletePhoto = true)}
									data-testid="photo-delete"
									>{i18n.t("patrons.photo.delete")}</Button
								>
							{/if}
						</Row>
					{/if}
				</div>
			{/snippet}
			<DetailLayout
				heading={i18n.t("patrons.detail.heading")}
				icon="patron"
				title={patronSortName(p)}
				subtitle={i18n.t(`patrons.types.${p.patronType}`)}
				backHref="/patrons"
				backLabel={i18n.t("patrons.list.title")}
				media={photosOn() ? photoMedia : undefined}
			>
				{#snippet facts()}
					{#if p.status !== "active"}
						<StatusBadge status={PATRON_STATUS[p.status]} />
					{/if}
					<ClassBadge
						label={p.classLabel}
						fallback={p.patronType === "teacher" ? i18n.t("patrons.types.teacher") : ""}
					/>
					<Badge icon={CardIcon} class="font-mono" data-testid="patron-card">
						{p.cardNumber ?? i18n.t("patrons.fields.noCard")}
					</Badge>
					{#if p.email}
						<Badge
							icon={EmailIcon}
							title={i18n.t("patrons.fields.email")}
							data-testid="patron-email"
							><a href="mailto:{p.email}" rel="external" class="hover:underline"
								>{p.email}</a
							></Badge
						>
					{/if}
					{#if p.status === "anonymized" && p.anonymizedAt}
						<Badge data-testid="anonymized-info"
							>{i18n.t("patrons.detail.removedInfo", {
								when: fmt.date(p.anonymizedAt, "medium"),
							})}</Badge
						>
					{/if}
					{#if p.circulationNote}
						<Badge tone="warning" data-testid="circulation-note"
							>{p.circulationNote}</Badge
						>
					{/if}
				{/snippet}
				{#snippet actions()}
					<!-- the main action first, Aggiungi alla lista beside it; the rest in the menu when
				     the row does not fit (9.13, rounds 21–22) -->
					<PageActions
						actions={[
							{
								key: "edit",
								label: i18n.t("patrons.detail.edit"),
								icon: EditIcon,
								href: resolve(`patrons/${p.id}/edit`),
								primary: true,
								testid: "edit-patron",
							},
							...(p.status === "anonymized"
								? []
								: [
										{
											key: "list",
											label: i18n.t("printing.addTo.button"),
											icon: ListIcon,
											onclick: () => (addToList = true),
											testid: "add-to-list",
										},
									]),
							...(isAdmin
								? [
										{
											key: "export",
											label: i18n.t("admin.exports.patronExport"),
											icon: ExportIcon,
											href: resolve(`admin/exports/patron/${p.id}`),
											download: true,
											testid: "export-patron",
										},
									]
								: []),
							...(canRemove && p.status !== "anonymized"
								? [
										{
											key: "remove",
											label: i18n.t("patrons.detail.remove", {
												type: i18n
													.t(`patrons.types.${p.patronType}`)
													.toLowerCase(),
											}),
											icon: RemoveIcon,
											danger: true,
											onclick: () => (confirmRemove = true),
											testid: "remove-patron",
										},
									]
								: []),
						]}
					/>
				{/snippet}

				{#if photoMode && photosOn()}
					<Card
						variant="outlined"
						gap="3"
						as="section"
						class="mb-6"
						data-testid="photo-panel"
					>
						<h2 class="h4">{i18n.t("patrons.photo.title")}</h2>
						<PatronPhotoPanel
							patronId={p.id}
							oncancel={() => (photoMode = false)}
							onsaved={onPhotoSaved}
							formTestid="photo-form"
						/>
					</Card>
				{/if}
				<Tabs defaultValue="loans">
					<Tabs.List>
						<Tabs.Trigger value="loans"
							>{i18n.t("patrons.detail.tabs.loans")} ({p.openLoans
								.length})</Tabs.Trigger
						>
						<Tabs.Trigger value="history"
							>{i18n.t("patrons.detail.tabs.history")}</Tabs.Trigger
						>
						<Tabs.Trigger value="cards"
							>{i18n.t("patrons.detail.tabs.cards")}</Tabs.Trigger
						>
						<Tabs.Trigger value="notes"
							>{i18n.t("patrons.detail.tabs.notes")}</Tabs.Trigger
						>
					</Tabs.List>
					<Tabs.Content value="loans" class="py-4">
						<PatronLoansTab
							patron={p}
							{canRenew}
							canOverride={isAdmin}
							onchanged={refresh}
						/>
					</Tabs.Content>
					<Tabs.Content value="history" class="space-y-3 py-4">
						<PatronHistoryTab patronId={p.id} {history} />
					</Tabs.Content>
					<Tabs.Content value="cards" class="space-y-4 py-4">
						<PatronCardTab patron={p} />
					</Tabs.Content>
					<Tabs.Content value="notes" class="space-y-3 py-4">
						<PatronNotesTab patron={p} />
					</Tabs.Content>
				</Tabs>
			</DetailLayout>

			<ConfirmDialog
				bind:open={confirmDeletePhoto}
				title={i18n.t("patrons.photo.deleteTitle")}
				description={i18n.t("patrons.photo.deleteDescription")}
				tone="error"
				confirmLabel={i18n.t("patrons.photo.delete")}
				onconfirm={doDeletePhoto}
			/>
			<ConfirmDialog
				bind:open={confirmRemove}
				title={i18n.t("patrons.detail.removeTitle", { name: patronSortName(p) })}
				description={i18n.t("patrons.detail.removeDescription")}
				tone="error"
				confirmLabel={i18n.t("patrons.detail.remove", {
					type: i18n.t(`patrons.types.${p.patronType}`).toLowerCase(),
				})}
				onconfirm={doRemove}
			>
				{#if p.openLoans.length > 0}
					<Alert tone="warning" role="alert">
						{i18n.t("patrons.detail.removeOpenLoans", { count: p.openLoans.length })}
					</Alert>
				{/if}
				{#if p.classSheets > 0}
					<Alert tone="warning" data-testid="remove-class-sheets">
						{i18n.t("patrons.detail.removeClassSheets", { count: p.classSheets })}
					</Alert>
				{/if}
			</ConfirmDialog>
			<AddToPrintList entityIds={[p.id]} trigger={false} bind:open={addToList} />
		{/snippet}
	</QueryState>
</Page>
