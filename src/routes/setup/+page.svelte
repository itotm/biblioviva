<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	First-run wizard (PLAN.md step 1.11, 12.8): language → colours → library → school (classes,
	class label, reading levels) → codes (copy and card formats) → demo data → passwords → summary.
	The demo data follow the school and the codes chosen. Unauthenticated, reachable only while the
	setup is not completed.
-->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import type { AppLocale } from "#lib/i18n/index.js";
	import { completeSetup } from "#lib/remote/setup.remote.js";
	import { generatePassword } from "#lib/shared/password.js";
	import { buildCodeTable, codeExamples } from "#lib/shared/barcodes/table.js";
	import type { CheckAlgorithm } from "#lib/shared/barcodes/check.js";
	import type { KeyboardLayout } from "#lib/shared/barcodes/layouts.js";
	import type { CodePreset } from "#lib/shared/barcodes/presets.js";
	import { expandGroupNames } from "#lib/shared/class-names.js";
	import { classLabel as labelOf, groupLabel } from "#lib/shared/school.js";
	import {
		classLabelChoices,
		layoutForLocale,
		stageChoices,
		wizardCodeFormats,
		wizardGroups,
		wizardReadingLevels,
		type StageChoice,
		type WizardPreset,
	} from "#lib/shared/setup-school.js";
	import { CHECK_ALGORITHMS } from "#lib/shared/barcodes/check.js";
	import { KEYBOARD_LAYOUTS } from "#lib/shared/barcodes/layouts.js";
	import { CODE_PRESETS } from "#lib/shared/barcodes/presets.js";
	import Badge from "#lib/ui/Badge.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import type { ThemeName } from "#lib/shared/theme-palette.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import logoMark from "#lib/assets/logo-mark.webp";
	import FirstRunRestore from "#lib/components/FirstRunRestore.svelte";
	import ThemeSwatches from "#lib/components/ThemeSwatches.svelte";
	import Steps from "#lib/ui/Steps.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Field from "#lib/ui/Field.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const RefreshIcon = icons.renew;
	const RestoreIcon = icons.backup;

	// the demo choice comes before the passwords: with demo data they are simple and shared (9.13)
	// the school and the codes come before the demo data, which are generated from them (12.8)
	const STEPS = [
		"language",
		"theme",
		"library",
		"school",
		"codes",
		"demo",
		"passwords",
		"summary",
	] as const;

	// The wizard state starts from the server defaults once; later loads (language switch) must not
	// overwrite what the operator already typed.
	// svelte-ignore state_referenced_locally
	const initial = data;
	let step = $state(0);
	let locale = $state<AppLocale>(initial.defaults.locale);
	let theme = $state<ThemeName>(initial.defaults.theme);
	let libraryName = $state(initial.defaults.libraryName);
	// patron photos and book covers (9.38): on unless the school does without them
	let photos = $state(true);
	let covers = $state(true);
	// the school (12.8): a preset, then its classes, label and reading levels
	let schoolPreset = $state(initial.defaults.schoolPreset);
	const presetOf = (id: string): WizardPreset | undefined =>
		data.defaults.presets.find((p) => p.id === id);
	const preset = $derived(presetOf(schoolPreset) ?? data.defaults.presets[0]);
	let stageNames = $state<Record<string, string>>({});
	let stageModes = $state<Record<string, StageChoice["mode"]>>({});
	let teacherGroupName = $state("");
	let classTemplate = $state("{level} {group}");
	let byReadingLevel = $state(true);
	// the school year the country keeps (9.41): its first day and how it is named
	let schoolYearStart = $state("09-01");
	let schoolYearLabel = $state<"span" | "start">("span");
	const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
	function choosePreset(id: string): void {
		schoolPreset = id;
		const p = presetOf(id);
		if (!p) {
			return;
		}
		const choices = stageChoices(p);
		stageNames = Object.fromEntries(choices.map((c) => [c.code, c.names.join(", ")]));
		stageModes = Object.fromEntries(choices.map((c) => [c.code, c.mode]));
		teacherGroupName = p.teacherGroup;
		classTemplate = p.classLabel;
		byReadingLevel = p.readingLevels.length > 0;
		schoolYearStart = p.schoolYear.start;
		schoolYearLabel = p.schoolYear.label;
	}
	choosePreset(initial.defaults.schoolPreset);
	/** The names typed for a stage ("A-D" → A, B, C, D); null when they cannot be read. */
	const namesOf = (code: string): string[] | null => {
		const text = (stageNames[code] ?? "").trim();
		return text === "" ? [] : expandGroupNames(text);
	};
	const stages = $derived(
		(preset?.stages ?? []).map((st) => ({
			code: st.code,
			mode: stageModes[st.code] ?? "perLevel",
			names: namesOf(st.code) ?? [],
		})),
	);
	const groups = $derived(preset ? wizardGroups(preset.levels, stages) : []);
	const schoolStructure = $derived({
		stages: preset?.stages ?? [],
		levels: preset?.levels ?? [],
		classLabel: classTemplate,
	});
	const groupLabels = $derived(
		groups.map((g) => groupLabel(schoolStructure, { kind: "students", ...g })),
	);
	const readingLevels = $derived(preset ? wizardReadingLevels(preset, byReadingLevel) : []);
	const exampleLevel = $derived(
		preset?.levels.find((l) => (stageModes[l.stage] ?? "perLevel") === "perLevel") ??
			preset?.levels[0],
	);
	const labelExample = (template: string): string =>
		labelOf(
			{ stages: preset?.stages ?? [], levels: preset?.levels ?? [], classLabel: template },
			{ kind: "students", name: "B" },
			exampleLevel?.code ?? null,
		);
	const schoolValid = $derived(
		teacherGroupName.trim().length > 0 &&
			MONTH_DAY.test(schoolYearStart) &&
			(preset?.stages ?? []).every((st) => namesOf(st.code) !== null),
	);
	// the codes (12.8): a pair of formats, the check character, the scanners' keyboard
	let itemPreset = $state<CodePreset>(initial.defaults.codes.item);
	let cardPreset = $state<CodePreset>(initial.defaults.codes.card);
	let codeCheck = $state<CheckAlgorithm>(initial.defaults.codes.check);
	let codeLayout = $state<KeyboardLayout>(initial.defaults.codes.layout);
	// the scanners' keyboard follows the language chosen until the operator picks one
	let layoutPicked = false;
	const codeResult = $derived(
		wizardCodeFormats({
			item: itemPreset,
			card: cardPreset,
			check: codeCheck,
			layout: codeLayout,
		}),
	);
	const examples = $derived(codeExamples(buildCodeTable(codeResult.formats), data.libraryYear));
	const countryName = (code: string): string => {
		if (code === "") {
			return i18n.t("setup.school.otherCountries");
		}
		try {
			return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
		} catch {
			return code;
		}
	};
	const countries = $derived([...new Set(data.defaults.presets.map((p) => p.country))]);
	const passwords = $state({ ...initial.passwords });
	let demo = $state(initial.demoPreselected && !initial.hasData);
	// with the demo data every account shares one simple password; without, the generated ones
	function onDemo(on: boolean): void {
		demo = on;
		for (const account of initial.accounts) {
			passwords[account] = on ? initial.demoPassword : initial.passwords[account];
		}
	}
	if (initial.demoPreselected && !initial.hasData) {
		onDemo(true);
	}
	// the other way of the first screen (9.43): a library restored from a backup, no questions
	let restoring = $state(false);
	let working = $state(false);
	let errorMessage = $state<string | null>(null);
	let done = $state<{ demo: Record<string, number> | null } | null>(null);

	const passwordsValid = $derived(Object.values(passwords).every((p) => p.trim().length >= 8));
	const stepValid = $derived(
		[
			true,
			true,
			libraryName.trim().length > 0,
			schoolValid,
			codeResult.issues.length === 0,
			true,
			passwordsValid,
			true,
		][step] ?? true,
	);

	async function chooseLocale(next: AppLocale): Promise<void> {
		locale = next;
		if (!layoutPicked) {
			codeLayout = layoutForLocale(next);
		}
		const before = preset?.teacherGroup;
		// the wizard itself switches language right away (?lang= is honoured in setup mode)
		await goto(resolve(`setup?lang=${next}`), { replace: true });
		// the presets come back named and ordered in the new language (9.41): the teachers group of
		// the generic type follows it, unless the operator wrote another name
		if (teacherGroupName === before) {
			teacherGroupName = preset?.teacherGroup ?? teacherGroupName;
		}
	}

	function chooseTheme(next: ThemeName): void {
		theme = next;
		document.documentElement.dataset.theme = next; // live preview
	}

	async function finish(): Promise<void> {
		working = true;
		errorMessage = null;
		try {
			const result = await completeSetup({
				locale,
				theme,
				libraryName: libraryName.trim(),
				school: {
					preset: schoolPreset,
					stages,
					teacherGroupName: teacherGroupName.trim(),
					classLabel: classTemplate,
					readingLevels: byReadingLevel,
					schoolYearStart,
					schoolYearLabel,
				},
				codes: { item: itemPreset, card: cardPreset, check: codeCheck, layout: codeLayout },
				features: { photos, covers },
				passwords,
				demo,
			});
			done = { demo: result.demo ? { ...result.demo } : null };
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : String(e);
		} finally {
			working = false;
		}
	}
</script>

<svelte:head><title>{i18n.t("setup.title")} · {i18n.t("common.app.name")}</title></svelte:head>

<Page class="flex min-h-svh max-w-3xl flex-col gap-6">
	<Row wrap={false} align="center" gap="3" as="header">
		<img src={logoMark} alt="" width="64" height="64" class="size-16" />
		<div>
			<h1 class="h2">{done ? i18n.t("setup.done.title") : i18n.t("setup.title")}</h1>
			{#if !done}<p class="opacity-70">{i18n.t("setup.intro")}</p>{/if}
		</div>
	</Row>

	{#if done}
		<Card
			variant="outlined"
			padding="none"
			gap="4"
			as="section"
			class="p-6"
			data-testid="setup-done"
		>
			<p>{i18n.t("setup.done.hint")}</p>
			<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-sm">
				{#each data.accounts as account (account)}
					<dt class="font-sans opacity-70">{account}</dt>
					<dd data-testid="pw-{account}">{passwords[account]}</dd>
				{/each}
			</dl>
			{#if done.demo}
				<p class="text-sm" data-testid="setup-demo-summary">
					{i18n.t("setup.done.demoLoaded", done.demo)}
				</p>
			{/if}
			<Hint>{i18n.t("setup.summary.later")}</Hint>
			<Button variant="primary" href="/login" data-testid="go-login"
				>{i18n.t("setup.done.login")}</Button
			>
		</Card>
	{:else if restoring}
		<FirstRunRestore maxUploadMb={data.maxUploadMb} onback={() => (restoring = false)} />
	{:else}
		<Steps
			steps={STEPS.map((key) => ({ key, label: i18n.t(`setup.steps.${key}`) }))}
			current={step}
			label={i18n.t("setup.stepOf", { step: step + 1, total: STEPS.length })}
			testid="setup-steps"
		/>

		<Card
			variant="outlined"
			padding="none"
			gap="4"
			as="section"
			class="grow p-6"
			data-testid="setup-step-{STEPS[step]}"
		>
			{#if step === 0}
				<h2 class="h3">{i18n.t("setup.language.title")}</h2>
				<p class="opacity-70">{i18n.t("setup.language.hint")}</p>
				<Grid
					from="sm"
					gap="3"
					role="radiogroup"
					aria-label={i18n.t("setup.steps.language")}
				>
					{#each data.locales as l (l.code)}
						<button
							type="button"
							role="radio"
							aria-checked={locale === l.code}
							class="btn justify-start py-4 text-lg {locale === l.code
								? 'preset-filled-primary-500'
								: 'preset-outlined-surface-200-800'}"
							onclick={() => chooseLocale(l.code)}
							data-testid="locale-{l.code}"
						>
							{l.name}
						</button>
					{/each}
				</Grid>
				<section
					class="space-y-3 border-t border-surface-200-800 pt-4"
					data-testid="setup-restore-offer"
				>
					<h3 class="h4">{i18n.t("setup.language.restore.title")}</h3>
					<Hint>{i18n.t("setup.language.restore.hint")}</Hint>
					<Row>
						<Button
							icon={RestoreIcon}
							onclick={() => (restoring = true)}
							data-testid="setup-restore-start"
							>{i18n.t("setup.language.restore.button")}</Button
						>
					</Row>
				</section>
			{:else if step === 1}
				<h2 class="h3">{i18n.t("setup.theme.title")}</h2>
				<p class="opacity-70">{i18n.t("setup.theme.hint")}</p>
				<ThemeSwatches
					value={theme}
					onchange={chooseTheme}
					label={i18n.t("setup.steps.theme")}
				/>
			{:else if step === 2}
				<h2 class="h3">{i18n.t("setup.library.title")}</h2>
				<Field label={i18n.t("setup.library.name")}
					><Input
						type="text"
						bind:value={libraryName}
						placeholder={i18n.t("setup.library.namePlaceholder")}
						required
						maxlength={120}
					/></Field
				>
				<div class="space-y-1">
					<Checkbox bind:checked={photos} data-testid="setup-photos"
						>{i18n.t("setup.library.photos")}</Checkbox
					>
					<Hint>{i18n.t("setup.library.photosHint")}</Hint>
				</div>
				<div class="space-y-1">
					<Checkbox bind:checked={covers} data-testid="setup-covers"
						>{i18n.t("setup.library.covers")}</Checkbox
					>
					<Hint>{i18n.t("setup.library.coversHint")}</Hint>
				</div>
			{:else if step === 3}
				<h2 class="h3">{i18n.t("setup.school.title")}</h2>
				<p class="opacity-70">{i18n.t("setup.school.hint")}</p>
				<Field
					label={i18n.t("setup.library.schoolType")}
					hint={i18n.t("setup.library.schoolTypeHint")}
					><Select
						value={schoolPreset}
						onchange={(e) => choosePreset(e.currentTarget.value)}
						data-testid="setup-school-preset"
					>
						{#each countries as country (country)}
							<optgroup label={countryName(country)}>
								{#each data.defaults.presets.filter((p) => p.country === country) as p (p.id)}
									<option value={p.id}>{p.name}</option>
								{/each}
							</optgroup>
						{/each}
					</Select></Field
				>
				{#each preset?.stages ?? [] as st (st.code)}
					{@const readable = namesOf(st.code) !== null}
					<Field
						label={i18n.t(`setup.school.names.${stageModes[st.code] ?? "perLevel"}`, {
							stage: st.name,
						})}
						hint={i18n.t("setup.school.namesHint")}
						errors={readable ? [] : [i18n.t("setup.school.namesInvalid")]}
						><Input
							bind:value={stageNames[st.code]}
							maxlength={200}
							autocomplete="off"
							data-testid="setup-stage-{st.code}"
						/></Field
					>
				{/each}
				<div class="space-y-1" data-testid="setup-classes">
					<Hint>{i18n.t("setup.school.classes", { count: groups.length })}</Hint>
					<Row gap="1">
						{#each groupLabels.slice(0, 40) as label, i (i)}<Badge>{label}</Badge
							>{/each}
						{#if groupLabels.length > 40}<Badge
								>{i18n.t("setup.school.more", {
									count: groupLabels.length - 40,
								})}</Badge
							>{/if}
					</Row>
				</div>
				<Grid from="sm" gap="3">
					<Field label={i18n.t("setup.school.classLabel")}
						><Select bind:value={classTemplate} data-testid="setup-class-label">
							{#each preset ? classLabelChoices(preset) : [] as template (template)}
								<option value={template}>{labelExample(template)}</option>
							{/each}
						</Select></Field
					>
					<Field
						label={i18n.t("setup.school.teacherGroup")}
						hint={i18n.t("setup.school.teacherGroupHint")}
						><Input
							bind:value={teacherGroupName}
							maxlength={40}
							data-testid="setup-teacher-group"
						/></Field
					>
					<Field
						label={i18n.t("setup.school.schoolYearStart")}
						hint={i18n.t("setup.school.schoolYearStartHint")}
						errors={MONTH_DAY.test(schoolYearStart)
							? []
							: [i18n.t("setup.school.schoolYearStartInvalid")]}
						><Input
							bind:value={schoolYearStart}
							maxlength={5}
							mono
							data-testid="setup-school-year-start"
						/></Field
					>
					<Field label={i18n.t("setup.school.schoolYearLabel")}
						><Select bind:value={schoolYearLabel} data-testid="setup-school-year-label">
							<option value="span"
								>{i18n.t("setup.school.schoolYearLabels.span")}</option
							>
							<option value="start"
								>{i18n.t("setup.school.schoolYearLabels.start")}</option
							>
						</Select></Field
					>
				</Grid>
				<div class="space-y-1">
					<Checkbox bind:checked={byReadingLevel} data-testid="setup-reading-levels"
						>{i18n.t("setup.school.readingLevels")}</Checkbox
					>
					{#if readingLevels.length > 0}
						<Row gap="1">
							{#each readingLevels as l (l.code)}<Badge tone="primary"
									>{l.label}</Badge
								>{/each}
						</Row>
					{/if}
					<Hint tone="faint">{i18n.t("setup.school.readingLevelsHint")}</Hint>
				</div>
			{:else if step === 4}
				<h2 class="h3">{i18n.t("setup.codes.title")}</h2>
				<p class="opacity-70">{i18n.t("setup.codes.hint")}</p>
				<Grid from="sm" gap="3">
					<Field label={i18n.t("setup.codes.itemFormat")}
						><Select bind:value={itemPreset} data-testid="setup-code-item">
							{#each CODE_PRESETS as p (p)}
								<option value={p}>{i18n.t(`setup.codes.itemFormats.${p}`)}</option>
							{/each}
						</Select></Field
					>
					<Field label={i18n.t("setup.codes.cardFormat")}
						><Select bind:value={cardPreset} data-testid="setup-code-card">
							{#each CODE_PRESETS as p (p)}
								<option value={p}>{i18n.t(`setup.codes.cardFormats.${p}`)}</option>
							{/each}
						</Select></Field
					>
					<Field label={i18n.t("setup.codes.check")}
						><Select bind:value={codeCheck} data-testid="setup-code-check">
							{#each CHECK_ALGORITHMS as c (c)}
								<option value={c}>{i18n.t(`setup.codes.checks.${c}`)}</option>
							{/each}
						</Select></Field
					>
					<Field
						label={i18n.t("setup.codes.layout")}
						hint={i18n.t("setup.codes.layoutHint")}
						><Select
							bind:value={codeLayout}
							onchange={() => (layoutPicked = true)}
							data-testid="setup-code-layout"
						>
							{#each KEYBOARD_LAYOUTS as l (l)}
								<option value={l}>{i18n.t(`setup.codes.layouts.${l}`)}</option>
							{/each}
						</Select></Field
					>
				</Grid>
				<dl
					class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2"
					data-testid="setup-code-examples"
				>
					{#each [{ key: "item", label: i18n.t("setup.codes.copy"), code: examples.item }, { key: "card", label: i18n.t("setup.codes.card"), code: examples.card }] as ex (ex.key)}
						<dt class="opacity-70">{ex.label}</dt>
						<dd
							class="font-mono text-lg font-semibold"
							data-testid="setup-example-{ex.key}"
						>
							{ex.code}
						</dd>
					{/each}
				</dl>
				{#if codeResult.issues.length === 0}
					<Alert tone="success" data-testid="setup-code-verdict"
						>{i18n.t("setup.codes.verdict")}</Alert
					>
				{:else}
					<Alert data-testid="setup-code-verdict">{i18n.t("setup.codes.refused")}</Alert>
				{/if}
				<Hint tone="faint">{i18n.t("setup.codes.later")}</Hint>
			{:else if step === 5}
				<h2 class="h3">{i18n.t("setup.demo.title")}</h2>
				<p class="opacity-70">{i18n.t("setup.demo.hint")}</p>
				{#if data.hasData}
					<Alert tone="warning">
						{i18n.t("setup.demo.hasData")}
					</Alert>
				{:else}
					<Row wrap={false} align="center" gap="3" as="label">
						<input
							class="checkbox"
							type="checkbox"
							checked={demo}
							onchange={(e) => onDemo(e.currentTarget.checked)}
							data-testid="demo-checkbox"
						/>
						<span>{i18n.t("setup.demo.load")}</span>
					</Row>
				{/if}
			{:else if step === 6}
				<h2 class="h3">{i18n.t("setup.passwords.title")}</h2>
				{#if demo}
					<Alert tone="warning" data-testid="demo-passwords">
						{i18n.t("setup.passwords.demo", { password: initial.demoPassword })}
					</Alert>
				{:else}
					<p class="opacity-70">{i18n.t("setup.passwords.hint")}</p>
				{/if}
				{#each data.accounts as account (account)}
					<label class="label">
						<span class="label-text"
							>{i18n.t(`setup.passwords.accounts.${String(account)}`)}</span
						>
						<span class="input-group joined grid-cols-[1fr_auto]">
							<input
								class="ig-input font-mono"
								type="text"
								bind:value={passwords[account]}
								readonly={demo}
								autocomplete="off"
								spellcheck={false}
								minlength="8"
								required
								aria-invalid={passwords[account].trim().length < 8
									? "true"
									: undefined}
							/>
							<button
								type="button"
								class="ig-btn preset-tonal"
								disabled={demo}
								onclick={() => (passwords[account] = generatePassword())}
								aria-label={i18n.t("setup.passwords.regenerate")}
								title={i18n.t("setup.passwords.regenerate")}
							>
								<RefreshIcon size={ICON_SIZE.sm} aria-hidden="true" />
							</button>
						</span>
						{#if passwords[account].trim().length < 8}<Hint tone="error" as="span"
								>{i18n.t("setup.passwords.tooShort")}</Hint
							>{/if}
					</label>
				{/each}
			{:else}
				<h2 class="h3">{i18n.t("setup.summary.title")}</h2>
				<p class="opacity-70">{i18n.t("setup.summary.hint")}</p>
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					<dt class="opacity-70">{i18n.t("setup.summary.language")}</dt>
					<dd>{data.locales.find((l) => l.code === locale)?.name ?? locale}</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.theme")}</dt>
					<dd>{i18n.t(`setup.theme.names.${theme}`)}</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.library")}</dt>
					<dd>{libraryName}</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.photos")}</dt>
					<dd data-testid="setup-summary-photos">
						{i18n.t(photos ? "setup.summary.yes" : "setup.summary.no")}
					</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.covers")}</dt>
					<dd data-testid="setup-summary-covers">
						{i18n.t(covers ? "setup.summary.yes" : "setup.summary.no")}
					</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.school")}</dt>
					<dd>
						{preset?.name ?? schoolPreset}
					</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.classes")}</dt>
					<dd data-testid="setup-summary-classes">
						{i18n.t("setup.summary.classesValue", {
							count: groups.length,
							first: groupLabels[0] ?? "",
							teachers: teacherGroupName,
						})}
					</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.readingLevels")}</dt>
					<dd>
						{readingLevels.length > 0
							? readingLevels.map((l) => l.label).join(", ")
							: i18n.t("setup.summary.none")}
					</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.codes")}</dt>
					<dd class="font-mono">{examples.item} · {examples.card}</dd>
					<dt class="opacity-70">{i18n.t("setup.summary.demo")}</dt>
					<dd>{demo ? i18n.t("setup.summary.yes") : i18n.t("setup.summary.no")}</dd>
					{#each data.accounts as account (account)}
						<dt class="opacity-70">{account}</dt>
						<dd class="font-mono">{passwords[account]}</dd>
					{/each}
				</dl>
				<Hint>{i18n.t("setup.summary.later")}</Hint>
				{#if errorMessage}
					<Alert>
						{i18n.t("setup.summary.error", { message: errorMessage })}
					</Alert>
				{/if}
			{/if}
		</Card>

		<Row as="footer" align="center" justify="between" gap="0" wrap={false}>
			<Button
				onclick={() => (step -= 1)}
				disabled={step === 0 || working}
				data-testid="setup-back">{i18n.t("setup.back")}</Button
			>
			{#if step < STEPS.length - 1}
				<Button
					variant="primary"
					onclick={() => (step += 1)}
					disabled={!stepValid}
					data-testid="setup-next">{i18n.t("setup.next")}</Button
				>
			{:else}
				<Button
					variant="primary"
					onclick={finish}
					disabled={working}
					data-testid="setup-finish"
					>{working ? i18n.t("setup.summary.working") : i18n.t("setup.finish")}</Button
				>
			{/if}
		</Row>
	{/if}
</Page>
