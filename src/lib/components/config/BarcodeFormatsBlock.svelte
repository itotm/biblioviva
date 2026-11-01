<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The formats of copy barcodes and card numbers (PLAN.md step 12.2): a ready pair of formats and
     the check character, the patterns themselves under "Avanzate", ten examples of each kind, the
     verdict of the rule that copies and cards can never be confused (Q90), the formats of the
     past and of the old system with how many codes each has, and a box to try any code with the
     formats being edited. The server plans every change before it can be saved. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getBarcodeFormats,
		planBarcodeFormatsChange,
		saveBarcodeFormatsChange,
	} from "#lib/remote/barcode-formats.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import { useCodeTable } from "#lib/scanner/context.js";
	import { CHECK_ALGORITHMS, type CheckAlgorithm } from "#lib/shared/barcodes/check.js";
	import type { FormatDef, FormatCheck } from "#lib/shared/barcodes/pattern.js";
	import { CODE_PRESETS, presetFormats, type CodePreset } from "#lib/shared/barcodes/presets.js";
	import { buildCodeTable } from "#lib/shared/barcodes/table.js";
	import { recogniseScan } from "#lib/shared/scan.js";
	import Alert from "#lib/ui/Alert.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Disclosure from "#lib/ui/Disclosure.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import Select from "#lib/ui/Select.svelte";
	import ToggleButton from "#lib/ui/ToggleButton.svelte";
	import { icons } from "#lib/ui/icons.js";

	interface Props {
		dirty?: boolean;
	}

	let { dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const live = useCodeTable();
	const saved = getBarcodeFormats();
	const DeleteIcon = icons.delete;
	const AddIcon = icons.add;

	type Draft = Awaited<ReturnType<typeof getBarcodeFormats>>["draft"];
	type Plan = Awaited<ReturnType<typeof planBarcodeFormatsChange>>;
	type Failure = Extract<Awaited<ReturnType<typeof saveBarcodeFormatsChange>>, { ok: false }>;
	type KindKey = "item" | "patron";

	let draft = $state<Draft | null>(null);
	let plan = $state<Plan | null>(null);
	const editor = new DraftEditor<Draft | null, Failure>(() => draft);
	let tryCode = $state("");
	const newLegacy = $state<Record<KindKey, string>>({ item: "", patron: "" });

	const clone = (d: Draft): Draft => JSON.parse(JSON.stringify(d)) as Draft;
	editor.loadWhenReady(
		() => saved.current !== undefined,
		() => {
			if (saved.current) {
				draft = clone(saved.current.draft);
				plan = saved.current.plan;
				editor.mark();
			}
		},
	);
	$effect(() => {
		dirty = editor.dirty;
	});

	// every change of the draft is planned by the server (debounced)
	let sequence = 0;
	$effect(() => {
		if (draft === null) {
			return;
		}
		const snapshot = clone(draft);
		const mine = ++sequence;
		const timer = setTimeout(() => {
			void planBarcodeFormatsChange({ draft: snapshot }).then((p) => {
				if (mine === sequence) {
					plan = p;
				}
			});
		}, 250);
		return () => clearTimeout(timer);
	});

	const same = (a: FormatDef, b: FormatDef): boolean =>
		a.pattern === b.pattern && a.check === b.check;
	const preset = $derived.by((): CodePreset | "custom" => {
		if (!draft) {
			return "custom";
		}
		const check = draft.item.format.check;
		if (check === "none" || draft.patron.format.check !== check) {
			return "custom";
		}
		const found = CODE_PRESETS.find((p) => {
			const f = presetFormats(p, check);
			return (
				same(f.item, draft?.item.format ?? f.item) &&
				same(f.card, draft?.patron.format ?? f.card)
			);
		});
		return found ?? "custom";
	});
	const check = $derived<FormatCheck>(draft?.item.format.check ?? "mod23");

	function choosePreset(p: CodePreset, algorithm: CheckAlgorithm): void {
		if (!draft) {
			return;
		}
		const f = presetFormats(p, algorithm);
		draft.item.format = f.item;
		draft.patron.format = f.card;
	}
	function chooseCheck(algorithm: CheckAlgorithm): void {
		if (!draft) {
			return;
		}
		if (preset === "custom") {
			draft.item.format.check = algorithm;
			draft.patron.format.check = algorithm;
		} else {
			choosePreset(preset, algorithm);
		}
	}
	function addLegacy(key: KindKey): void {
		const pattern = newLegacy[key].trim();
		if (!draft || !pattern) {
			return;
		}
		draft[key].legacy.push({ pattern, check: "none" });
		newLegacy[key] = "";
	}
	function remove(key: KindKey, role: "retired" | "legacy", index: number): void {
		draft?.[key][role].splice(index, 1);
	}

	// the code tried with the formats being edited (the browser's own recognition)
	const tried = $derived.by(() => {
		const text = tryCode.trim();
		if (!draft || !text || (plan?.patterns.length ?? 0) > 0) {
			return null;
		}
		try {
			const table = buildCodeTable({
				...live.formats,
				item: {
					current: draft.item.format,
					retired: draft.item.retired,
					legacy: draft.item.legacy,
				},
				card: {
					current: draft.patron.format,
					retired: draft.patron.retired,
					legacy: draft.patron.legacy,
				},
				libraryCode: draft.libraryCode,
				plainMaxLength: draft.plainMaxLength,
			});
			return recogniseScan(text, table).result;
		} catch {
			return null;
		}
	});

	const KINDS = ["item", "patron"] as const;
	type KindPlan = NonNullable<Plan["item"]>;
	const kindPlans = $derived<[KindKey, KindPlan][]>(
		plan?.item && plan.card
			? [
					["item", plan.item],
					["patron", plan.card],
				]
			: [],
	);
	const errors = $derived(plan?.issues.filter((i) => i.severity === "error") ?? []);
	const warnings = $derived(plan?.issues.filter((i) => i.severity === "warning") ?? []);
	const kindLabel = (kind: "item" | "card"): string =>
		i18n.t(`config.blocks.barcodeFormats.kinds.${kind}`);

	async function save(): Promise<void> {
		if (!draft) {
			return;
		}
		const sent = clone(draft);
		await editor.save(
			() => saveBarcodeFormatsChange({ draft: sent }),
			i18n.t("config.blocks.barcodeFormats.saved"),
			async () => {
				await saved.refresh();
				draft = saved.current ? clone(saved.current.draft) : draft;
				editor.mark();
			},
		);
		// a plan that refused the save: the block shows why where it shows the plan
		const refused = editor.failure?.plan;
		if (refused) {
			plan = refused;
		}
	}
</script>

{#snippet bullets(items: string[])}
	<BulletList>
		{#each items as item, i (i)}<li>{item}</li>{/each}
	</BulletList>
{/snippet}

{#snippet usageList(
	key: KindKey,
	role: "retired" | "legacy",
	list: { format: FormatDef; count: number }[],
)}
	{#each list as u, index (`${u.format.pattern}/${u.format.check}`)}
		<Row align="center" data-testid="format-{key}-{role}-{index}">
			<code class="font-mono">{u.format.pattern}</code>
			<Hint as="span" tone="faint">
				{u.format.check === "none"
					? i18n.t("config.blocks.barcodeFormats.noCheck")
					: i18n.t(`config.blocks.barcodeFormats.checks.${u.format.check}`)}
				· {i18n.t("config.blocks.barcodeFormats.count", { count: u.count })}
			</Hint>
			<IconButton
				icon={DeleteIcon}
				label={i18n.t("config.blocks.barcodeFormats.remove")}
				disabled={u.count > 0}
				onclick={() => remove(key, role, index)}
				data-testid="format-{key}-{role}-{index}-remove"
			/>
		</Row>
	{/each}
{/snippet}

<Card variant="outlined" gap="4" id="barcode-formats" data-testid="block-barcode-formats">
	<h2 class="title-lg">{i18n.t("config.blocks.barcodeFormats.title")}</h2>
	<Hint>{i18n.t("config.blocks.barcodeFormats.hint")}</Hint>
	{#if draft}
		<div class="space-y-2">
			<span class="label-text">{i18n.t("config.blocks.barcodeFormats.preset")}</span>
			<SegmentedGroup
				fit
				radio
				aria-label={i18n.t("config.blocks.barcodeFormats.preset")}
				options={CODE_PRESETS.map((p) => ({
					value: p,
					label: i18n.t(`config.blocks.barcodeFormats.presets.${p}`),
					testid: `format-preset-${p}`,
				}))}
				value={preset}
				onselect={(p) => choosePreset(p, check === "none" ? "mod23" : check)}
			>
				{#if preset === "custom"}
					<ToggleButton role="radio" pressed={true} data-testid="format-preset-custom"
						>{i18n.t("config.blocks.barcodeFormats.presets.custom")}</ToggleButton
					>
				{/if}
			</SegmentedGroup>
		</div>
		<div class="space-y-2">
			<span class="label-text">{i18n.t("config.blocks.barcodeFormats.check")}</span>
			<SegmentedGroup
				fit
				radio
				aria-label={i18n.t("config.blocks.barcodeFormats.check")}
				options={CHECK_ALGORITHMS.map((c) => ({
					value: c,
					label: i18n.t(`config.blocks.barcodeFormats.checks.${c}`),
					testid: `format-check-${c}`,
				}))}
				value={check}
				onselect={chooseCheck}
			/>
			<Hint>{i18n.t("config.blocks.barcodeFormats.checkHint")}</Hint>
		</div>

		<Disclosure
			summary={i18n.t("config.blocks.barcodeFormats.advanced")}
			data-testid="format-advanced"
		>
			<div class="mt-3 space-y-3">
				<Hint>{i18n.t("config.blocks.barcodeFormats.tokens")}</Hint>
				<Grid>
					{#each KINDS as key (key)}
						<Field
							label={i18n.t(`config.blocks.barcodeFormats.pattern.${key}`)}
							name="format-{key}"
						>
							<Row>
								<Input
									class="font-mono"
									bind:value={draft[key].format.pattern}
									data-testid="format-{key}-pattern"
								/>
								<Select
									auto
									bind:value={draft[key].format.check}
									aria-label={i18n.t("config.blocks.barcodeFormats.check")}
									data-testid="format-{key}-check"
								>
									{#each CHECK_ALGORITHMS as c (c)}
										<option value={c}
											>{i18n.t(
												`config.blocks.barcodeFormats.checks.${c}`,
											)}</option
										>
									{/each}
								</Select>
							</Row>
						</Field>
					{/each}
					<Field
						label={i18n.t("config.blocks.barcodeFormats.libraryCode")}
						hint={i18n.t("config.blocks.barcodeFormats.libraryCodeHint")}
					>
						<Input
							class="font-mono"
							maxlength={8}
							bind:value={draft.libraryCode}
							data-testid="format-library-code"
						/>
					</Field>
					<Field
						label={i18n.t("config.blocks.barcodeFormats.plainMaxLength")}
						hint={plan && plan.plainLongest > 0
							? i18n.t("config.blocks.barcodeFormats.plainLongest", {
									digits: plan.plainLongest,
								})
							: i18n.t("config.blocks.barcodeFormats.plainHint")}
					>
						<Input
							type="number"
							min={0}
							max={20}
							value={draft.plainMaxLength}
							oninput={(e) => {
								const n = Number(e.currentTarget.value);
								if (draft && Number.isInteger(n) && n >= 0 && n <= 20) {
									draft.plainMaxLength = n;
								}
							}}
							data-testid="format-plain-max"
						/>
					</Field>
				</Grid>
			</div>
		</Disclosure>

		{#if plan}
			{#if plan.patterns.length > 0}
				<Alert live={false} data-testid="format-pattern-errors">
					{@render bullets(
						plan.patterns.map((p) =>
							i18n.t(`config.blocks.barcodeFormats.patternErrors.${p.code}`, {
								pattern: p.pattern,
								kind: kindLabel(p.kind),
							}),
						),
					)}
				</Alert>
			{:else if errors.length > 0}
				<Alert live={false} data-testid="format-verdict-error">
					<p>{i18n.t("config.blocks.barcodeFormats.confusable")}</p>
					{@render bullets(
						errors.map((e) =>
							i18n.t(`config.blocks.barcodeFormats.issues.${e.code}`, {
								pattern: e.pattern,
								other: e.otherPattern ?? "",
								example: e.example ?? "",
								kind: kindLabel(e.kind),
								otherKind: e.otherKind ? kindLabel(e.otherKind) : "",
							}),
						),
					)}
				</Alert>
			{:else}
				<Alert tone="success" live={false} data-testid="format-verdict-ok">
					{i18n.t("config.blocks.barcodeFormats.distinct")}
				</Alert>
			{/if}
			{#if warnings.length > 0}
				<Disclosure
					summary={i18n.t("config.blocks.barcodeFormats.warnings", {
						count: warnings.length,
					})}
					data-testid="format-warnings"
				>
					{@render bullets(
						warnings.map((w) =>
							i18n.t(`config.blocks.barcodeFormats.issues.${w.code}`, {
								pattern: w.pattern,
								other: w.otherPattern ?? "",
								example: w.example ?? "",
								kind: kindLabel(w.kind),
								otherKind: w.otherKind ? kindLabel(w.otherKind) : "",
							}),
						),
					)}
				</Disclosure>
			{/if}
			{#if plan.removals.length > 0}
				<Alert live={false} data-testid="format-removals">
					{@render bullets(
						plan.removals.map((r) =>
							i18n.t("config.blocks.barcodeFormats.inUse", {
								pattern: r.format.pattern,
								count: r.count,
							}),
						),
					)}
				</Alert>
			{/if}

			{#if plan.item && plan.card}
				<Grid>
					{#each kindPlans as [key, k] (key)}
						<section class="space-y-2" data-testid="format-{key}-plan">
							<h3 class="title-md">
								{i18n.t(`config.blocks.barcodeFormats.heading.${key}`)}
							</h3>
							<Hint>{i18n.t("config.blocks.barcodeFormats.examples")}</Hint>
							<p class="font-mono" data-testid="format-{key}-examples">
								{k.examples.join(" · ")}
							</p>
							<Hint tone="faint">
								{i18n.t("config.blocks.barcodeFormats.currentCount", {
									count: k.current.count,
								})}
							</Hint>
							{#if k.retired.length > 0}
								<span class="label-text"
									>{i18n.t("config.blocks.barcodeFormats.retired")}</span
								>
								{@render usageList(key, "retired", k.retired)}
							{/if}
							<span class="label-text"
								>{i18n.t("config.blocks.barcodeFormats.legacy")}</span
							>
							{#if k.legacy.length === 0}
								<Hint tone="faint"
									>{i18n.t("config.blocks.barcodeFormats.noLegacy")}</Hint
								>
							{/if}
							{@render usageList(key, "legacy", k.legacy)}
							<Row>
								<Input
									class="font-mono"
									placeholder="YYYY-NNNN"
									bind:value={newLegacy[key]}
									aria-label={i18n.t("config.blocks.barcodeFormats.addLegacy")}
									data-testid="format-{key}-legacy-new"
								/>
								<Button
									icon={AddIcon}
									variant="tonal"
									onclick={() => addLegacy(key)}
									disabled={newLegacy[key].trim() === ""}
									data-testid="format-{key}-legacy-add"
									>{i18n.t("config.blocks.barcodeFormats.addLegacy")}</Button
								>
							</Row>
						</section>
					{/each}
				</Grid>
			{/if}
		{/if}

		<Field
			label={i18n.t("config.blocks.barcodeFormats.try")}
			hint={i18n.t("config.blocks.barcodeFormats.tryHint")}
		>
			<Input class="font-mono" bind:value={tryCode} data-testid="format-try" />
		</Field>
		{#if tried}
			<p data-testid="format-try-result" class="text-sm">
				{i18n.t(`config.blocks.barcodeFormats.tried.${tried.kind}`, { value: tried.value })}
			</p>
		{/if}

		{#if editor.problem}
			<Alert>{editor.problem}</Alert>
		{/if}
		<Row justify="end">
			<DraftActions
				{dirty}
				saving={editor.saving}
				invalid={!plan?.ready}
				onsave={save}
				testid="format-save"
			/>
		</Row>
	{/if}
</Card>
