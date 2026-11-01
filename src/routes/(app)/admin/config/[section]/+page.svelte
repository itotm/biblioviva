<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One section of the configuration (step 11.2): the settings form generated from the schema,
     grouped like the section, each key saved in the file that defines it; what the form does not
     cover is listed with the editor that does; the JSON tab edits the section as its file writes
     it. Leaving with unsaved changes asks first. -->
<script lang="ts">
	import ChoiceButtons from "#lib/ui/ChoiceButtons.svelte";
	import { SvelteSet } from "svelte/reactivity";
	import { useI18n } from "#lib/i18n/context.js";
	import { SECTION_BLOCKS } from "#lib/admin/config-coverage.js";
	import { getConfigSection, saveConfigSettings } from "#lib/remote/config.remote.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import BarcodeFormatsBlock from "#lib/components/config/BarcodeFormatsBlock.svelte";
	import BarcodesBlock from "#lib/components/config/BarcodesBlock.svelte";
	import CalendarBlock from "#lib/components/config/CalendarBlock.svelte";
	import CardTemplatesBlock from "#lib/components/config/CardTemplatesBlock.svelte";
	import StocksBlock from "#lib/components/config/StocksBlock.svelte";
	import Z3950TargetsBlock from "#lib/components/config/Z3950TargetsBlock.svelte";
	import CoverProvidersBlock from "#lib/components/config/CoverProvidersBlock.svelte";
	import LanguagePacksBlock from "#lib/components/config/LanguagePacksBlock.svelte";
	import BackupScheduleBlock from "#lib/components/config/BackupScheduleBlock.svelte";
	import ItemTypeRulesBlock from "#lib/components/config/ItemTypeRulesBlock.svelte";
	import CodeListBlock from "#lib/components/config/CodeListBlock.svelte";
	import SchoolLevelsBlock from "#lib/components/config/SchoolLevelsBlock.svelte";
	import ConfigField from "#lib/components/config/ConfigField.svelte";
	import InUseList from "#lib/components/config/InUseList.svelte";
	import SectionJsonEditor from "#lib/components/config/SectionJsonEditor.svelte";
	import { LeaveGuard } from "#lib/components/config/leave-guard.svelte.js";
	import {
		fieldProblem,
		groupOf,
		settingsPatch,
		type SectionData,
	} from "#lib/components/config/settings-form.js";
	import Alert from "#lib/ui/Alert.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import FormSection from "#lib/ui/FormSection.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Link from "#lib/ui/Link.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { playScanSound, unlockScanSound } from "#lib/scanner/sound.js";
	import { SCAN_SOUNDS } from "#lib/shared/barcodes/scan-sounds.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Loading from "#lib/ui/Loading.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;
	const SoundIcon = icons.sound;
	const UndoIcon = icons.undo;
	const view = $derived(getConfigSection(data.section));

	let values = $state<Record<string, unknown>>({});
	const resets = new SvelteSet<string>();
	let loadedFor = $state<SectionData | null>(null);
	let tab = $state<"form" | "json">("form");
	let saving = $state(false);
	let jsonDirty = $state(false);
	let serverIssues = $state<{ path: string; message: string }[]>([]);
	let inUse = $state<
		{
			kind: "classification" | "itemType" | "level" | "readingLevel";
			code: string;
			count: number;
		}[]
	>([]);

	function load(section: SectionData): void {
		values = Object.fromEntries(section.fields.map((f) => [f.path, f.value]));
		resets.clear();
		serverIssues = [];
		inUse = [];
		loadedFor = section;
	}
	$effect(() => {
		const current = view.current;
		if (current && current.section !== loadedFor?.section) {
			load(current);
		}
	});

	// the latest data (after a block saved), with the edits of the form kept in `values`
	const current = $derived(view.current ?? loadedFor);
	const blocksDirty = $state({
		itemTypes: false,
		barcodes: false,
		barcodeFormats: false,
		itemTypeRules: false,
		calendar: false,
		cardTemplates: false,
		stocks: false,
		z3950Targets: false,
		coverProviders: false,
		schoolLevels: false,
	});
	const blocks = $derived(current ? (SECTION_BLOCKS[current.section] ?? []) : []);
	const text = (v: unknown): string => (typeof v === "string" ? v : "");
	const symbology = (v: unknown): string => (typeof v === "string" ? v : "code128");
	const patch = $derived(
		current ? settingsPatch(current.fields, values, resets) : { set: {}, reset: [] },
	);
	const dirty = $derived(Object.keys(patch.set).length + patch.reset.length > 0);
	const invalid = $derived(
		current?.fields.some((f) => !resets.has(f.path) && fieldProblem(f, values[f.path])) ??
			false,
	);
	const groups = $derived.by(() => {
		const out: { key: string; fields: SectionData["fields"] }[] = [];
		for (const field of current?.fields ?? []) {
			const key = groupOf(field.path);
			const group = out.find((g) => g.key === key);
			if (group) {
				group.fields.push(field);
			} else {
				out.push({ key, fields: [field] });
			}
		}
		// the keys of the section itself ("Generale") come first
		return out.sort(
			(a, b) => Number(b.key === current?.section) - Number(a.key === current?.section),
		);
	});
	const fieldErrors = (path: string): string[] =>
		serverIssues.filter((i) => i.path === path).map((i) => i.message);
	const otherErrors = $derived(
		serverIssues.filter((i) => !current?.fields.some((f) => f.path === i.path)),
	);

	async function save(): Promise<void> {
		if (!current) {
			return;
		}
		saving = true;
		try {
			const result = await saveConfigSettings({ section: current.section, ...patch });
			if (result.ok) {
				toaster.success({ title: i18n.t("config.section.saved") });
				await view.refresh();
				if (view.current) {
					load(view.current);
				}
			} else {
				serverIssues = result.issues;
				inUse = result.inUse;
			}
		} finally {
			saving = false;
		}
	}

	async function jsonSaved(): Promise<void> {
		await view.refresh();
		if (view.current) {
			load(view.current);
		}
	}

	const guard = new LeaveGuard(
		() => dirty || jsonDirty || Object.values(blocksDirty).some(Boolean),
	);
	const title = $derived(i18n.t(`config.sections.${data.section}.title`));

	/** The sound being chosen, played from the form (a tap: the browser opens audio for it). */
	function playSound(value: unknown): void {
		const sound = SCAN_SOUNDS.find((s) => s === value);
		if (sound) {
			unlockScanSound(sound);
			void playScanSound(sound).catch(() => undefined); // no audio in this browser
		}
	}
</script>

{#snippet soundPreview(value: unknown)}
	<Button
		size="sm"
		icon={SoundIcon}
		disabled={value === "off"}
		onclick={() => playSound(value)}
		data-testid="play-camera-sound">{i18n.t("config.section.playSound")}</Button
	>
{/snippet}

<Page width="xl">
	<PageHeader
		{title}
		subtitle={current ? i18n.t("config.section.file", { file: current.file }) : undefined}
		icon="config"
		backHref="/admin/config"
		backLabel={i18n.t("admin.home.sections.config.title")}
	>
		{#snippet actions()}
			{#if tab === "form"}
				{#if dirty}
					<Badge tone="warning" data-testid="section-dirty"
						>{i18n.t("config.section.unsaved")}</Badge
					>
				{/if}
				<Button
					icon={UndoIcon}
					onclick={() => current && load(current)}
					disabled={!dirty || saving}
					data-testid="section-discard">{i18n.t("config.section.discard")}</Button
				>
				<Button
					variant="primary"
					icon={SaveIcon}
					onclick={save}
					disabled={!dirty || invalid || saving}
					data-testid="section-save">{i18n.t("config.section.save")}</Button
				>
			{/if}
		{/snippet}
	</PageHeader>

	{#if view.error}
		<Alert>{i18n.t("common.status.error")}</Alert>
	{:else if !current}
		<Loading />
	{:else}
		<Hint>{i18n.t(`config.sections.${current.section}.description`)}</Hint>
		{#if current.alsoFrom.length > 0}
			<Hint tone="faint" data-testid="section-also-from"
				>{i18n.t("config.section.alsoFrom", { files: current.alsoFrom.join(", ") })}</Hint
			>
		{/if}
		{#each current.warnings as w, i (i)}
			<Alert tone="warning" live={false}><code>{w.path}</code>: {w.message}</Alert>
		{/each}
		<!-- the two views in the look of the Liste filter (9.13, round 12) -->
		<ChoiceButtons
			choices={[
				{ key: "form", label: i18n.t("config.section.tabs.form"), icon: icons.config },
				{ key: "json", label: i18n.t("config.section.tabs.json"), icon: icons.code },
			]}
			current={tab}
			onselect={(k) => (tab = k)}
			label={i18n.t("config.section.tabs.label")}
			itemTestid="section-tab-"
		/>
		{#if tab === "form"}
			<div class="space-y-6">
				{#if invalid}
					<Alert tone="warning" data-testid="section-invalid"
						>{i18n.t("config.section.invalid")}</Alert
					>
				{/if}
				{#if otherErrors.length > 0}
					<Alert as="div" data-testid="section-errors">
						<p class="font-semibold">{i18n.t("config.section.errors")}</p>
						<BulletList>
							{#each otherErrors as issue, i (i)}
								<li><code>{issue.path}</code>: {issue.message}</li>
							{/each}
						</BulletList>
					</Alert>
				{/if}
				{#if inUse.length > 0}
					<InUseList problems={inUse} />
				{/if}
				{#each groups as group (group.key)}
					<FormSection
						title={group.key === current.section
							? i18n.t("config.section.general")
							: i18n.t(`config.groups.${group.key}.title`)}
					>
						{#each group.fields as field (field.path)}
							<ConfigField
								{field}
								value={values[field.path]}
								resetting={resets.has(field.path)}
								errors={fieldErrors(field.path)}
								onchange={(v) => (values[field.path] = v)}
								onreset={(on) =>
									on ? resets.add(field.path) : resets.delete(field.path)}
								extra={field.path === "barcodes.cameraSound"
									? soundPreview
									: undefined}
							/>
						{/each}
					</FormSection>
				{/each}
				<!-- the blocks of the section's editors, as the coverage map lists them -->
				{#if blocks.includes("itemTypes")}
					<CodeListBlock
						kind="itemTypes"
						bind:dirty={blocksDirty.itemTypes}
						onsaved={() => view.refresh()}
					/>
				{/if}
				{#if blocks.includes("schoolLevels")}
					<SchoolLevelsBlock bind:dirty={blocksDirty.schoolLevels} />
				{/if}
				{#if blocks.includes("barcodes")}
					<BarcodeFormatsBlock bind:dirty={blocksDirty.barcodeFormats} />
					<BarcodesBlock
						patronSymbology={symbology(values["barcodes.patron.symbology"])}
						itemSymbology={symbology(values["barcodes.item.symbology"])}
						bind:dirty={blocksDirty.barcodes}
					/>
				{/if}
				{#if blocks.includes("itemTypeRules")}
					<ItemTypeRulesBlock bind:dirty={blocksDirty.itemTypeRules} />
				{/if}
				{#if blocks.includes("calendar")}
					<CalendarBlock
						autoHolidays={values["calendar.autoItalianHolidays"] === true}
						bind:dirty={blocksDirty.calendar}
					/>
				{/if}
				{#if blocks.includes("cardTemplates")}
					<CardTemplatesBlock bind:dirty={blocksDirty.cardTemplates} />
				{/if}
				{#if blocks.includes("stocks")}
					<StocksBlock bind:dirty={blocksDirty.stocks} />
				{/if}
				{#if blocks.includes("z3950Targets")}
					<Z3950TargetsBlock
						defaultTarget={text(values["z3950.defaultTarget"])}
						bind:dirty={blocksDirty.z3950Targets}
					/>
				{/if}
				{#if blocks.includes("coverProviders")}
					<CoverProvidersBlock bind:dirty={blocksDirty.coverProviders} />
				{/if}
				{#if blocks.includes("languages")}
					<LanguagePacksBlock />
				{/if}
				<!-- not an editor of keys: the next runs of the schedule the form sets -->
				{#if current.section === "backup"}
					<BackupScheduleBlock cron={text(values["backup.cron"])} />
				{/if}
				{#if current.elsewhere.length > 0}
					<Card variant="outlined" gap="3" data-testid="section-elsewhere">
						<h2 class="font-semibold">{i18n.t("config.section.elsewhereTitle")}</h2>
						<Hint>{i18n.t("config.section.elsewhereHint")}</Hint>
						<ul class="space-y-2">
							{#each current.elsewhere as e (e.key)}
								<li>
									<Row align="center" gap="3">
										<code class="text-sm">{e.key}</code>
										{#if "editor" in e.coverage && e.href}
											<Link href={e.href}
												>{i18n.t("config.section.openEditor")}: {i18n.t(
													`config.section.editorNames.${e.coverage.editor}`,
												)}</Link
											>
										{:else if "editor" in e.coverage}
											<Hint as="span"
												>{i18n.t(
													`config.section.editorNames.${e.coverage.editor}`,
												)}</Hint
											>
										{:else}
											<Hint as="span" tone="faint"
												>{i18n.t("config.section.jsonOnly")}</Hint
											>
										{/if}
									</Row>
								</li>
							{/each}
						</ul>
					</Card>
				{/if}
			</div>
		{:else}
			<div>
				{#key current}
					<SectionJsonEditor
						section={current.section}
						file={current.file}
						raw={current.raw}
						bind:dirty={jsonDirty}
						onsaved={jsonSaved}
					/>
				{/key}
			</div>
		{/if}
	{/if}

	<ConfirmDialog
		bind:open={guard.open}
		title={i18n.t("config.leave.title")}
		description={i18n.t("config.leave.description")}
		tone="error"
		confirmLabel={i18n.t("config.leave.confirm")}
		onconfirm={() => guard.leave()}
		oncancel={() => guard.stay()}
	/>
</Page>
