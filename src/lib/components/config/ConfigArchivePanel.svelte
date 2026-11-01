<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The configuration as one archive (steps 11.3, 11.12): "Esporta configurazione" downloads the
     archive of the configuration parts; "Importa configurazione" takes any archive (a backup,
     "Esporta tutto" too) and checks its configuration first — files added, changed and removed,
     sections that change, problems — and imports it only without errors, as one change that the
     history can undo. Both are granular: the parts to export, and the configuration parts of the
     archive to take (the others stay as they are). -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { useI18n } from "#lib/i18n/context.js";
	import { submitFile } from "#lib/ui/submit-file.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		applyConfigImport,
		checkConfigImport,
		discardConfigImport,
		getConfigArchiveParts,
		recheckConfigImport,
	} from "#lib/remote/config-archive.remote.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import PartsPicker from "#lib/components/PartsPicker.svelte";
	import { withoutAccounts, type PartId } from "#lib/shared/archive-parts.js";
	import { joinIssues } from "#lib/shared/config-issues.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Disclosure from "#lib/ui/Disclosure.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import FileButton from "#lib/ui/FileButton.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import InUseList from "./InUseList.svelte";

	interface Props {
		onimported: () => void | Promise<void>;
	}

	const { onimported }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	// the public demo downloads no archive or backup (9.17): the button says so, as the guard
	const refuseDownload = $derived(
		page.data.demoPublic
			? () => toaster.warning({ title: i18n.t("common.demoPublic.blocked.archives") })
			: undefined,
	);
	const DownloadIcon = icons.download;
	const UploadIcon = icons.upload;
	const ImportIcon = icons.confirm;
	const CancelIcon = icons.close;

	type Check = NonNullable<typeof checkConfigImport.result>;
	let input = $state<HTMLInputElement>();
	let check = $state<Check | null>(null);
	let checking = $state(false);
	let importing = $state(false);
	let confirm = $state(false);
	const uploadError = $derived(checkConfigImport.fields.archive.issues()?.[0]?.message);

	// export: every part unless some are left out
	const exportable = getConfigArchiveParts();
	let exportParts = $state<PartId[] | null>(null);
	const exportSelection = $derived(exportParts ?? exportable.current ?? []);
	const exportHref = $derived(
		exportParts === null || exportSelection.length === (exportable.current?.length ?? 0)
			? resolve("admin/config/export")
			: resolve(`admin/config/export?parts=${encodeURIComponent(exportSelection.join(","))}`),
	);

	// import: the parts of the archive to take, checked again after every change
	let importParts = $state<PartId[]>([]);
	let rechecking = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	function choose(parts: PartId[]): void {
		importParts = parts;
		clearTimeout(timer);
		const current = check;
		if (!current) {
			return;
		}
		rechecking = true;
		timer = setTimeout(() => {
			void recheckConfigImport({ token: current.token, parts }).then((r) => {
				rechecking = false;
				if (r.ok && check?.token === current.token) {
					check = r.check;
				}
			});
		}, 300);
	}
	const errors = $derived(check?.issues.filter((i) => i.level === "error") ?? []);
	const warnings = $derived(check?.issues.filter((i) => i.level === "warning") ?? []);

	async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = "";
		if (!file || !input) {
			return;
		}
		if (check) {
			await discardConfigImport({ token: check.token });
			check = null;
		}
		checking = true;
		try {
			if ((await submitFile(checkConfigImport, input, file)) && checkConfigImport.result) {
				check = checkConfigImport.result;
				// the staff accounts are not taken unless the operator asks (and confirms)
				const wanted = withoutAccounts(checkConfigImport.result.selected);
				importParts = wanted;
				if (wanted.length !== checkConfigImport.result.selected.length) {
					choose(wanted);
				}
			}
		} finally {
			checking = false;
		}
	}

	async function doImport(): Promise<void> {
		if (!check) {
			return;
		}
		importing = true;
		try {
			const result = await applyConfigImport({ token: check.token, parts: importParts });
			if (result.ok) {
				check = null;
				toaster.success({ title: i18n.t("config.archive.imported") });
				await onimported();
			} else if (result.check) {
				check = { ...check, ...result.check };
			} else {
				toaster.error({
					title: i18n.t("config.archive.failed"),
					description: joinIssues(result.issues),
				});
			}
		} finally {
			importing = false;
		}
	}

	async function cancel(): Promise<void> {
		if (check) {
			await discardConfigImport({ token: check.token });
		}
		check = null;
	}

	const where = (file: string | undefined): string => (file ? `${file} · ` : "");
</script>

<Card variant="outlined" gap="3" data-testid="config-archive">
	<h2 class="title-lg">{i18n.t("config.archive.title")}</h2>
	<Hint>{i18n.t("config.archive.hint")}</Hint>
	<Row>
		<Button
			icon={DownloadIcon}
			href={refuseDownload ? undefined : exportHref}
			download={refuseDownload ? undefined : true}
			onclick={refuseDownload}
			data-testid="config-export"
			>{i18n.t(
				exportHref === "/admin/config/export"
					? "config.archive.export"
					: "config.archive.exportSome",
			)}</Button
		>
		<FileButton
			icon={UploadIcon}
			accept=".zip,application/zip"
			onchange={onFile}
			disabled={checking || importing}
			data-testid="config-import-file">{i18n.t("config.archive.import")}</FileButton
		>
	</Row>
	{#if exportable.current}
		<Disclosure
			summary={i18n.t("config.archive.chooseExport")}
			data-testid="config-export-parts"
		>
			<PartsPicker
				parts={exportable.current}
				bind:selected={() => exportSelection, (v) => (exportParts = v)}
			/>
		</Disclosure>
	{/if}
	{#if checking}
		<Hint tone="faint">{i18n.t("config.archive.checking")}</Hint>
	{/if}
	{#if uploadError}
		<Alert data-testid="config-import-error">{uploadError}</Alert>
	{/if}
	<form {...checkConfigImport} enctype="multipart/form-data" class="hidden" aria-hidden="true">
		<input {...checkConfigImport.fields.archive.as("file")} bind:this={input} />
	</form>

	{#if check}
		<section class="space-y-3" data-testid="config-import-check">
			<p class="font-semibold">
				{i18n.t(
					check.source.library ? "config.archive.fromLibrary" : "config.archive.from",
					{
						library: check.source.library ?? "",
						date: fmt.dateTime(check.source.createdAt ?? ""),
						version: check.source.version ?? "",
					},
				)}
			</p>
			<PartsPicker
				parts={check.available}
				bind:selected={() => importParts, choose}
				guardAccounts
				data-testid="config-import-parts"
			/>
			{#if rechecking}
				<Hint tone="faint">{i18n.t("config.archive.checking")}</Hint>
			{/if}
			<Hint data-testid="config-import-files">
				{i18n.t("config.archive.files", {
					added: check.files.added.length,
					changed: check.files.changed.length,
					removed: check.files.removed.length,
					unchanged: check.files.unchanged,
				})}
			</Hint>
			{#if check.files.added.length + check.files.changed.length + check.files.removed.length > 0}
				<Disclosure summary={i18n.t("config.archive.fileList")}>
					<BulletList muted>
						{#each check.files.added as f (f)}
							<li><code>{f}</code> · {i18n.t("config.archive.added")}</li>
						{/each}
						{#each check.files.changed as f (f)}
							<li><code>{f}</code> · {i18n.t("config.archive.changed")}</li>
						{/each}
						{#each check.files.removed as f (f)}
							<li><code>{f}</code> · {i18n.t("config.archive.removed")}</li>
						{/each}
					</BulletList>
				</Disclosure>
			{/if}
			<Hint data-testid="config-import-sections">
				{check.sections.length === 0
					? i18n.t("config.archive.sameValues")
					: i18n.t("config.archive.sections", {
							sections: check.sections
								.map((s) => i18n.t(`config.sections.${s}.title`))
								.join(", "),
						})}
			</Hint>
			{#if errors.length > 0}
				<Alert as="div" data-testid="config-import-errors">
					<p class="font-semibold">{i18n.t("config.archive.errorsTitle")}</p>
					<BulletList>
						{#each errors as issue, i (i)}
							<li>{where(issue.file)}<code>{issue.path}</code>: {issue.message}</li>
						{/each}
					</BulletList>
				</Alert>
			{/if}
			{#if check.inUse.length > 0}
				<InUseList problems={check.inUse} />
			{/if}
			{#if warnings.length > 0}
				<Disclosure
					summary={i18n.t("config.overview.warnings", { count: warnings.length })}
				>
					<BulletList muted>
						{#each warnings as issue, i (i)}
							<li>{where(issue.file)}<code>{issue.path}</code>: {issue.message}</li>
						{/each}
					</BulletList>
				</Disclosure>
			{/if}
			<Row justify="end">
				<Button icon={CancelIcon} onclick={cancel} disabled={importing}
					>{i18n.t("common.actions.cancel")}</Button
				>
				<Button
					variant="primary"
					icon={ImportIcon}
					onclick={() => (confirm = true)}
					disabled={!check.ready || importing || rechecking || importParts.length === 0}
					data-testid="config-import-apply">{i18n.t("config.archive.apply")}</Button
				>
			</Row>
		</section>
	{/if}
</Card>

<ConfirmDialog
	bind:open={confirm}
	title={i18n.t("config.archive.confirmTitle")}
	description={i18n.t("config.archive.confirmDescription")}
	confirmLabel={i18n.t("config.archive.apply")}
	pending={importing}
	onconfirm={doImport}
/>
