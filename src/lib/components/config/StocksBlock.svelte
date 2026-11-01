<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Adhesive label stocks on the "Etichette" settings page (step 11.6): the sheets with the label
     jobs printing on each; the chosen one is edited next to a drawing of the A4 page that follows
     every number typed (labels past the edge in red); new sheets start as a copy of the chosen one;
     a sheet in use cannot be removed; the calibration page prints the saved sheet on plain paper.
     The whole list is saved as one change. -->
<script lang="ts">
	import { ENTRY_ID } from "#lib/shared/input-schemas.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { getLabelStocks, saveLabelStocks } from "#lib/remote/print-config.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import { stockCells, stockExtent, stockOverflow } from "#lib/shared/label-stock.js";
	import { PAPER_MM } from "#lib/shared/paper.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SelectCard from "#lib/ui/SelectCard.svelte";
	import { icons } from "#lib/ui/icons.js";
	import Loading from "#lib/ui/Loading.svelte";

	type Stock = NonNullable<typeof data.current>["stocks"][number]["stock"];
	interface StockRow {
		key: number;
		originalId: string | null;
		usedBy: string[];
		file: string | null;
		stock: Stock;
	}

	interface Props {
		dirty?: boolean;
	}

	let { dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const data = getLabelStocks();
	const AddIcon = icons.add;
	const RemoveIcon = icons.delete;
	const PrintIcon = icons.print;

	let rows = $state<StockRow[]>([]);
	let selectedKey = $state<number | null>(null);
	let nextKey = 0;

	const draft = $derived(rows.map((r) => ({ originalId: r.originalId, stock: r.stock })));
	type Failure = Extract<Awaited<ReturnType<typeof saveLabelStocks>>, { ok: false }>;
	const editor = new DraftEditor<typeof draft, Failure>(() => draft);
	/** The refusal of the last save: the reason of a sheet refused, or the configuration's errors. */
	const problems = $derived.by((): string[] => {
		const failure = editor.failure;
		if (!failure) {
			return [];
		}
		return failure.code === null
			? failure.issues
			: [
					i18n.t(`config.blocks.stocks.errors.${failure.code}`, {
						details: failure.details.join(", "),
					}),
				];
	});

	function load(): void {
		const current = data.current;
		if (!current) {
			return;
		}
		rows = current.stocks.map((s) => ({
			key: nextKey++,
			originalId: s.stock.id,
			usedBy: s.usedBy,
			file: s.file,
			stock: structuredClone(s.stock),
		}));
		selectedKey = rows[0]?.key ?? null;
		editor.mark();
	}
	editor.loadWhenReady(() => data.current !== undefined, load);
	$effect(() => {
		dirty = editor.dirty;
	});

	const selected = $derived(rows.find((r) => r.key === selectedKey) ?? null);

	/** Every measure a number ≥ 0, labels bigger than nothing, whole columns and rows. */
	function numbersOk(s: Stock): boolean {
		const mm = [
			s.labelMm.width,
			s.labelMm.height,
			s.marginMm.top,
			s.marginMm.left,
			s.gapMm.x,
			s.gapMm.y,
			s.cornerRadiusMm,
		];
		return (
			mm.every((n) => typeof n === "number" && !Number.isNaN(n) && n >= 0 && n <= 400) &&
			s.labelMm.width > 0 &&
			s.labelMm.height > 0 &&
			Number.isInteger(s.columns) &&
			Number.isInteger(s.rows) &&
			s.columns >= 1 &&
			s.columns <= 50 &&
			s.rows >= 1 &&
			s.rows <= 100
		);
	}

	function rowProblems(r: StockRow): string[] {
		const s = r.stock;
		const out: string[] = [];
		if (!ENTRY_ID.test(s.id)) {
			out.push(i18n.t("config.blocks.stocks.problems.id"));
		} else if (rows.some((o) => o !== r && o.stock.id === s.id)) {
			out.push(i18n.t("config.blocks.stocks.problems.duplicate"));
		}
		if (!s.name.trim()) {
			out.push(i18n.t("config.blocks.stocks.problems.name"));
		}
		if (!numbersOk(s)) {
			out.push(i18n.t("config.blocks.stocks.problems.numbers"));
		} else {
			const over = stockOverflow(s);
			const extent = stockExtent(s);
			if (over.x) {
				out.push(
					i18n.t("config.blocks.stocks.problems.width", {
						mm: extent.width.toFixed(1),
					}),
				);
			}
			if (over.y) {
				out.push(
					i18n.t("config.blocks.stocks.problems.height", {
						mm: extent.height.toFixed(1),
					}),
				);
			}
			if (r.usedBy.includes("pair") && s.rows % 2 !== 0) {
				out.push(i18n.t("config.blocks.stocks.problems.pairRows"));
			}
		}
		return out;
	}
	const invalid = $derived(rows.some((r) => rowProblems(r).length > 0));

	function add(): void {
		const base = selected?.stock ?? data.current?.stocks[0]?.stock;
		if (!base) {
			return;
		}
		let id = `${base.id}-2`;
		for (let i = 3; rows.some((r) => r.stock.id === id); i++) {
			id = `${base.id}-${i}`;
		}
		const row: StockRow = {
			key: nextKey++,
			originalId: null,
			usedBy: [],
			file: null,
			stock: { ...$state.snapshot(base), id, name: `${base.name} (2)` },
		};
		rows = [...rows, row];
		selectedKey = row.key;
	}

	function remove(key: number): void {
		rows = rows.filter((r) => r.key !== key);
		selectedKey = rows[0]?.key ?? null;
	}

	function save(): Promise<void> {
		return editor.save(
			() => saveLabelStocks({ stocks: draft }),
			i18n.t("config.blocks.stocks.saved"),
			() => {
				// the rows start again from what was saved: the saved ids are now the original ones
				for (const r of rows) {
					r.originalId = r.stock.id;
				}
				editor.mark();
				void data.refresh();
			},
		);
	}

	// the drawing: 1 unit = 1 mm
	const cells = $derived.by(() => {
		const s = selected?.stock;
		if (!s || !numbersOk(s)) {
			return [];
		}
		return stockCells(s).map((c) => ({ x: c.xMm, y: c.yMm, over: c.over }));
	});
	const JOB = (k: string): string => i18n.t(`printing.labels.kinds.${k}`);
</script>

{#snippet number(
	label: string,
	value: number,
	set: (n: number) => void,
	testid: string,
	step = "0.1",
	min = "0",
)}
	<Field {label}>
		<Input
			type="number"
			{step}
			{min}
			value={Number.isNaN(value) ? "" : value}
			oninput={(e) =>
				set(e.currentTarget.value === "" ? Number.NaN : Number(e.currentTarget.value))}
			data-testid={testid}
		/>
	</Field>
{/snippet}

<Card variant="outlined" gap="3" id="stocks" data-testid="block-stocks">
	<h2 class="title-lg">{i18n.t("config.blocks.stocks.title")}</h2>
	<Hint>{i18n.t("config.blocks.stocks.hint")}</Hint>
	{#if data.current}
		<div class="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
			<div class="space-y-2" role="group" aria-label={i18n.t("config.blocks.stocks.title")}>
				{#each rows as r (r.key)}
					{@const bad = rowProblems(r).length > 0}
					<SelectCard
						selected={r.key === selectedKey}
						onclick={() => (selectedKey = r.key)}
						data-testid="stock-{r.stock.id}"
					>
						<span class="block font-semibold">{r.stock.name || r.stock.id}</span>
						<Hint as="span" mono class="block">{r.stock.id}</Hint>
						<Row gap="1" as="span" class="mt-1">
							{#each r.usedBy as k (k)}
								<Badge tone="primary">{JOB(k)}</Badge>
							{/each}
							{#if r.originalId === null}
								<Badge tone="success">{i18n.t("config.blocks.stocks.new")}</Badge>
							{/if}
							{#if bad}
								<Badge tone="error">{i18n.t("config.blocks.stocks.toFix")}</Badge>
							{/if}
						</Row>
					</SelectCard>
				{/each}
				<Button icon={AddIcon} full onclick={add} data-testid="stock-add"
					>{i18n.t("config.blocks.stocks.add")}</Button
				>
			</div>

			{#if selected}
				{@const s = selected.stock}
				{@const issues = rowProblems(selected)}
				<div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
					<div class="space-y-3">
						<Grid from="sm" gap="3">
							<Field label={i18n.t("config.blocks.stocks.id")}>
								<Input
									mono
									bind:value={s.id}
									maxlength={32}
									data-testid="stock-id"
								/>
							</Field>
							<Field label={i18n.t("config.blocks.stocks.name")}>
								<Input
									bind:value={s.name}
									maxlength={200}
									data-testid="stock-name"
								/>
							</Field>
						</Grid>
						<div class="grid grid-cols-2 gap-3">
							{@render number(
								i18n.t("config.blocks.stocks.labelWidth"),
								s.labelMm.width,
								(n) => (s.labelMm.width = n),
								"stock-label-width",
							)}
							{@render number(
								i18n.t("config.blocks.stocks.labelHeight"),
								s.labelMm.height,
								(n) => (s.labelMm.height = n),
								"stock-label-height",
							)}
							{@render number(
								i18n.t("config.blocks.stocks.columns"),
								s.columns,
								(n) => (s.columns = n),
								"stock-columns",
								"1",
								"1",
							)}
							{@render number(
								i18n.t("config.blocks.stocks.rows"),
								s.rows,
								(n) => (s.rows = n),
								"stock-rows",
								"1",
								"1",
							)}
							{@render number(
								i18n.t("config.blocks.stocks.marginTop"),
								s.marginMm.top,
								(n) => (s.marginMm.top = n),
								"stock-margin-top",
							)}
							{@render number(
								i18n.t("config.blocks.stocks.marginLeft"),
								s.marginMm.left,
								(n) => (s.marginMm.left = n),
								"stock-margin-left",
							)}
							{@render number(
								i18n.t("config.blocks.stocks.gapX"),
								s.gapMm.x,
								(n) => (s.gapMm.x = n),
								"stock-gap-x",
							)}
							{@render number(
								i18n.t("config.blocks.stocks.gapY"),
								s.gapMm.y,
								(n) => (s.gapMm.y = n),
								"stock-gap-y",
							)}
							{@render number(
								i18n.t("config.blocks.stocks.radius"),
								s.cornerRadiusMm,
								(n) => (s.cornerRadiusMm = n),
								"stock-radius",
							)}
						</div>
						{#if issues.length > 0}
							<Alert as="div" data-testid="stock-problems">
								{#each issues as p (p)}<p>{p}</p>{/each}
							</Alert>
						{/if}
						{#if selected.file}
							<Hint tone="faint" mono>{selected.file}</Hint>
						{/if}
						<Row>
							{#if selected.originalId !== null && !dirty}
								<Button
									icon={PrintIcon}
									href="/print/labels/calibration?stock={encodeURIComponent(
										selected.originalId,
									)}"
									target="_blank"
									data-testid="stock-calibration"
									>{i18n.t("config.blocks.stocks.calibration")}</Button
								>
							{:else}
								<Button icon={PrintIcon} disabled data-testid="stock-calibration"
									>{i18n.t("config.blocks.stocks.calibration")}</Button
								>
							{/if}
							<Button
								icon={RemoveIcon}
								variant="error"
								onclick={() => remove(selected.key)}
								disabled={selected.usedBy.length > 0 || rows.length === 1}
								data-testid="stock-remove">{i18n.t("common.actions.delete")}</Button
							>
						</Row>
						{#if selected.usedBy.length > 0}
							<Hint tone="faint"
								>{i18n.t("config.blocks.stocks.inUse", {
									jobs: selected.usedBy.map(JOB).join(", "),
								})}</Hint
							>
						{/if}
						{#if dirty && selected.originalId !== null}
							<Hint tone="faint">{i18n.t("config.blocks.stocks.saveFirst")}</Hint>
						{/if}
					</div>
					<figure class="space-y-1">
						<svg
							viewBox="-2 -2 214 301"
							class="mx-auto w-full max-w-60 rounded-base bg-surface-100"
							role="img"
							aria-label={i18n.t("config.blocks.stocks.drawing", {
								columns: s.columns,
								rows: s.rows,
							})}
							data-testid="stock-drawing"
						>
							<rect
								x="0"
								y="0"
								width={PAPER_MM.A4.width}
								height={PAPER_MM.A4.height}
								fill="white"
								stroke="#94a3b8"
								stroke-width="0.6"
							/>
							{#each cells as c, i (i)}
								<rect
									x={c.x}
									y={c.y}
									width={s.labelMm.width}
									height={s.labelMm.height}
									rx={Math.min(
										s.cornerRadiusMm,
										s.labelMm.width / 2,
										s.labelMm.height / 2,
									)}
									class={c.over
										? "fill-error-200 stroke-error-600"
										: "fill-primary-100 stroke-primary-600"}
									stroke-width="0.4"
									data-over={c.over ? "true" : undefined}
								/>
							{/each}
						</svg>
						<figcaption>
							<Hint tone="faint"
								>{i18n.t("config.blocks.stocks.caption", {
									count: s.columns * s.rows,
								})}</Hint
							>
						</figcaption>
					</figure>
				</div>
			{/if}
		</div>
		{#if problems.length > 0}
			<Alert as="div" data-testid="stocks-errors">
				{#each problems as p (p)}<p>{p}</p>{/each}
			</Alert>
		{/if}
		<Row justify="end">
			<DraftActions
				{dirty}
				saving={editor.saving}
				{invalid}
				onsave={save}
				onundo={load}
				testid="stocks-save"
			/>
		</Row>
	{:else}
		<Loading />
	{/if}
</Card>
