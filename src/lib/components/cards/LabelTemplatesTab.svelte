<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The label templates of the print templates page (step 3.8): every label template with its
     status, one sample unit of the chosen one on a chosen stock, its whole sheet, and the
     calibration page of a stock. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		previewLabelTemplate,
		type getTemplatesOverview,
	} from "#lib/remote/print-templates.remote.js";
	import { icons } from "#lib/ui/icons.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import PreviewFrame from "#lib/ui/PreviewFrame.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import Select from "#lib/ui/Select.svelte";
	import SelectCard from "#lib/ui/SelectCard.svelte";

	type Overview = Awaited<ReturnType<typeof getTemplatesOverview>>;

	interface Props {
		labels: Overview["labels"];
		stocks: Overview["stocks"];
	}

	const { labels, stocks }: Props = $props();
	const i18n = useI18n();
	const PrintIcon = icons.print;
	const SheetIcon = icons.view;

	let pickedLabel = $state<string | null>(null);
	let labelStock = $state("");
	let labelSample = $state<"fiction" | "nonfiction">("fiction");
	let labelZoom = $state<1 | 2>(1);
	let stock = $state("");
	const stockId = $derived(stock || stocks[0]?.id || "");
	const selectedLabel = $derived(
		(pickedLabel && labels.some((t) => t.name === pickedLabel) ? pickedLabel : null) ??
			labels.find((t) => t.isDefault && !t.error && t.labelKind === "pair")?.name ??
			labels.find((t) => !t.error)?.name ??
			null,
	);
	const selectedLabelStatus = $derived(labels.find((t) => t.name === selectedLabel) ?? null);
	const labelStockId = $derived(
		labelStock || selectedLabelStatus?.stocks[0] || stocks[0]?.id || "",
	);
	const labelPreview = $derived(
		selectedLabel && selectedLabelStatus && !selectedLabelStatus.error
			? previewLabelTemplate({
					template: selectedLabel,
					stock: labelStockId || undefined,
					zoom: labelZoom,
					sample: labelSample,
				})
			: null,
	);
	const labelSheetUrl = $derived(
		resolve(
			`print/labels/${selectedLabelStatus?.labelKind ?? "pair"}?sample=1&template=${selectedLabel ?? ""}&stock=${labelStockId}`,
		),
	);
</script>

{#if labels.length === 0}
	<EmptyState title={i18n.t("admin.templates.list.emptyLabels")} icon="label" />
{:else}
	<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
		<section class="space-y-3" aria-label={i18n.t("admin.templates.kinds.labels")}>
			{#each labels as t (t.name)}
				<SelectCard
					selected={selectedLabel === t.name}
					onclick={() => (pickedLabel = t.name)}
					data-testid="template-labels-{t.name}"
				>
					<Row align="center" as="span">
						<span class="title-lg">{t.name}</span>
						{#if t.labelKind}<Badge tone="secondary"
								>{i18n.t(`printing.labels.kinds.${t.labelKind}`)}</Badge
							>{/if}
						<Badge>{i18n.t(`admin.templates.list.source.${t.source}`)}</Badge>
						{#if t.isDefault}<Badge tone="primary"
								>{i18n.t("admin.templates.list.default")}</Badge
							>{/if}
						{#if t.error}<Badge tone="error" filled
								>{i18n.t("admin.templates.list.status.error")}</Badge
							>{:else}<Badge tone="success"
								>{i18n.t("admin.templates.list.status.ok")}</Badge
							>{/if}
					</Row>
					{#if t.description}<Hint as="span" tone="soft" class="mt-1 block"
							>{t.description}</Hint
						>{/if}
					{#if t.stocks.length > 0}<Hint as="span" class="mt-1 block"
							>{i18n.t("admin.templates.labels.stocks", {
								stocks: t.stocks.join(", "),
							})}</Hint
						>{/if}
					{#if t.error}<Hint tone="error-soft" mono as="span" class="mt-2 block"
							>{t.error}</Hint
						>{/if}
				</SelectCard>
			{/each}
		</section>
		<Card gap="3" as="section" data-testid="label-preview-panel">
			<h2 class="font-semibold">
				{i18n.t("admin.templates.labels.preview", {
					name: selectedLabel ?? "",
				})}
			</h2>
			<Row align="end" gap="3">
				<Field label={i18n.t("admin.templates.calibration.stock")} class="grow">
					<Select bind:value={labelStock} data-testid="label-preview-stock">
						{#each stocks as s (s.id)}
							<option value={s.id}>{s.name}</option>
						{/each}
					</Select>
				</Field>
				<SegmentedGroup
					fit
					radio
					options={(["fiction", "nonfiction"] as const).map((k) => ({
						value: k,
						label: i18n.t(`catalog.kinds.${k}`),
					}))}
					value={labelSample}
					onselect={(k) => (labelSample = k)}
				/>
				<SegmentedGroup
					fit
					radio
					options={([1, 2] as const).map((z) => ({ value: z, label: `${z * 100} %` }))}
					value={labelZoom}
					onselect={(z) => (labelZoom = z)}
				/>
			</Row>
			{#if labelPreview?.current && !labelPreview.current.ok}
				<Alert data-testid="label-preview-error">
					{labelPreview.current.problems.join("; ")}
				</Alert>
			{:else if labelPreview?.current?.ok}
				{@const lp = labelPreview.current}
				<Hint>
					{i18n.t("admin.templates.labels.geometry", {
						width: lp.widthMm,
						height: lp.heightMm,
						variant: lp.variant ?? "—",
					})}
				</Hint>
				<PreviewFrame
					title={i18n.t("admin.templates.labels.preview", {
						name: lp.template,
					})}
					html={lp.html}
					widthMm={lp.widthMm}
					heightMm={lp.heightMm}
					zoom={labelZoom}
					data-testid="label-preview-frame"
				/>
			{/if}
			<Row>
				<Button
					icon={SheetIcon}
					href={labelSheetUrl}
					target="_blank"
					rel="noopener"
					data-testid="label-sheet-link">{i18n.t("admin.templates.labels.sheet")}</Button
				>
				<Button
					icon={PrintIcon}
					href="/print/labels/calibration?stock={labelStockId}&kind={selectedLabelStatus?.labelKind ??
						'pair'}"
					target="_blank"
					rel="noopener">{i18n.t("admin.templates.calibration.print")}</Button
				>
			</Row>
		</Card>
	</div>
{/if}
<Card gap="3">
	<h2 class="font-semibold">{i18n.t("admin.templates.calibration.title")}</h2>
	<Hint tone="soft">{i18n.t("admin.templates.calibration.hint")}</Hint>
	<Row align="end" gap="3">
		<Field label={i18n.t("admin.templates.calibration.stock")} class="max-w-md grow">
			<Select bind:value={stock} data-testid="stock-select">
				{#each stocks as s (s.id)}
					<option value={s.id}>{s.name}</option>
				{/each}
			</Select>
		</Field>
		<Button
			variant="primary"
			icon={PrintIcon}
			href="/print/labels/calibration?stock={stockId}"
			target="_blank"
			rel="noopener"
			data-testid="calibration-link">{i18n.t("admin.templates.calibration.print")}</Button
		>
	</Row>
</Card>
