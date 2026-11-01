<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Backups (step 1.9, 1.9b): what the backup contains, list of database copies, run now, download,
     "Esporta tutto" (full ZIP), off-site status. Step 11.12: a backup or a download of the parts
     chosen, and the restore of a backup of the list or of an uploaded archive, part by part. Step
     9.33: a backup made at start, because the scheduled one was missed, is marked. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		createArchiveBackupNow,
		createBackupNow,
		getBackups,
		stageBackupRestore,
		type uploadRestoreArchive,
	} from "#lib/remote/backups.remote.js";
	import PartsPicker from "#lib/components/PartsPicker.svelte";
	import RestorePanel from "#lib/components/RestorePanel.svelte";
	import type { PartId } from "#lib/shared/archive-parts.js";
	import { formatBytes } from "#lib/shared/bytes.js";
	import { ICON_SIZE, icons, type IconComponent } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import { page } from "$app/state";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const fmt = useFormat();
	// the public demo downloads no archive or backup (9.17): the button says so, as the guard
	const refuseDownload = $derived(
		page.data.demoPublic
			? () => toaster.warning({ title: i18n.t("common.demoPublic.blocked.archives") })
			: undefined,
	);
	const BackupIcon = icons.backup;
	const DownloadIcon = icons.download;
	const CloudOkIcon = icons.cloudOk;
	const CloudOffIcon = icons.cloudOff;
	const WarnIcon = icons.damaged;
	const ExportIcon = icons.export;
	const PhotoIcon = icons.patron;
	const CatchUpIcon = icons.dueSoon;

	let running = $state(false);
	const backups = getBackups();
	const RestoreIcon = icons.renew;

	// a backup of chosen parts (every part until some are left out)
	let chosen = $state<PartId[] | null>(null);
	const parts = $derived(chosen ?? backups.current?.parts ?? []);
	const all = $derived(parts.length === (backups.current?.parts.length ?? 0));
	let archiving = $state(false);
	async function onArchive(): Promise<void> {
		archiving = true;
		try {
			const r = await createArchiveBackupNow({ parts });
			toaster.success({ title: i18n.t("admin.backups.created", { name: r.name }) });
		} finally {
			archiving = false;
		}
	}

	type RestoreCheck = NonNullable<typeof uploadRestoreArchive.result>;
	let restoreCheck = $state<RestoreCheck | null>(null);
	async function startRestore(name: string): Promise<void> {
		const r = await stageBackupRestore({ name });
		if (r.ok) {
			restoreCheck = r.check;
			document.getElementById("restore")?.scrollIntoView({ behavior: "smooth" });
		}
	}

	async function onRun(): Promise<void> {
		running = true;
		try {
			const result = await createBackupNow().updates(backups);
			toaster.success({
				title:
					result.deleted.length > 0
						? i18n.t("admin.backups.createdDeleted", {
								name: result.backup.name,
								deleted: result.deleted.length,
							})
						: result.mirror.copied > 0
							? i18n.t("admin.backups.createdMirror", {
									name: result.backup.name,
									copied: result.mirror.copied,
								})
							: i18n.t("admin.backups.created", { name: result.backup.name }),
			});
		} catch {
			toaster.error({ title: i18n.t("common.status.error") });
		} finally {
			running = false;
		}
	}
</script>

{#snippet lineIcon(Icon: IconComponent)}
	<Icon size={ICON_SIZE.sm} class="mt-0.5 shrink-0 text-primary-700" aria-hidden="true" />
{/snippet}

<Page width="xl" gap="8">
	<!-- the title alone until the backups are there (their actions need them) -->
	{#if backups.error || !backups.ready}
		<PageHeader
			title={i18n.t("admin.backups.title")}
			icon="backup"
			backHref="/admin"
			backLabel={i18n.t("common.actions.back")}
		/>
	{/if}
	<QueryState query={backups}>
		{#snippet children(view: NonNullable<typeof backups.current>)}
			<PageHeader
				title={i18n.t("admin.backups.title")}
				icon="backup"
				backHref="/admin"
				backLabel={i18n.t("common.actions.back")}
			>
				{#snippet actions()}
					<Button
						icon={ExportIcon}
						href={refuseDownload ? undefined : "/admin/backups/export"}
						onclick={refuseDownload}
						title={i18n.t("admin.backups.export.hint")}
						data-testid="export-all">{i18n.t("admin.backups.export.button")}</Button
					>
					<Button
						icon={BackupIcon}
						variant="primary"
						onclick={onRun}
						disabled={running}
						data-testid="run-backup"
						>{running
							? i18n.t("common.status.loading")
							: i18n.t("admin.backups.runNow")}</Button
					>
				{/snippet}
			</PageHeader>

			<Card variant="outlined" gap="2" as="section" data-testid="backup-contents">
				<h2 class="h4">{i18n.t("admin.backups.contents.title")}</h2>
				<ul class="space-y-1 text-sm">
					<Row wrap={false} align="start" as="li">
						{@render lineIcon(BackupIcon)}
						<span>{i18n.t("admin.backups.contents.database")}</span>
					</Row>
					<Row wrap={false} align="start" as="li">
						{@render lineIcon(PhotoIcon)}
						<span data-testid="backup-images"
							>{view.mirror.photos + view.mirror.covers > 0 ||
							view.uploads.photos + view.uploads.covers === 0
								? i18n.t("admin.backups.contents.images", {
										photos: view.mirror.photos,
										covers: view.mirror.covers,
									})
								: i18n.t("admin.backups.contents.imagesPending", {
										photos: view.uploads.photos,
										covers: view.uploads.covers,
									})}</span
						>
					</Row>
					<Row wrap={false} align="start" as="li">
						{@render lineIcon(ExportIcon)}
						<span
							>{i18n.t("admin.backups.contents.config")}
							{i18n.t("admin.backups.export.hint")}</span
						>
					</Row>
				</ul>
			</Card>

			<Card variant="outlined" gap="3" as="section" data-testid="backup-parts">
				<h2 class="h4">{i18n.t("admin.backups.parts.title")}</h2>
				<Hint>{i18n.t("admin.backups.parts.hint")}</Hint>
				<PartsPicker parts={view.parts} bind:selected={() => parts, (v) => (chosen = v)} />
				<Row justify="end">
					<Button
						icon={ExportIcon}
						href={refuseDownload
							? undefined
							: all
								? resolve("admin/backups/export")
								: resolve(
										`admin/backups/export?parts=${encodeURIComponent(parts.join(","))}`,
									)}
						onclick={refuseDownload}
						data-testid="export-parts">{i18n.t("admin.backups.parts.download")}</Button
					>
					<Button
						icon={BackupIcon}
						variant="primary"
						onclick={onArchive}
						disabled={archiving || parts.length === 0}
						data-testid="archive-backup">{i18n.t("admin.backups.parts.create")}</Button
					>
				</Row>
			</Card>

			<Card
				variant="outlined"
				as="section"
				class="flex items-start gap-3"
				data-testid="offsite-status"
				data-state={!view.offsiteEnabled
					? "disabled"
					: view.offsite
						? view.offsite.stale
							? "stale"
							: view.offsite.status
						: "never"}
			>
				{#if view.offsiteEnabled && view.offsite?.status === "ok" && !view.offsite.stale}
					<span class="rounded-container bg-success-100 p-2 text-success-800"
						><CloudOkIcon size={ICON_SIZE.lg} aria-hidden="true" /></span
					>
				{:else if view.offsiteEnabled}
					<span class="rounded-container bg-warning-100 p-2 text-warning-900"
						><WarnIcon size={ICON_SIZE.lg} aria-hidden="true" /></span
					>
				{:else}
					<span class="rounded-container bg-surface-100 p-2 text-surface-600"
						><CloudOffIcon size={ICON_SIZE.lg} aria-hidden="true" /></span
					>
				{/if}
				<div class="space-y-1">
					<h2 class="font-semibold">{i18n.t("admin.backups.offsite.title")}</h2>
					{#if !view.offsiteEnabled}
						<Hint>{i18n.t("admin.backups.offsite.disabled")}</Hint>
					{:else if !view.offsite}
						<p class="text-sm">{i18n.t("admin.backups.offsite.never")}</p>
					{:else}
						<p class="text-sm">
							{i18n.t(
								view.offsite.status === "ok"
									? "admin.backups.offsite.ok"
									: "admin.backups.offsite.error",
								{
									when: view.offsite.at ? fmt.dateTime(view.offsite.at) : "—",
								},
							)}
						</p>
						{#if view.offsite.stale}
							<p class="text-sm font-semibold text-warning-900" role="alert">
								{i18n.t("admin.backups.offsite.stale")}
							</p>
						{/if}
					{/if}
					{#if view.offsiteEnabled && view.offsiteRemote}
						<p class="text-xs opacity-70">
							{i18n.t("admin.backups.offsite.remote", { remote: view.offsiteRemote })}
						</p>
					{/if}
				</div>
			</Card>

			{#if view.backups.length === 0}
				<EmptyState title={i18n.t("admin.backups.empty")} icon="backup" />
			{:else}
				<ul
					class="divide-y divide-surface-200 card preset-outlined-surface-200-800"
					data-testid="backups-list"
				>
					{#each view.backups as b (b.name)}
						<Row align="center" gap="3" as="li" class="p-3" data-testid="backup-row">
							<BackupIcon
								size={ICON_SIZE.md}
								class="text-primary-700"
								aria-hidden="true"
							/>
							<span class="min-w-0 grow">
								<span class="block font-mono text-sm">{b.name}</span>
								{#if b.catchUp}
									<Badge
										tone="warning"
										icon={CatchUpIcon}
										title={i18n.t("admin.backups.catchUp.hint")}
										data-testid="backup-catch-up"
										>{i18n.t("admin.backups.catchUp.badge")}</Badge
									>
								{/if}
								<span class="block text-xs opacity-70">
									{i18n.t("admin.backups.columns.when")}: {fmt.dateTime(
										b.createdAt,
									)} ·
									{i18n.t("admin.backups.columns.size")}: {formatBytes(
										b.bytes,
										fmt.locale,
									)}
								</span>
							</span>
							<Button
								icon={DownloadIcon}
								href={refuseDownload
									? undefined
									: `/admin/backups/download/${b.name}`}
								download={refuseDownload ? undefined : b.name}
								onclick={refuseDownload}>{i18n.t("admin.backups.download")}</Button
							>
							<Button
								icon={RestoreIcon}
								onclick={() => startRestore(b.name)}
								data-testid="backup-restore"
								>{i18n.t("admin.backups.restore.button")}</Button
							>
						</Row>
					{/each}
				</ul>
			{/if}

			<div id="restore">
				<RestorePanel bind:check={restoreCheck} maxUploadMb={view.maxUploadMb} />
			</div>
		{/snippet}
	</QueryState>
</Page>
