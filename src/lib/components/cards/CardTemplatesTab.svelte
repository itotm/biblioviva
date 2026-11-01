<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The card templates of the print templates page (step 2.5b): every card template with its
     status, the real-size preview of the chosen one with a sample or a real patron, the whole
     sheet and the test page. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { searchPatrons } from "#lib/remote/patrons.remote.js";
	import {
		previewCardTemplate,
		type getTemplatesOverview,
	} from "#lib/remote/print-templates.remote.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { icons } from "#lib/ui/icons.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import SelectCard from "#lib/ui/SelectCard.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	type Overview = Awaited<ReturnType<typeof getTemplatesOverview>>;

	interface Props {
		cards: Overview["cards"];
	}

	const { cards }: Props = $props();
	const i18n = useI18n();
	const PrintIcon = icons.print;
	const OkIcon = icons.available;
	const ErrorIcon = icons.damaged;
	const SheetIcon = icons.view;

	/** px per mm on a 96 dpi screen. */
	const PX_PER_MM = 96 / 25.4;

	let picked = $state<string | null>(null);
	let zoom = $state<1 | 2>(1);
	let patronMode = $state<"sample" | "real">("sample");
	let patronId = $state<number | null>(null);
	let patronLabel = $state("");
	let q = $state("");
	let showSheet = $state(false);

	const selected = $derived(
		(picked && cards.some((t) => t.name === picked) ? picked : null) ??
			cards.find((t) => t.isDefault && !t.error)?.name ??
			cards[0]?.name ??
			null,
	);
	const selectedStatus = $derived(cards.find((t) => t.name === selected) ?? null);
	const preview = $derived(
		selected && selectedStatus && !selectedStatus.error
			? previewCardTemplate({
					template: selected,
					patronId: patronMode === "real" ? patronId : null,
					zoom,
				})
			: null,
	);
	const results = $derived(
		patronMode === "real" && q.trim().length >= 2
			? searchPatrons({ q: q.trim(), limit: 8 })
			: null,
	);
	const frameW = $derived(
		(preview?.current?.ok ? preview.current.widthMm : 85.6) * PX_PER_MM * zoom,
	);
	const frameH = $derived(
		(preview?.current?.ok ? preview.current.heightMm : 53.98) * PX_PER_MM * zoom,
	);
	const sheetUrl = $derived(resolve(`print/cards?sample=1&template=${selected ?? ""}`));
	const testUrl = $derived(resolve(`print/cards/test?template=${selected ?? ""}`));

	function pickPatron(id: number, label: string): void {
		patronId = id;
		patronLabel = label;
		q = "";
	}

	/** The preview again, after the template files were reloaded. */
	export async function refresh(): Promise<void> {
		await preview?.refresh();
	}
</script>

{#if cards.length === 0}
	<EmptyState title={i18n.t("admin.templates.list.emptyCards")} icon="print" />
{:else}
	<div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
		<!-- Template list -->
		<section class="space-y-3" aria-label={i18n.t("admin.templates.kinds.cards")}>
			{#each cards as t (t.name)}
				<SelectCard
					selected={selected === t.name}
					onclick={() => (picked = t.name)}
					data-testid="template-cards-{t.name}"
				>
					<Row align="center" as="span">
						<span class="title-lg">{t.name}</span>
						<Badge>
							{i18n.t(`admin.templates.list.source.${t.source}`)}
						</Badge>
						{#if t.isDefault}
							<Badge tone="primary">{i18n.t("admin.templates.list.default")}</Badge>
						{/if}
						{#if t.error}
							<Badge
								tone="error"
								filled
								icon={ErrorIcon}
								data-testid="template-status-error"
							>
								{i18n.t("admin.templates.list.status.error")}
							</Badge>
						{:else}
							<Badge tone="success" icon={OkIcon} data-testid="template-status-ok">
								{i18n.t("admin.templates.list.status.ok")}
							</Badge>
						{/if}
					</Row>
					{#if t.description}
						<Hint as="span" tone="soft" class="mt-1 block">{t.description}</Hint>
					{/if}
					{#if t.patronTypes.length}
						<span class="mt-1 block text-sm opacity-70">
							{i18n.t("admin.templates.list.forTypes", {
								types: t.patronTypes
									.map((pt) => i18n.t(`patrons.types.${pt}`))
									.join(", "),
							})}
						</span>
					{/if}
					<span class="mt-1 block truncate font-mono text-xs opacity-60" title={t.dir}>
						{i18n.t("admin.templates.list.folder")}: {t.dir}
					</span>
					{#if t.error}
						<Alert
							soft
							mono
							as="span"
							live={false}
							class="mt-2 block"
							data-testid="template-error">{t.error}</Alert
						>
					{/if}
				</SelectCard>
			{/each}

			<Card>
				<h2 class="mb-2 font-semibold">
					{i18n.t("admin.templates.howTo.title")}
				</h2>
				<ol class="list-decimal space-y-1 pl-5 text-sm">
					{#each ["step1", "step2", "step3", "step4"] as step (step)}
						<li>
							{i18n.t(`admin.templates.howTo.steps.${step}`, {
								path: cards[0]?.dir ?? "cards/templates/default",
							})}
						</li>
					{/each}
				</ol>
			</Card>
		</section>

		<!-- Preview -->
		<Card gap="4" as="section" aria-label={i18n.t("admin.templates.preview.title")}>
			<Row align="end" gap="4">
				<fieldset class="space-y-1">
					<legend class="label-text">{i18n.t("admin.templates.preview.patron")}</legend>
					<SegmentedGroup
						options={(["sample", "real"] as const).map((m) => ({
							value: m,
							label: i18n.t(`admin.templates.preview.${m}`),
							testid: `patron-${m}`,
						}))}
						value={patronMode}
						onselect={(m) => (patronMode = m)}
					/>
				</fieldset>
				<fieldset class="space-y-1">
					<legend class="label-text">{i18n.t("admin.templates.preview.zoom")}</legend>
					<SegmentedGroup
						options={([1, 2] as const).map((z) => ({
							value: z,
							label: `${z * 100} %`,
							testid: `zoom-${z * 100}`,
						}))}
						value={zoom}
						onselect={(z) => (zoom = z)}
					/>
				</fieldset>
				<Row class="ml-auto">
					<Button
						icon={SheetIcon}
						aria-pressed={showSheet}
						onclick={() => (showSheet = !showSheet)}
						data-testid="sheet-toggle">{i18n.t("admin.templates.preview.sheet")}</Button
					>
					<Button
						variant="primary"
						icon={PrintIcon}
						href={testUrl}
						target="_blank"
						rel="noopener"
						data-testid="test-page">{i18n.t("admin.templates.preview.test")}</Button
					>
				</Row>
			</Row>

			{#if patronMode === "real"}
				<div class="space-y-2">
					<Field label={i18n.t("admin.templates.preview.search")}
						><Input
							type="search"
							bind:value={q}
							placeholder={i18n.t("admin.templates.preview.searchPlaceholder")}
							data-testid="patron-search"
						/></Field
					>
					{#if patronLabel}
						<p class="text-sm" data-testid="patron-picked">
							{i18n.t("admin.templates.preview.real")}:
							<strong>{patronLabel}</strong>
						</p>
					{/if}
					{#if results?.current}
						{#if results.current.rows.length === 0}
							<Hint>
								{i18n.t("admin.templates.preview.noResults")}
							</Hint>
						{:else}
							<ul
								class="divide-y divide-surface-200 rounded-container border border-surface-200"
							>
								{#each results.current.rows as row (row.id)}
									<li>
										<button
											type="button"
											class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-primary-50"
											onclick={() => pickPatron(row.id, patronSortName(row))}
											data-testid="patron-result-{row.id}"
										>
											<span class="font-semibold">{patronSortName(row)}</span>
											<Hint as="span">
												{row.classLabel}
												{row.cardNumber ?? ""}
											</Hint>
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/if}

			{#if selectedStatus?.error}
				<Alert soft>{i18n.t("admin.templates.preview.broken")}</Alert>
			{:else if preview}
				<QueryState query={preview} size="md">
					{#snippet children(p)}
						{#if p.ok}
							<div
								class="flex flex-wrap gap-6 overflow-x-auto"
								data-testid="card-preview"
							>
								{#each [["front", p.front], ["back", p.back]] as [face, doc] (face)}
									<figure class="space-y-1">
										<figcaption class="label-text">
											{i18n.t(`admin.templates.preview.${face}`)}
										</figcaption>
										<iframe
											sandbox=""
											srcdoc={doc}
											title={i18n.t(`admin.templates.preview.${face}`)}
											class="block rounded-sm border border-surface-300 bg-white shadow-[var(--bv-shadow-card)]"
											style="width: {frameW}px; height: {frameH}px"
											data-testid="preview-{face}"
										></iframe>
									</figure>
								{/each}
							</div>
							<Hint tone="faint">
								{i18n.t("admin.templates.preview.size", {
									width: p.widthMm,
									height: p.heightMm,
									zoom: `${p.zoom * 100} %`,
								})}
							</Hint>
						{:else}
							<Alert soft as="div">
								<p>{i18n.t("admin.templates.preview.broken")}</p>
								<ul
									class="mt-1 list-disc pl-5 font-mono text-xs"
									data-testid="preview-problems"
								>
									{#each p.problems as problem (problem)}<li>
											{problem}
										</li>{/each}
								</ul>
							</Alert>
						{/if}
					{/snippet}
				</QueryState>
			{/if}

			{#if showSheet && selected}
				<div class="space-y-1">
					<p class="label-text">
						{i18n.t("admin.templates.preview.sheetHint")}
					</p>
					<iframe
						sandbox="allow-same-origin"
						src={sheetUrl}
						title={i18n.t("admin.templates.preview.sheet")}
						class="block h-[80vh] w-full rounded-container border border-surface-300 bg-surface-100"
						data-testid="sheet-frame"
					></iframe>
				</div>
			{/if}
		</Card>
	</div>
{/if}
