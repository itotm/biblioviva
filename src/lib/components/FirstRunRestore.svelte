<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Restore from the first-run wizard (step 9.43): the archive of "Esporta tutto" is uploaded and
     checked first (its version, its parts, its problems), the operator sees what it holds and its
     accounts, and only then it is restored whole; the end sends to the login page. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		applyRestoreArchive,
		checkRestoreArchive,
		discardRestoreArchive,
	} from "#lib/remote/first-run-restore.remote.js";
	import { isDataPart } from "#lib/shared/archive-parts.js";
	import Alert from "#lib/ui/Alert.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import FileButton from "#lib/ui/FileButton.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { useFormat } from "#lib/ui/format.js";
	import { icons } from "#lib/ui/icons.js";
	import { submitFile } from "#lib/ui/submit-file.js";

	type Check = Extract<NonNullable<typeof checkRestoreArchive.result>, { ok: true }>["check"];

	interface Props {
		/** The size limit of an upload, in megabytes as the language writes them. */
		maxUploadMb: string;
		/** Back to the questions of the wizard. */
		onback: () => void;
	}

	const { maxUploadMb, onback }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const UploadIcon = icons.upload;
	const RestoreIcon = icons.renew;
	const CancelIcon = icons.close;
	const BackIcon = icons.back;

	let input = $state<HTMLInputElement>();
	let checking = $state(false);
	let restoring = $state(false);
	let check = $state<Check | null>(null);
	let problem = $state<{ code: string; detail: string } | null>(null);
	let done = $state<{ accounts: string[] } | null>(null);

	/** `data:patrons` → "Utenti", `section:ui` → "Interfaccia" (the wizard has no configuration dictionary). */
	const partLabel = (id: string): string =>
		i18n.t(`setup.restore.parts.${id.slice(id.indexOf(":") + 1)}`);

	/** The text of a refusal; the missing parts are named as the pages name them. */
	function messageOf(p: { code: string; detail: string }): string {
		const name =
			p.code === "missing_parts"
				? p.detail
						.split(", ")
						.filter((id) => id !== "")
						.map(partLabel)
						.join(", ")
				: p.detail;
		return i18n.t(`setup.restore.errors.${p.code}`, { name, maxMb: maxUploadMb });
	}

	async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = "";
		if (!file || !input) {
			return;
		}
		checking = true;
		problem = null;
		check = null;
		try {
			if (
				(await submitFile(checkRestoreArchive, input, file)) &&
				checkRestoreArchive.result
			) {
				const result = checkRestoreArchive.result;
				if (result.ok) {
					check = result.check;
				} else {
					problem = { code: result.code, detail: result.detail };
				}
			}
		} catch {
			problem = { code: "failed", detail: "" };
		} finally {
			checking = false;
		}
	}

	async function restore(): Promise<void> {
		if (!check) {
			return;
		}
		restoring = true;
		problem = null;
		try {
			const result = await applyRestoreArchive({ token: check.token });
			if (result.ok) {
				done = { accounts: result.accounts };
				check = null;
			} else {
				problem = { code: result.code, detail: result.detail };
				check = null;
			}
		} catch {
			problem = { code: "failed", detail: "" };
		} finally {
			restoring = false;
		}
	}

	async function cancel(): Promise<void> {
		if (check) {
			await discardRestoreArchive({ token: check.token });
		}
		check = null;
		problem = null;
	}

	async function back(): Promise<void> {
		await cancel();
		onback();
	}
</script>

{#if done}
	<Card
		variant="outlined"
		padding="none"
		gap="4"
		as="section"
		class="p-6"
		data-testid="restore-done"
	>
		<h2 class="h3">{i18n.t("setup.restore.done.title")}</h2>
		<p>{i18n.t("setup.restore.done.hint")}</p>
		<BulletList>
			{#each done.accounts as account (account)}
				<li class="font-mono" data-testid="restore-account-{account}">{account}</li>
			{/each}
		</BulletList>
		<Row>
			<Button variant="primary" href="/login" data-testid="go-login"
				>{i18n.t("setup.restore.done.login")}</Button
			>
		</Row>
	</Card>
{:else}
	<Card
		variant="outlined"
		padding="none"
		gap="4"
		as="section"
		class="grow p-6"
		data-testid="setup-restore"
	>
		<h2 class="h3">{i18n.t("setup.restore.title")}</h2>
		<Hint>{i18n.t("setup.restore.hint", { maxMb: maxUploadMb })}</Hint>
		<Row>
			<FileButton
				icon={UploadIcon}
				accept=".zip,application/zip"
				onchange={onFile}
				disabled={checking || restoring}
				data-testid="restore-upload">{i18n.t("setup.restore.choose")}</FileButton
			>
		</Row>
		<form
			{...checkRestoreArchive}
			enctype="multipart/form-data"
			class="hidden"
			aria-hidden="true"
		>
			<input {...checkRestoreArchive.fields.archive.as("file")} bind:this={input} />
		</form>
		{#if checking}
			<Hint tone="faint">{i18n.t("setup.restore.checking")}</Hint>
		{/if}
		{#if problem}
			<Alert data-testid="restore-error">{messageOf(problem)}</Alert>
		{/if}

		{#if check}
			{@const c = check}
			<section class="space-y-3" data-testid="restore-check">
				<p class="font-semibold">
					{c.source.library
						? i18n.t("setup.restore.from", {
								library: c.source.library,
								date: c.source.createdAt ? fmt.dateTime(c.source.createdAt) : "—",
								version: c.source.version ?? "—",
							})
						: i18n.t("setup.restore.fromAnonymous", {
								date: c.source.createdAt ? fmt.dateTime(c.source.createdAt) : "—",
								version: c.source.version ?? "—",
							})}
				</p>
				<BulletList muted>
					{#each Object.entries(c.counts) as [part, n] (part)}
						{#if isDataPart(`data:${part}`)}
							<li>
								{i18n.t("setup.restore.count", {
									part: partLabel(`data:${part}`),
									count: n,
								})}
							</li>
						{/if}
					{/each}
				</BulletList>
				{#if c.photos + c.covers > 0}
					<Hint
						>{i18n.t("setup.restore.images", {
							photos: c.photos,
							covers: c.covers,
						})}</Hint
					>
				{/if}
				<p data-testid="restore-accounts">
					{i18n.t("setup.restore.accounts", { accounts: c.accounts.join(", ") })}
				</p>
				<Alert as="div" tone="warning">{i18n.t("setup.restore.warning")}</Alert>
				<Row justify="end">
					<Button icon={CancelIcon} onclick={cancel} disabled={restoring}
						>{i18n.t("setup.restore.cancel")}</Button
					>
					<Button
						variant="primary"
						icon={RestoreIcon}
						onclick={restore}
						disabled={restoring}
						data-testid="restore-apply"
						>{restoring
							? i18n.t("setup.restore.restoring")
							: i18n.t("setup.restore.apply")}</Button
					>
				</Row>
			</section>
		{/if}
	</Card>
	<Row as="footer" align="center" justify="between" gap="0" wrap={false}>
		<Button icon={BackIcon} onclick={back} disabled={restoring} data-testid="restore-back"
			>{i18n.t("setup.restore.back")}</Button
		>
	</Row>
{/if}
