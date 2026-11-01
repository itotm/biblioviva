<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Appearance and language (step 2.3b, owner request), in the owner's order: the library's name
     (11.13), its logo shown at the top left of the app (step 4.10), the installation language (the
     page reloads in the new one), the style of the areas (9.16), the colour set with a live preview
     that lasts until it is saved, refused or the page is left, the sections of the dashboard, one
     switch each (11.15). -->
<script lang="ts">
	import { onDestroy } from "svelte";
	import { refreshAll } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import { submitFile } from "#lib/ui/submit-file.js";
	import {
		getAppearance,
		getAvailableLocales,
		removeLogo,
		setDashboard,
		setLibraryName,
		setLocale,
		setTheme,
		setAreaStyle,
		uploadLogo,
	} from "#lib/remote/appearance.remote.js";
	import type { AppLocale } from "#lib/i18n/index.js";
	import { AREA_STYLES, type AreaStyle, type ThemeName } from "#lib/shared/theme-palette.js";
	import { toaster } from "#lib/ui/toaster.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import ThemeSwatches from "#lib/components/ThemeSwatches.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import { DASHBOARD_SECTIONS, type DashboardSection } from "#lib/shared/dashboard-sections.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import FileButton from "#lib/ui/FileButton.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const appearance = getAppearance();
	const locales = getAvailableLocales();
	let picked = $state<ThemeName | null>(null);
	let saving = $state(false);
	const current = $derived(appearance.current?.theme ?? null);
	const selected = $derived(picked ?? current);
	let nameDraft = $state<string | null>(null);
	const currentName = $derived(appearance.current?.libraryName ?? "");
	const name = $derived(nameDraft ?? currentName);
	let savingName = $state(false);
	let sectionsDraft = $state<Record<DashboardSection, boolean> | null>(null);
	const sections = $derived(sectionsDraft ?? appearance.current?.dashboard ?? null);
	let savingSections = $state(false);

	function toggleSection(section: DashboardSection, on: boolean): void {
		if (sections) {
			sectionsDraft = { ...sections, [section]: on };
		}
	}

	async function saveSections(): Promise<void> {
		if (!sectionsDraft) {
			toaster.info({ title: i18n.t("admin.appearance.unchanged") });
			return;
		}
		savingSections = true;
		try {
			await setDashboard(sectionsDraft);
			sectionsDraft = null;
			toaster.success({ title: i18n.t("admin.appearance.dashboard.saved") });
		} finally {
			savingSections = false;
		}
	}

	async function saveName(): Promise<void> {
		const trimmed = name.trim();
		if (!trimmed) {
			toaster.error({ title: i18n.t("admin.appearance.name.required") });
			return;
		}
		if (trimmed === currentName) {
			toaster.info({ title: i18n.t("admin.appearance.unchanged") });
			return;
		}
		savingName = true;
		try {
			await setLibraryName({ name: trimmed });
			nameDraft = null;
			// the name is in the shell (top left, dashboard): every loader sees the new one
			await refreshAll();
			toaster.success({ title: i18n.t("admin.appearance.name.saved") });
		} finally {
			savingName = false;
		}
	}
	let localeDraft = $state<AppLocale>("");
	const currentLocale = $derived(appearance.current?.locale ?? null);
	const localeChoice = $derived(localeDraft || currentLocale);
	let changingLocale = $state(false);

	async function changeLocale(): Promise<void> {
		if (!localeChoice || localeChoice === currentLocale) {
			return;
		}
		changingLocale = true;
		try {
			await setLocale({ locale: localeChoice });
			toaster.success({ title: i18n.t("admin.appearance.language.saved") });
			// one language per installation: every dictionary changes, so a full load is the honest way
			window.location.reload();
		} finally {
			changingLocale = false;
		}
	}

	const UploadIcon = icons.upload;
	const RemoveIcon = icons.delete;
	const LibraryIcon = icons.catalog;
	let logoInput = $state<HTMLInputElement>();
	const logoError = $derived(uploadLogo.fields.logo.issues()?.[0]?.message);

	async function onLogo(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		if (!file || !logoInput) {
			return;
		}
		e.currentTarget.value = "";
		if (await submitFile(uploadLogo, logoInput, file)) {
			await refreshAll();
			toaster.success({ title: i18n.t("admin.appearance.logo.saved") });
		}
	}

	async function dropLogo(): Promise<void> {
		await removeLogo();
		await refreshAll();
		toaster.success({ title: i18n.t("admin.appearance.logo.removed") });
	}

	// how the top bar shows the area (9.16): saved at once, the shell follows on the next load
	let savingStyle = $state(false);
	async function chooseStyle(style: AreaStyle): Promise<void> {
		savingStyle = true;
		try {
			await setAreaStyle({ style });
			await refreshAll();
			toaster.success({ title: i18n.t("admin.appearance.areas.saved") });
		} finally {
			savingStyle = false;
		}
	}
	/** The look of a mini bar for a style and an area (the tokens of the colour set shown). */
	function barStyle(style: AreaStyle, area: string): string {
		const v = (part: string): string => `var(--bv-area-${area}-${part})`;
		if (style === "tinted") {
			return `background:${v("tint")};box-shadow:inset 0 -4px 0 ${v("strong")}`;
		}
		if (style === "filled") {
			return `background:${v("deep")};color:#fff`;
		}
		if (style === "accents") {
			return `box-shadow:inset 5px 0 0 ${v("strong")}`;
		}
		return "";
	}
	const PREVIEW_AREAS = [
		{ key: "circulation", icon: icons.loan },
		{ key: "catalog", icon: icons.catalog },
	] as const;

	function preview(theme: ThemeName): void {
		picked = theme;
		document.documentElement.dataset.theme = theme;
	}

	/** Back to the saved colour set: a preview never outlives a refused save or the page. */
	function dropPreview(): void {
		picked = null;
		if (current) {
			document.documentElement.dataset.theme = current;
		}
	}
	onDestroy(dropPreview);

	async function save(): Promise<void> {
		if (!selected || selected === current) {
			toaster.info({ title: i18n.t("admin.appearance.unchanged") });
			return;
		}
		saving = true;
		try {
			await setTheme({ theme: selected });
			picked = null;
			await refreshAll();
			toaster.success({ title: i18n.t("admin.appearance.saved") });
		} catch (e) {
			// refused (the public demo never writes its configuration) or failed: the message
			// comes from the shared handler, the page goes back to the colours really in use
			dropPreview();
			throw e;
		} finally {
			saving = false;
		}
	}
</script>

<Page>
	<PageHeader
		title={i18n.t("admin.appearance.title")}
		icon="settings"
		backHref="/admin/config"
		backLabel={i18n.t("admin.home.sections.config.title")}
	/>

	<QueryState query={appearance}>
		{#snippet children(loaded)}
			<Card gap="3" as="section" data-testid="name-section">
				<h2 class="font-semibold">{i18n.t("admin.appearance.name.title")}</h2>
				<Hint>{i18n.t("admin.appearance.name.hint")}</Hint>
				<Row
					as="form"
					align="end"
					gap="3"
					onsubmit={(e) => {
						e.preventDefault();
						void saveName();
					}}
				>
					<Field label={i18n.t("admin.appearance.name.label")} class="max-w-md grow"
						><Input
							value={name}
							oninput={(e) => (nameDraft = e.currentTarget.value)}
							maxlength={120}
							required
							data-testid="library-name"
						/></Field
					>
					<Button
						type="submit"
						variant="primary"
						disabled={savingName || !name.trim() || name.trim() === currentName}
						data-testid="save-library-name"
						>{i18n.t("admin.appearance.name.save")}</Button
					>
				</Row>
			</Card>

			<Card gap="3" as="section" data-testid="logo-section">
				<h2 class="font-semibold">{i18n.t("admin.appearance.logo.title")}</h2>
				<Hint>{i18n.t("admin.appearance.logo.hint")}</Hint>
				<Row align="center" gap="4">
					{#if appearance.current?.logo}
						<img
							src={appearance.current.logo}
							alt={i18n.t("admin.appearance.logo.preview")}
							class="size-24 rounded-container object-contain ring-1 ring-surface-200"
							data-testid="logo-preview"
						/>
					{:else}
						<span
							class="flex size-24 items-center justify-center rounded-container preset-tonal-primary"
							title={i18n.t("admin.appearance.logo.none")}
						>
							<LibraryIcon size={ICON_SIZE.xl} aria-hidden="true" />
						</span>
					{/if}
					<Row gap="2">
						<FileButton
							icon={UploadIcon}
							accept="image/png,image/jpeg,image/webp"
							onchange={onLogo}
							data-testid="logo-file"
							>{i18n.t(
								appearance.current?.logo
									? "admin.appearance.logo.replace"
									: "admin.appearance.logo.upload",
							)}</FileButton
						>
						{#if appearance.current?.logo}
							<Button
								variant="error-tonal"
								icon={RemoveIcon}
								onclick={dropLogo}
								data-testid="logo-remove"
								>{i18n.t("admin.appearance.logo.remove")}</Button
							>
						{/if}
					</Row>
				</Row>
				{#if !appearance.current?.logo}
					<Hint>{i18n.t("admin.appearance.logo.none")}</Hint>
				{/if}
				{#if logoError}
					<Alert data-testid="logo-error">{logoError}</Alert>
				{/if}
				<form
					{...uploadLogo}
					enctype="multipart/form-data"
					class="hidden"
					aria-hidden="true"
					data-testid="logo-form"
				>
					<input {...uploadLogo.fields.logo.as("file")} bind:this={logoInput} />
				</form>
			</Card>

			<Card gap="3" as="section" data-testid="language-section">
				<h2 class="font-semibold">{i18n.t("admin.appearance.language.title")}</h2>
				<Hint>{i18n.t("admin.appearance.language.hint")}</Hint>
				<Row align="end">
					<Field label={i18n.t("setup.steps.language")} class="max-w-xs grow"
						><Select
							value={localeChoice ?? ""}
							onchange={(e) => (localeDraft = e.currentTarget.value)}
							data-testid="locale-select"
						>
							{#each locales.current ?? [] as l (l.code)}
								<option value={l.code}>{l.name}</option>
							{/each}
						</Select></Field
					>
					<Button
						variant="primary"
						onclick={changeLocale}
						disabled={changingLocale || !localeChoice || localeChoice === currentLocale}
						data-testid="save-locale">{i18n.t("admin.appearance.language.save")}</Button
					>
				</Row>
			</Card>

			<Card gap="3" as="section" data-testid="areas-section">
				<h2 class="font-semibold">{i18n.t("admin.appearance.areas.title")}</h2>
				<Hint>{i18n.t("admin.appearance.areas.hint")}</Hint>
				<div
					class="grid gap-3 sm:grid-cols-2"
					role="radiogroup"
					aria-label={i18n.t("admin.appearance.areas.title")}
				>
					{#each AREA_STYLES as style (style)}
						{@const chosen = appearance.current?.areaStyle === style}
						<button
							type="button"
							role="radio"
							aria-checked={chosen}
							disabled={savingStyle}
							onclick={() => chooseStyle(style)}
							class="space-y-2 rounded-container border p-3 text-left {chosen
								? 'border-primary-500 ring-2 ring-primary-500'
								: 'border-surface-200 hover:border-primary-300'}"
							data-testid="area-style-{style}"
						>
							<span class="block font-semibold"
								>{i18n.t(`admin.appearance.areas.styles.${style}`)}</span
							>
							{#each PREVIEW_AREAS as area (area.key)}
								{@const Icon = area.icon}
								<span
									class="flex items-center gap-2 rounded-base border border-surface-200 bg-surface-50 px-2 py-1.5 text-sm font-semibold"
									style={barStyle(style, area.key)}
								>
									<span
										class="inline-flex size-6 items-center justify-center rounded-base text-white"
										style="background:{style === 'none'
											? 'var(--color-primary-500)'
											: style === 'filled'
												? 'rgb(255 255 255 / 0.2)'
												: `var(--bv-area-${area.key}-strong)`}"
									>
										<Icon size={ICON_SIZE.sm} aria-hidden="true" />
									</span>
									{i18n.t(`nav.${area.key}`)}
								</span>
							{/each}
						</button>
					{/each}
				</div>
			</Card>

			<Card gap="3" as="section" data-testid="theme-section">
				<h2 class="font-semibold">{i18n.t("admin.appearance.colours.title")}</h2>
				<Hint data-testid="current-theme">
					{i18n.t("admin.appearance.current", {
						name: i18n.t(`setup.theme.names.${current}`),
					})}
				</Hint>
				<ThemeSwatches
					value={selected ?? loaded.theme}
					onchange={preview}
					label={i18n.t("admin.appearance.colours.title")}
				/>
				<Row>
					<Button
						variant="primary"
						onclick={save}
						disabled={saving || !selected}
						data-testid="save-theme"
						>{saving
							? i18n.t("common.status.loading")
							: i18n.t("admin.appearance.save")}</Button
					>
				</Row>
			</Card>

			{#if sections}
				<Card gap="3" as="section" data-testid="dashboard-section">
					<h2 class="font-semibold">{i18n.t("admin.appearance.dashboard.title")}</h2>
					<Hint>{i18n.t("admin.appearance.dashboard.hint")}</Hint>
					<ul class="space-y-1">
						{#each DASHBOARD_SECTIONS as section (section)}
							<li>
								<Checkbox
									class="min-h-11"
									checked={sections[section]}
									onchange={(e) =>
										toggleSection(section, e.currentTarget.checked)}
									data-testid="dashboard-{section}"
									>{i18n.t(
										`admin.appearance.dashboard.sections.${section}`,
									)}</Checkbox
								>
							</li>
						{/each}
					</ul>
					<Row>
						<Button
							variant="primary"
							onclick={saveSections}
							disabled={savingSections || !sectionsDraft}
							data-testid="save-dashboard"
							>{i18n.t("admin.appearance.dashboard.save")}</Button
						>
					</Row>
				</Card>
			{/if}
		{/snippet}
	</QueryState>
</Page>
