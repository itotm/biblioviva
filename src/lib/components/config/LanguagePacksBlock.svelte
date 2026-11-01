<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Language packs on the "Interfaccia" settings page (step 11.8): the packs of the configuration
     folder with their check against English (errors keep a pack out of the language lists,
     missing texts are shown in English), a pack uploaded as a zip and installed only without
     errors, a pack removed (never the language in use), any folder downloaded as a zip — the
     English or Italian example is where a new translation starts. The packs of the release that
     matches the installed version are listed with an install button each (step 9.39). -->
<script lang="ts">
	import { submitFile } from "#lib/ui/submit-file.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getLanguagePacks,
		getReleasePacks,
		installReleasePack,
		removeLanguagePack,
		uploadLanguagePack,
	} from "#lib/remote/integrations.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Disclosure from "#lib/ui/Disclosure.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { formatBytes } from "#lib/shared/bytes.js";
	import { icons } from "#lib/ui/icons.js";
	import { useFormat } from "#lib/ui/format.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Loading from "#lib/ui/Loading.svelte";

	const i18n = useI18n();
	const fmt = useFormat();
	const data = getLanguagePacks();
	const release = getReleasePacks();
	const UploadIcon = icons.upload;
	const DownloadIcon = icons.download;
	const RemoveIcon = icons.delete;
	const OkIcon = icons.available;
	const InfoIcon = icons.info;

	let fileInput = $state<HTMLInputElement>();
	let picker = $state<HTMLInputElement>();
	let uploading = $state(false);
	let removeOpen = $state(false);
	let removing = $state<string | null>(null);
	let installing = $state<string | null>(null);
	const installedCodes = $derived(new Set(data.current?.packs.map((p) => p.code)));
	const uploadError = $derived(uploadLanguagePack.fields.pack.issues()?.[0]?.message);

	async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = "";
		if (!file || !fileInput) {
			return;
		}
		uploading = true;
		try {
			if (
				(await submitFile(uploadLanguagePack, fileInput, file)) &&
				uploadLanguagePack.result
			) {
				const pack = uploadLanguagePack.result.pack;
				toaster.success({
					title: i18n.t("config.languages.installed", {
						name: pack.nativeName ?? pack.code,
					}),
					description:
						pack.warnings > 0
							? i18n.t("config.languages.warnings", { count: pack.warnings })
							: undefined,
				});
			}
		} finally {
			uploading = false;
		}
	}

	async function install(code: string, nativeName: string): Promise<void> {
		installing = code;
		try {
			const result = await installReleasePack({ code });
			if (result.ok) {
				toaster.success({
					title: i18n.t("config.languages.installed", { name: nativeName }),
					description:
						result.pack.warnings > 0
							? i18n.t("config.languages.warnings", { count: result.pack.warnings })
							: undefined,
				});
			} else {
				toaster.error({
					title: i18n.t(`config.languages.errors.${result.code}`, {
						details: result.details,
						maxMb: data.current?.maxMb ?? "",
					}),
				});
			}
		} finally {
			installing = null;
		}
	}

	async function remove(): Promise<void> {
		if (!removing) {
			return;
		}
		const result = await removeLanguagePack({ code: removing });
		if (result.ok) {
			toaster.success({ title: i18n.t("config.languages.removed") });
		} else {
			toaster.error({ title: i18n.t(`config.languages.errors.${result.code}`) });
		}
	}
</script>

{#snippet releaseLink(url: string)}
	<p class="text-sm">
		<a
			class="anchor"
			href={url}
			rel="external noreferrer"
			target="_blank"
			data-testid="release-page">{i18n.t("config.languages.release.page")}</a
		>
	</p>
{/snippet}

<Card variant="outlined" gap="3" id="language-packs" data-testid="block-languagePacks">
	<h2 class="title-lg">{i18n.t("config.languages.title")}</h2>
	<Hint>{i18n.t("config.languages.hint")}</Hint>
	<form {...uploadLanguagePack} enctype="multipart/form-data" class="hidden" aria-hidden="true">
		<input {...uploadLanguagePack.fields.pack.as("file")} bind:this={fileInput} />
	</form>
	<input
		type="file"
		class="hidden"
		aria-hidden="true"
		tabindex="-1"
		accept=".zip,application/zip"
		bind:this={picker}
		onchange={onFile}
		data-testid="pack-input"
	/>
	{#if data.current}
		{#if data.current.packs.length === 0}
			<Hint tone="faint">{i18n.t("config.languages.none")}</Hint>
		{:else}
			<ul class="space-y-2">
				{#each data.current.packs as p (p.code)}
					<li
						class="space-y-2 rounded-base border border-surface-200 p-3"
						data-testid="pack-{p.code}"
					>
						<Row justify="between" align="center">
							<div>
								<p class="font-semibold">
									{p.nativeName ?? p.code}
									<Hint as="span" mono>{p.code}</Hint>
								</p>
								<Row gap="1">
									{#if p.valid}
										<Badge tone="success"
											>{i18n.t("config.languages.valid")}</Badge
										>
									{:else}
										<Badge tone="error"
											>{i18n.t("config.languages.errorsCount", {
												count: p.errors,
											})}</Badge
										>
									{/if}
									{#if p.warnings > 0}
										<Badge tone="warning"
											>{i18n.t("config.languages.warnings", {
												count: p.warnings,
											})}</Badge
										>
									{/if}
									{#if p.inUse}
										<Badge tone="primary"
											>{i18n.t("config.languages.inUse")}</Badge
										>
									{/if}
								</Row>
							</div>
							<Row gap="2">
								<Button
									size="sm"
									icon={DownloadIcon}
									href="/admin/config/languages/{p.code}"
									download>{i18n.t("config.languages.download")}</Button
								>
								<Button
									size="sm"
									variant="error-outlined"
									icon={RemoveIcon}
									disabled={p.inUse}
									onclick={() => {
										removing = p.code;
										removeOpen = true;
									}}
									data-testid="pack-remove"
									>{i18n.t("common.actions.delete")}</Button
								>
							</Row>
						</Row>
						{#if p.problems.length > 0}
							<Disclosure summary={i18n.t("config.languages.report")}>
								<BulletList muted>
									{#each p.problems as line, i (i)}<li>{line}</li>{/each}
								</BulletList>
							</Disclosure>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		<section class="space-y-2" data-testid="release-packs">
			<h3 class="title-md">{i18n.t("config.languages.release.title")}</h3>
			<Hint>{i18n.t("config.languages.release.hint")}</Hint>
			{#if !release.current}
				<Loading />
			{:else if release.current.state === "demo"}
				<Hint tone="faint">{i18n.t("common.demoPublic.blocked.languagePacks")}</Hint>
			{:else if release.current.state === "unavailable"}
				<Alert tone="warning" icon={icons.cloudOff} data-testid="release-unavailable">
					{i18n.t("config.languages.release.unavailable")}
				</Alert>
				{#if release.current.releaseUrl}
					{@render releaseLink(release.current.releaseUrl)}
				{/if}
			{:else}
				<ul class="space-y-2">
					{#each release.current.packs as p (p.code)}
						{@const done = p.installed || installedCodes.has(p.code)}
						<li
							class="rounded-base border border-surface-200 p-3"
							data-testid="release-pack-{p.code}"
						>
							<Row justify="between" align="center">
								<div class="space-y-1">
									<p class="font-semibold">
										{p.nativeName}
										<Hint as="span" mono>{p.code}</Hint>
									</p>
									<Hint>
										{i18n.t("config.languages.release.percent", {
											percent: p.percent,
										})} · {formatBytes(p.bytes, fmt.locale)}
									</Hint>
									<Row gap="1">
										{#if p.translation === "machine"}
											<Badge tone="warning" icon={InfoIcon}
												>{i18n.t("config.languages.release.machine")}</Badge
											>
										{:else}
											<Badge tone="success" icon={OkIcon}
												>{i18n.t(
													"config.languages.release.reviewed",
												)}</Badge
											>
										{/if}
										{#if done}
											<Badge tone="primary" icon={OkIcon}
												>{i18n.t(
													"config.languages.release.installedBadge",
												)}</Badge
											>
										{/if}
									</Row>
								</div>
								<Button
									variant={done ? "tonal" : "primary"}
									icon={DownloadIcon}
									disabled={installing !== null}
									onclick={() => install(p.code, p.nativeName)}
									data-testid="release-install"
									>{i18n.t(
										done
											? "config.languages.release.again"
											: "config.languages.release.install",
									)}</Button
								>
							</Row>
						</li>
					{/each}
				</ul>
				{#if release.current.releaseUrl}
					{@render releaseLink(release.current.releaseUrl)}
				{/if}
			{/if}
		</section>
		{#if uploadError}
			<Alert data-testid="pack-error">{uploadError}</Alert>
		{/if}
		<Row align="center" gap="2">
			<Button
				icon={UploadIcon}
				onclick={() => picker?.click()}
				disabled={uploading}
				data-testid="pack-upload">{i18n.t("config.languages.upload")}</Button
			>
			<Hint as="span" tone="faint"
				>{i18n.t("config.languages.uploadHint", { maxMb: data.current.maxMb })}</Hint
			>
		</Row>
		<Row gap="2" align="center">
			<Hint as="span">{i18n.t("config.languages.examples")}</Hint>
			{#each data.current.folders.filter((f) => !data.current?.packs.some((p) => p.code === f)) as f (f)}
				<Button size="sm" icon={DownloadIcon} href="/admin/config/languages/{f}" download
					>{f}</Button
				>
			{/each}
		</Row>
	{:else}
		<Loading />
	{/if}
</Card>

<ConfirmDialog
	bind:open={removeOpen}
	title={i18n.t("config.languages.removeTitle", { code: removing ?? "" })}
	description={i18n.t("config.languages.removeHint")}
	tone="error"
	confirmLabel={i18n.t("common.actions.delete")}
	onconfirm={remove}
/>
