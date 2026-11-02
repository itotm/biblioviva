<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Adding a language where the language is chosen (Appearance and language): a drop-down of the
     languages the release published on GitHub that are not installed yet, one button that
     downloads and installs the chosen one, and the upload of a pack zip (an installation without
     internet, a pack made by hand) with the link to the release page where the zips can be
     downloaded. Every pack is checked like in the packs block of the settings (step 9.39). The
     first-run wizard shows it too, with the functions of the setup mode (step 9.48). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getLanguagePacks,
		getReleasePacks,
		installReleasePack,
		uploadLanguagePack,
	} from "#lib/remote/integrations.remote.js";
	import {
		getSetupLanguagePacks,
		getSetupReleasePacks,
		installSetupReleasePack,
		uploadSetupLanguagePack,
	} from "#lib/remote/setup-language.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Loading from "#lib/ui/Loading.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { submitFile } from "#lib/ui/submit-file.js";
	import { toaster } from "#lib/ui/toaster.js";

	interface Props {
		/** Called with the code of a pack just installed, to refresh the list of languages. */
		oninstalled?: (code: string) => void;
		/** The first-run wizard (9.48): no account yet, the functions of the setup mode. */
		setup?: boolean;
	}

	let { oninstalled, setup = false }: Props = $props();

	const i18n = useI18n();
	// svelte-ignore state_referenced_locally
	const data = setup ? getSetupLanguagePacks() : getLanguagePacks();
	// svelte-ignore state_referenced_locally
	const release = setup ? getSetupReleasePacks() : getReleasePacks();
	// svelte-ignore state_referenced_locally
	const upload = setup ? uploadSetupLanguagePack : uploadLanguagePack;
	// svelte-ignore state_referenced_locally
	const installRelease = setup ? installSetupReleasePack : installReleasePack;
	const UploadIcon = icons.upload;
	const DownloadIcon = icons.download;
	const InfoIcon = icons.info;

	let choice = $state("");
	let installing = $state(false);
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let picker = $state<HTMLInputElement>();

	const installedCodes = $derived(new Set(data.current?.packs.map((p) => p.code)));
	const offered = $derived(
		release.current?.state === "ok"
			? release.current.packs.filter((p) => !p.installed && !installedCodes.has(p.code))
			: [],
	);
	const chosen = $derived(offered.find((p) => p.code === choice));
	/** A refusal of the setup mode, which answers with a code (the wizard's language is the page's). */
	let refusedUpload = $state<string | null>(null);
	const uploadError = $derived(refusedUpload ?? upload.fields.pack.issues()?.[0]?.message);

	const refusalText = (code: string, details: string): string =>
		i18n.t(`config.languages.errors.${code}`, { details, maxMb: data.current?.maxMb ?? "" });

	function installedToast(name: string, warnings: number): void {
		toaster.success({
			title: i18n.t("config.languages.installed", { name }),
			description:
				warnings > 0 ? i18n.t("config.languages.warnings", { count: warnings }) : undefined,
		});
	}

	async function install(): Promise<void> {
		if (!chosen) {
			return;
		}
		// the command refreshes the lists: the pack is no longer offered when it returns
		const { code, nativeName } = chosen;
		installing = true;
		try {
			const result = await installRelease({ code });
			if (result.ok) {
				installedToast(nativeName, result.pack.warnings);
				choice = "";
				oninstalled?.(code);
			} else {
				toaster.error({ title: refusalText(result.code, result.details) });
			}
		} finally {
			installing = false;
		}
	}

	async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = "";
		if (!file || !fileInput) {
			return;
		}
		uploading = true;
		refusedUpload = null;
		try {
			if ((await submitFile(upload, fileInput, file)) && upload.result) {
				const result = upload.result;
				if ("ok" in result && !result.ok) {
					refusedUpload = refusalText(result.code, result.details);
					return;
				}
				const pack = result.pack;
				installedToast(pack.nativeName ?? pack.code, pack.warnings);
				oninstalled?.(pack.code);
			}
		} finally {
			uploading = false;
		}
	}
</script>

{#snippet releaseLink(url: string)}
	<a
		class="anchor text-sm"
		href={url}
		rel="external noreferrer"
		target="_blank"
		data-testid="release-page">{i18n.t("admin.appearance.language.add.page")}</a
	>
{/snippet}

<section class="space-y-3" data-testid="language-add">
	<h3 class="title-md">{i18n.t("admin.appearance.language.add.title")}</h3>
	<Hint>{i18n.t("admin.appearance.language.add.hint")}</Hint>

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
		{#if offered.length === 0}
			<Hint tone="faint" data-testid="release-all-installed"
				>{i18n.t("admin.appearance.language.add.allInstalled")}</Hint
			>
		{:else}
			<Row align="end">
				<Field label={i18n.t("admin.appearance.language.add.select")} class="max-w-xs grow"
					><Select bind:value={choice} data-testid="release-select">
						<option value="">{i18n.t("admin.appearance.language.add.choose")}</option>
						{#each offered as p (p.code)}
							<option value={p.code}>{p.nativeName} ({p.code})</option>
						{/each}
					</Select></Field
				>
				<Button
					variant="primary"
					icon={DownloadIcon}
					disabled={!chosen || installing}
					onclick={install}
					data-testid="release-install"
					>{i18n.t("config.languages.release.install")}</Button
				>
			</Row>
			{#if chosen}
				<Row gap="1" align="center">
					<Hint as="span"
						>{i18n.t("config.languages.release.percent", {
							percent: chosen.percent,
						})}</Hint
					>
					{#if chosen.translation === "machine"}
						<Badge tone="warning" icon={InfoIcon}
							>{i18n.t("config.languages.release.machine")}</Badge
						>
					{:else}
						<Badge tone="success" icon={icons.available}
							>{i18n.t("config.languages.release.reviewed")}</Badge
						>
					{/if}
				</Row>
			{/if}
		{/if}
		{#if release.current.releaseUrl}
			{@render releaseLink(release.current.releaseUrl)}
		{/if}
	{/if}

	<form {...upload} enctype="multipart/form-data" class="hidden" aria-hidden="true">
		<input {...upload.fields.pack.as("file")} bind:this={fileInput} />
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
			>{i18n.t("config.languages.uploadHint", { maxMb: data.current?.maxMb ?? "" })}</Hint
		>
	</Row>
</section>
