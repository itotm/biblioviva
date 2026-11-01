<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Patron photos from Koha (step 3.9b): a ZIP archive of files named after the card number, or the
     files copied into the server's drop folder; photos already present are kept unless "sostituisci";
     the summary lists the files that matched nobody (downloadable). -->
<script lang="ts">
	import type { ExternalHref } from "#lib/ui/href.js";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getPhotoFolder,
		importPhotoFolder,
		importPhotoZip,
	} from "#lib/remote/photo-import.remote.js";
	import type { PhotoImportSummary } from "#lib/server/services/photo-import.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";

	const i18n = useI18n();
	const folder = getPhotoFolder();
	const zip = importPhotoZip;
	const UploadIcon = icons.upload;
	const DownloadIcon = icons.download;
	let replaceFolder = $state(false);
	let busy = $state(false);
	let summary = $state<PhotoImportSummary | null>(null);

	// the summary of an import made on a previous visit does not come back (9.13, round 9)
	const previousResult = zip.result;
	$effect(() => {
		if (zip.result && zip.result !== previousResult) {
			summary = zip.result;
		}
	});

	async function fromFolder(): Promise<void> {
		busy = true;
		try {
			summary = await importPhotoFolder({ replace: replaceFolder });
			toaster.success({ title: i18n.t("admin.photosImport.done") });
		} finally {
			busy = false;
		}
	}

	const unmatchedHref = $derived<ExternalHref | null>(
		summary && summary.unmatched.length > 0
			? `data:text/csv;charset=utf-8,${encodeURIComponent(["file", ...summary.unmatched].join("\r\n"))}`
			: null,
	);
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("admin.photosImport.title")}
		icon="camera"
		backHref="/admin/imports"
		backLabel={i18n.t("common.actions.back")}
	>
		{#snippet views()}
			<AreaTabs area="imports" current="photos" />
		{/snippet}
	</PageHeader>
	<Hint tone="soft">{i18n.t("admin.photosImport.hint")}</Hint>

	<Grid from="md" gap="4">
		<Card gap="3" as="section" data-testid="photos-zip">
			<h2 class="title-lg">{i18n.t("admin.photosImport.zip.title")}</h2>
			<form {...zip} enctype="multipart/form-data" class="space-y-3">
				<Field label={i18n.t("admin.photosImport.zip.file")}
					><Input
						{...zip.fields.file.as("file")}
						accept=".zip,application/zip"
						required
						data-testid="photos-zip-file"
					/></Field
				>
				{#if zip.fields.file.issues()?.length}
					<Hint tone="error" role="alert">{zip.fields.file.issues()?.[0]?.message}</Hint>
				{/if}
				<Row wrap={false} align="center" as="label">
					<input {...zip.fields.replace.as("checkbox")} class="checkbox" />
					<span>{i18n.t("admin.photosImport.replace")}</span>
				</Row>
				<Button
					variant="primary"
					type="submit"
					icon={UploadIcon}
					disabled={zip.pending > 0}
					data-testid="photos-zip-submit"
					>{zip.pending > 0
						? i18n.t("common.status.loading")
						: i18n.t("admin.photosImport.zip.submit")}</Button
				>
			</form>
		</Card>
		<Card gap="3" as="section" data-testid="photos-folder">
			<h2 class="title-lg">{i18n.t("admin.photosImport.folder.title")}</h2>
			<Hint>
				{i18n.t("admin.photosImport.folder.hint", {
					path: folder.current?.path ?? "",
					count: folder.current?.files ?? 0,
				})}
			</Hint>
			<Row wrap={false} align="center" as="label">
				<input type="checkbox" class="checkbox" bind:checked={replaceFolder} />
				<span>{i18n.t("admin.photosImport.replace")}</span>
			</Row>
			<Row>
				<Button
					onclick={fromFolder}
					disabled={busy || !folder.current?.files}
					data-testid="photos-folder-submit"
					>{i18n.t("admin.photosImport.folder.submit")}</Button
				>
			</Row>
		</Card>
	</Grid>

	{#if summary}
		<Card gap="3" as="section" data-testid="photos-summary">
			<h2 class="title-lg">{i18n.t("admin.photosImport.summary.title")}</h2>
			<p data-testid="photos-summary-text">
				{i18n.t("admin.photosImport.summary.text", {
					imported: summary.imported,
					replaced: summary.replaced,
					kept: summary.kept,
					unmatched: summary.unmatched.length,
					unreadable: summary.unreadable.length,
				})}
			</p>
			{#if summary.unreadable.length > 0}
				<Hint tone="error-soft" data-testid="photos-unreadable"
					>{i18n.t("admin.photosImport.summary.unreadable", {
						files: summary.unreadable.join(", "),
					})}</Hint
				>
			{/if}
			{#if unmatchedHref}
				<Row>
					<Button
						icon={DownloadIcon}
						href={unmatchedHref}
						download="foto-senza-utente.csv"
						data-testid="photos-unmatched"
						>{i18n.t("admin.photosImport.summary.unmatched")}</Button
					>
				</Row>
			{/if}
		</Card>
	{/if}
</Page>
