<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Adding to a print list with the scanner (step 2.8): a card number to a list of cards, a copy's
     barcode to a list of copies; the outcome (added, already there, unknown, the other kind) is
     said under the input. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { addItemByBarcode, addPatronByCard } from "#lib/remote/print-lists.remote.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Row from "#lib/ui/Row.svelte";
	import BarcodeInput from "../BarcodeInput.svelte";

	interface Props {
		listId: number;
		kind: "items" | "patrons";
		busy: boolean;
		/** Runs a change of the list, marking the page busy meanwhile. */
		run: <R>(fn: () => Promise<R>) => Promise<R | undefined>;
	}

	const { listId, kind, busy, run }: Props = $props();
	const i18n = useI18n();
	const ScanIcon = icons.scan;
	let notice = $state<{ tone: "success" | "warning" | "error"; text: string } | null>(null);

	async function onScanItem(code: string, value: string): Promise<void> {
		// legacy plain counters come through as `ambiguous`: the lookup by barcode decides
		if (code !== "item" && code !== "legacy_item" && code !== "ambiguous") {
			notice = { tone: "error", text: i18n.t("printing.list.scan.notItem") };
			return;
		}
		const r = await run(() => addItemByBarcode({ listId, barcode: value }));
		if (!r) {
			return;
		}
		if (!r.ok) {
			notice = {
				tone: "error",
				text: i18n.t("printing.list.scan.unknownItem", { barcode: value }),
			};
			return;
		}
		const params = { title: r.row?.title ?? "", barcode: r.row?.barcode ?? value };
		notice = r.duplicate
			? { tone: "warning", text: i18n.t("printing.list.scan.duplicateItem", params) }
			: { tone: "success", text: i18n.t("printing.list.scan.addedItem", params) };
	}

	async function onScanCard(code: string, value: string): Promise<void> {
		// legacy plain counters come through as `ambiguous`: the lookup by card number decides
		if (code !== "card" && code !== "ambiguous") {
			notice = { tone: "error", text: i18n.t("printing.list.scan.notCard") };
			return;
		}
		const r = await run(() => addPatronByCard({ listId, cardNumber: value }));
		if (!r) {
			return;
		}
		if (!r.ok) {
			notice = {
				tone: "error",
				text: i18n.t("printing.list.scan.unknown", { card: value }),
			};
			return;
		}
		const name = r.row ? patronSortName(r.row) : value;
		notice = r.duplicate
			? { tone: "warning", text: i18n.t("printing.list.scan.duplicate", { name }) }
			: { tone: "success", text: i18n.t("printing.list.scan.added", { name }) };
	}
</script>

<Card gap="3" as="section" data-testid="scan-panel">
	<Row as="h2" align="center" wrap={false} class="font-semibold">
		<ScanIcon size={ICON_SIZE.md} aria-hidden="true" />
		{i18n.t("printing.list.scan.title")}
	</Row>
	<Hint
		>{i18n.t(
			kind === "items" ? "printing.list.scan.hintItems" : "printing.list.scan.hint",
		)}</Hint
	>
	<BarcodeInput
		onscan={(code, value) =>
			void (kind === "items" ? onScanItem(code, value) : onScanCard(code, value))}
		disabled={busy}
	/>
	{#if notice}
		<Alert tone={notice.tone} role="status" data-testid="scan-notice">
			{notice.text}
		</Alert>
	{/if}
</Card>
