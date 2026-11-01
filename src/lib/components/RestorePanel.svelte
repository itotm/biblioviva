<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Restoring a backup (step 11.12): a backup of the list or an uploaded archive is checked first —
     the parts it holds, how many rows each data part has now and in the backup, what a choice
     would leave without its patrons or copies, what the configuration would change — and only a
     clean check can be restored; the parts not chosen stay exactly as they are. -->
<script lang="ts">
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import PartsPicker from "#lib/components/PartsPicker.svelte";
	import { untrack } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { submitFile } from "#lib/ui/submit-file.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		applyRestoreNow,
		discardRestoreNow,
		recheckRestore,
		uploadRestoreArchive,
	} from "#lib/remote/backups.remote.js";
	import { withoutAccounts, type DataPart, type PartId } from "#lib/shared/archive-parts.js";
	import Alert from "#lib/ui/Alert.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import FileButton from "#lib/ui/FileButton.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";

	type Check = NonNullable<typeof uploadRestoreArchive.result>;

	interface Props {
		/** A check started from the list of backups. */
		check: Check | null;
		/** The size limit of an upload, in megabytes as the language writes them. */
		maxUploadMb: string;
	}

	let { check = $bindable(), maxUploadMb }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const UploadIcon = icons.upload;
	const RestoreIcon = icons.renew;
	const CancelIcon = icons.close;

	let input = $state<HTMLInputElement>();
	let checking = $state(false);
	let restoring = $state(false);
	let confirm = $state(false);
	let selected = $state<PartId[]>([]);
	let lastToken = "";
	$effect(() => {
		if (check && check.token !== lastToken) {
			lastToken = check.token;
			// the staff accounts are not taken unless the operator asks (and confirms)
			const wanted = withoutAccounts(check.selected);
			selected = wanted;
			if (wanted.length !== check.selected.length) {
				untrack(() => choose(wanted));
			}
		}
	});
	const uploadError = $derived(uploadRestoreArchive.fields.archive.issues()?.[0]?.message);

	async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = "";
		if (!file || !input) {
			return;
		}
		checking = true;
		try {
			if (
				(await submitFile(uploadRestoreArchive, input, file)) &&
				uploadRestoreArchive.result
			) {
				check = uploadRestoreArchive.result;
			}
		} finally {
			checking = false;
		}
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	function choose(parts: PartId[]): void {
		selected = parts;
		const current = check;
		clearTimeout(timer);
		if (!current) {
			return;
		}
		checking = true;
		timer = setTimeout(() => {
			void recheckRestore({ token: current.token, parts }).then((r) => {
				checking = false;
				if (r.ok && check?.token === current.token) {
					check = r.check;
				}
			});
		}, 300);
	}

	async function restore(): Promise<void> {
		if (!check) {
			return;
		}
		restoring = true;
		try {
			const result = await applyRestoreNow({ token: check.token, parts: selected });
			if (result.ok) {
				check = null;
				toaster.success({ title: i18n.t("admin.backups.restore.done") });
			} else if (result.check) {
				check = result.check;
			}
		} finally {
			restoring = false;
		}
	}

	async function cancel(): Promise<void> {
		if (check) {
			await discardRestoreNow({ token: check.token });
		}
		check = null;
	}

	const partName = (p: DataPart): string => i18n.t(`config.parts.data.${p}`);
</script>

<Card variant="outlined" gap="3" as="section" data-testid="restore-panel">
	<h2 class="title-lg">{i18n.t("admin.backups.restore.title")}</h2>
	<Hint>{i18n.t("admin.backups.restore.hint", { maxMb: maxUploadMb })}</Hint>
	<Row>
		<FileButton
			icon={UploadIcon}
			accept=".zip,application/zip"
			onchange={onFile}
			disabled={checking || restoring}
			data-testid="restore-upload">{i18n.t("admin.backups.restore.upload")}</FileButton
		>
	</Row>
	<form {...uploadRestoreArchive} enctype="multipart/form-data" class="hidden" aria-hidden="true">
		<input {...uploadRestoreArchive.fields.archive.as("file")} bind:this={input} />
	</form>
	{#if uploadError}
		<Alert data-testid="restore-error">{uploadError}</Alert>
	{/if}
	{#if checking}
		<Hint tone="faint">{i18n.t("config.archive.checking")}</Hint>
	{/if}

	{#if check}
		{@const c = check}
		<section class="space-y-3" data-testid="restore-check">
			<p class="font-semibold">
				{i18n.t("admin.backups.restore.from", {
					name: c.source.name,
					date: c.source.createdAt ? fmt.dateTime(c.source.createdAt) : "—",
				})}
			</p>
			<PartsPicker
				parts={c.available}
				bind:selected={() => selected, choose}
				needs
				guardAccounts
				data-testid="restore-parts"
			/>
			{#if Object.keys(c.data.counts).length > 0}
				<div data-testid="restore-counts">
					<BulletList muted>
						{#each Object.entries(c.data.counts) as [part, n] (part)}
							<li>
								{i18n.t("admin.backups.restore.count", {
									part: partName(part as DataPart),
									live: n?.live ?? 0,
									archive: n?.archive ?? 0,
								})}
							</li>
						{/each}
					</BulletList>
				</div>
			{/if}
			{#if c.data.photos + c.data.covers > 0}
				<Hint>
					{i18n.t("admin.backups.restore.images", {
						photos: c.data.photos,
						covers: c.data.covers,
					})}
				</Hint>
			{/if}
			{#if c.data.gaps.length > 0}
				<Alert as="div" data-testid="restore-gaps">
					<p class="font-semibold">{i18n.t("admin.backups.restore.gapsTitle")}</p>
					<BulletList>
						{#each c.data.gaps as g (`${g.part}-${g.needs}`)}
							<li>
								{i18n.t("admin.backups.restore.gap", {
									rows: g.rows,
									part: partName(g.part),
									needs: partName(g.needs),
									add: partName(
										selected.includes(`data:${g.part}`) ? g.needs : g.part,
									),
								})}
							</li>
						{/each}
					</BulletList>
				</Alert>
			{/if}
			{#if c.data.schema.length > 0}
				<Alert data-testid="restore-schema"
					>{i18n.t("admin.backups.restore.schema", {
						tables: c.data.schema.join(", "),
					})}</Alert
				>
			{/if}
			{#if c.config}
				<Hint data-testid="restore-config">
					{i18n.t("config.archive.files", {
						added: c.config.files.added.length,
						changed: c.config.files.changed.length,
						removed: c.config.files.removed.length,
						unchanged: c.config.files.unchanged,
					})}
				</Hint>
				{#if c.config.issues.some((i) => i.level === "error")}
					<Alert as="div">
						<BulletList>
							{#each c.config.issues.filter((i) => i.level === "error") as issue, i (i)}
								<li>
									{issue.file ? `${issue.file} · ` : ""}<code>{issue.path}</code>: {issue.message}
								</li>
							{/each}
						</BulletList>
					</Alert>
				{/if}
			{/if}
			<Row justify="end">
				<Button icon={CancelIcon} onclick={cancel} disabled={restoring}
					>{i18n.t("common.actions.cancel")}</Button
				>
				<Button
					variant="primary"
					icon={RestoreIcon}
					onclick={() => (confirm = true)}
					disabled={!c.ready || checking || restoring || selected.length === 0}
					data-testid="restore-apply">{i18n.t("admin.backups.restore.apply")}</Button
				>
			</Row>
		</section>
	{/if}
</Card>

<ConfirmDialog
	bind:open={confirm}
	title={i18n.t("admin.backups.restore.confirmTitle")}
	description={i18n.t("admin.backups.restore.confirmHint")}
	tone="error"
	confirmLabel={i18n.t("admin.backups.restore.apply")}
	pending={restoring}
	onconfirm={restore}
/>
