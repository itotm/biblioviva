<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Counters and preview on the "Codici a barre" settings page (step 11.4): where new card numbers
     start (after the highest old card, or from a chosen number), and the next card number and copy
     barcode drawn with the barcode type chosen in the form above — nothing is used up. Templates
     that force their own barcode type are named. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getBarcodeSettings,
		previewBarcodeCounters,
		saveBarcodeCounter,
	} from "#lib/remote/library-codes.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		/** Barcode types chosen in the form (not saved yet, maybe). */
		patronSymbology: string;
		itemSymbology: string;
		dirty?: boolean;
	}

	let { patronSymbology, itemSymbology, dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const settings = getBarcodeSettings();

	let mode = $state<"afterLegacyMax" | "from">("afterLegacyMax");
	let from = $state<number | null>(null);
	const maxStart = $derived(settings.current?.cardCapacity ?? 999_999_999);
	const value = $derived<"afterLegacyMax" | number | null>(
		mode === "afterLegacyMax"
			? "afterLegacyMax"
			: from !== null && Number.isInteger(from) && from >= 1 && from <= maxStart
				? from
				: null,
	);
	const editor = new DraftEditor(() => value);
	editor.loadWhenReady(
		() => settings.current !== undefined,
		() => {
			const start = settings.current?.counterStart ?? "afterLegacyMax";
			mode = start === "afterLegacyMax" ? "afterLegacyMax" : "from";
			from = typeof start === "number" ? start : null;
			editor.mark();
		},
	);
	$effect(() => {
		dirty = editor.dirty;
	});

	type Preview = Awaited<ReturnType<typeof previewBarcodeCounters>>;
	let preview = $state<Preview | null>(null);
	let sequence = 0;
	$effect(() => {
		const start = value;
		const mine = ++sequence;
		if (start === null) {
			return;
		}
		const timer = setTimeout(() => {
			void previewBarcodeCounters({ counterStart: start }).then((p) => {
				if (mine === sequence && p) {
					preview = p;
				}
			});
		}, 250);
		return () => clearTimeout(timer);
	});

	const image = (code: string, symbology: string): string =>
		`/media/barcode/${encodeURIComponent(code)}.svg?symbology=${symbology === "code39" ? "code39" : "code128"}&text=1`;

	function save(): Promise<void> {
		const start = value;
		if (start === null) {
			return Promise.resolve();
		}
		return editor.save(
			() => saveBarcodeCounter({ counterStart: start }),
			i18n.t("config.blocks.barcodes.saved"),
			() => settings.refresh(),
		);
	}
</script>

{#snippet shown(caption: string, code: string, symbology: string, testid: string, note?: string)}
	<figure class="space-y-2" data-testid={testid}>
		<figcaption class="label-text">{caption}</figcaption>
		<img src={image(code, symbology)} alt={code} class="h-16 max-w-full bg-white p-2" />
		{#if note}<Hint tone="faint">{note}</Hint>{/if}
	</figure>
{/snippet}

<Card variant="outlined" gap="4" id="barcodes" data-testid="block-barcodes">
	<h2 class="title-lg">{i18n.t("config.blocks.barcodes.title")}</h2>
	<fieldset class="space-y-2">
		<legend class="label-text">{i18n.t("config.blocks.barcodes.counter")}</legend>
		<Row as="label" align="center">
			<input
				type="radio"
				class="radio"
				name="counter-start"
				value="afterLegacyMax"
				bind:group={mode}
				data-testid="counter-after-legacy"
			/>
			<span>{i18n.t("config.blocks.barcodes.afterLegacy")}</span>
		</Row>
		<Row as="label" align="center">
			<input
				type="radio"
				class="radio"
				name="counter-start"
				value="from"
				bind:group={mode}
				data-testid="counter-from"
			/>
			<span>{i18n.t("config.blocks.barcodes.from")}</span>
			<Input
				type="number"
				class="w-40"
				min={1}
				max={maxStart}
				step={1}
				value={from ?? ""}
				oninput={(e) => {
					from = e.currentTarget.value === "" ? null : Number(e.currentTarget.value);
					mode = "from";
				}}
				aria-label={i18n.t("config.blocks.barcodes.fromNumber")}
				data-testid="counter-from-number"
			/>
		</Row>
		<Hint>{i18n.t("config.blocks.barcodes.counterHint")}</Hint>
		{#if mode === "from" && value === null}
			<Hint tone="error">
				{from !== null && from > maxStart
					? i18n.t("config.section.max", { max: maxStart })
					: i18n.t("config.section.min", { min: 1 })}
			</Hint>
		{/if}
	</fieldset>

	{#if preview}
		<Grid>
			{@render shown(
				i18n.t("config.blocks.barcodes.nextCard", { code: preview.card }),
				preview.card,
				patronSymbology,
				"preview-card",
			)}
			{@render shown(
				i18n.t("config.blocks.barcodes.nextItem", { code: preview.item }),
				preview.item,
				itemSymbology,
				"preview-item",
			)}
		</Grid>
	{/if}
	{#if (settings.current?.overrides ?? []).length > 0}
		<Alert tone="warning" live={false} data-testid="symbology-overrides">
			{i18n.t("config.blocks.barcodes.overrides", {
				templates: (settings.current?.overrides ?? [])
					.map((o) => `${o.name} (${o.symbology})`)
					.join(", "),
			})}
		</Alert>
	{/if}
	{#if editor.problem}
		<Alert>{editor.problem}</Alert>
	{/if}
	<Row justify="end">
		<DraftActions
			{dirty}
			saving={editor.saving}
			onsave={save}
			invalid={value === null}
			testid="counter-save"
		/>
	</Row>
</Card>
