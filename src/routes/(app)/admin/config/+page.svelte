<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Configurazione (Phase 11): whether the configuration folder is valid, whether the files on
     disk differ from the configuration in use (hand edits: "Ricarica"), and one card per section
     with the file it is written to; above them the editors of the library's look and language, its
     classes, the classification (step 11.1), the print templates and the reports. The history of
     changes is one click away. -->
<script lang="ts">
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { getConfigOverview, reloadConfiguration } from "#lib/remote/config.remote.js";
	import ConfigArchivePanel from "#lib/components/config/ConfigArchivePanel.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Disclosure from "#lib/ui/Disclosure.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import NavCard from "#lib/ui/NavCard.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { icons, type IconName } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const overview = getConfigOverview();
	const ReloadIcon = icons.renew;
	let reloading = $state(false);

	const ICONS: Record<string, IconName> = {
		library: "catalog",
		school: "classes",
		catalog: "book",
		barcodes: "barcode",
		circulation: "loan",
		calendar: "calendar",
		z3950: "search",
		metadata: "download",
		performance: "settings",
		classification: "classification",
		cards: "card",
		labels: "label",
		photos: "camera",
		covers: "image",
		privacy: "patrons",
		backup: "backup",
		security: "admin",
		ui: "config",
	};

	async function reload(): Promise<void> {
		reloading = true;
		try {
			const result = await reloadConfiguration().updates(overview);
			if (result.ok) {
				toaster.success({ title: i18n.t("config.overview.reloaded") });
			} else {
				toaster.error({ title: i18n.t("config.overview.reloadFailed") });
			}
		} finally {
			reloading = false;
		}
	}
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("config.home.title")}
		icon="config"
		backHref="/admin"
		backLabel={i18n.t("common.actions.back")}
	>
		{#snippet actions()}
			<Button
				icon={ReloadIcon}
				onclick={reload}
				disabled={reloading}
				data-testid="config-reload">{i18n.t("config.overview.reload")}</Button
			>
		{/snippet}
		{#snippet views()}
			<AreaTabs area="config" current="overview" />
		{/snippet}
	</PageHeader>
	<QueryState query={overview}>
		{#snippet children(o)}
			{#if !o.disk.ok}
				<Alert as="div" padded data-testid="config-disk-errors">
					<p class="font-semibold">{i18n.t("config.overview.diskErrors")}</p>
					<BulletList>
						{#each o.disk.issues as issue, i (i)}
							<li>
								{#if issue.file}<code>{issue.file}</code> ·
								{/if}<code>{issue.path}</code>: {issue.message}
							</li>
						{/each}
					</BulletList>
				</Alert>
			{:else if o.disk.changed}
				<Alert tone="info" padded data-testid="config-disk-changed"
					>{i18n.t("config.overview.diskChanged")}</Alert
				>
			{:else if o.source === "example"}
				<Alert tone="warning" padded>{i18n.t("config.overview.example")}</Alert>
			{:else}
				<Alert tone="success" padded live={false} data-testid="config-valid"
					>{i18n.t("config.overview.valid", { count: o.files.length })}</Alert
				>
			{/if}
			{#if o.warnings.length > 0}
				<Disclosure
					summary={i18n.t("config.overview.warnings", { count: o.warnings.length })}
					data-testid="config-warnings"
				>
					<BulletList muted>
						{#each o.warnings as w, i (i)}
							<li>
								{#if w.file}<code>{w.file}</code> ·
								{/if}<code>{w.path}</code>: {w.message}
							</li>
						{/each}
					</BulletList>
				</Disclosure>
			{/if}
			<!-- two kinds of entries (9.13, round 25): the editors of what the library has (its look and
			     language, the classes, the classification, the print templates, the reports), then the
			     settings of each section -->
			{@const classification = o.sections.find((s) => s.section === "classification")}
			<h2 class="title-lg">{i18n.t("config.overview.editors")}</h2>
			<Grid from="sm" lg3 as="nav" aria-label={i18n.t("config.overview.editors")}>
				<NavCard
					href="/admin/appearance"
					icon="settings"
					title={i18n.t("config.overview.appearance")}
					description={i18n.t("config.overview.appearanceDescription")}
					data-testid="config-appearance"
				/>
				<NavCard
					href="/admin/classes"
					icon="classes"
					title={i18n.t("config.overview.classes")}
					description={i18n.t("config.overview.classesDescription")}
					data-testid="config-classes"
				/>
				{#if classification}
					<NavCard
						href={classification.href}
						icon="classification"
						title={i18n.t("config.sections.classification.title")}
						description={i18n.t("config.sections.classification.description")}
						note={classification.file}
						badge={classification.warnings > 0
							? i18n.t("config.overview.warnings", { count: classification.warnings })
							: undefined}
						data-testid="config-section-classification"
					/>
				{/if}
				<NavCard
					href="/admin/config/templates"
					icon="print"
					title={i18n.t("config.overview.templates")}
					description={i18n.t("config.overview.templatesDescription")}
					note="cards/ · labels/ · slips/"
					data-testid="config-templates"
				/>
				<NavCard
					href="/admin/config/reports"
					icon="reports"
					title={i18n.t("config.overview.reports")}
					description={i18n.t("config.overview.reportsDescription")}
					note="reports/"
					data-testid="config-reports"
				/>
			</Grid>
			<h2 class="title-lg">{i18n.t("config.overview.sections")}</h2>
			<Grid from="sm" lg3 as="nav" aria-label={i18n.t("config.overview.sections")}>
				{#each o.sections.filter((s) => s.section !== "classification") as s (s.section)}
					<NavCard
						href={s.href}
						icon={ICONS[s.section] ?? "config"}
						title={i18n.t(`config.sections.${s.section}.title`)}
						description={i18n.t(`config.sections.${s.section}.description`)}
						note={s.alsoFrom.length > 0
							? `${s.file} ${i18n.t("config.overview.alsoFrom", { count: s.alsoFrom.length })}`
							: s.file}
						badge={s.warnings > 0
							? i18n.t("config.overview.warnings", { count: s.warnings })
							: undefined}
						data-testid="config-section-{s.section}"
					/>
				{/each}
			</Grid>
			<ConfigArchivePanel onimported={() => overview.refresh()} />
		{/snippet}
	</QueryState>
</Page>
