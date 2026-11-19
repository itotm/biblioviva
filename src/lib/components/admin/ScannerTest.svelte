<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The scanner test of the installation check (step 8.7): a field that shows what the barcode
     scanner typed, how BiblioViva reads it with the format table and the configured keyboard
     layout (the same normalisation as every code field), whether the Enter key came after the code,
     and what is wrong when the keyboard of the computer and the scanner's do not match (`'` typed
     in place of `-`). Nothing is searched or saved. -->
<script lang="ts">
	import { onDestroy } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useCodeTable } from "#lib/scanner/context.js";
	import { diagnoseScan } from "#lib/shared/scanner-test.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";

	/** How long a reading may wait for its Enter before the test says it did not come. */
	const ENTER_WAIT_MS = 1500;

	const i18n = useI18n();
	const codes = useCodeTable();
	const ScanIcon = icons.scan;
	const OkIcon = icons.available;
	const WarnIcon = icons.damaged;
	const ErrorIcon = icons.lost;

	let value = $state("");
	/** The reading closed by Enter, shown after the field has been cleared for the next one. */
	let frozen = $state<string | null>(null);
	/** Whether the Enter came after the code: null while nothing was read. */
	let enter = $state<boolean | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const shown = $derived(frozen ?? value);
	const diagnosis = $derived(shown.trim() ? diagnoseScan(shown, codes) : null);
	const layout = $derived(
		i18n.t(`config.options.barcodes.keyboardLayout.${codes.formats.layout}`),
	);

	function oninput(): void {
		frozen = null;
		enter = null;
		clearTimeout(timer);
		if (value.trim()) {
			timer = setTimeout(() => (enter = false), ENTER_WAIT_MS);
		}
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.key !== "Enter") {
			return;
		}
		e.preventDefault();
		clearTimeout(timer);
		if (value.trim()) {
			frozen = value;
			enter = true;
			value = "";
		}
	}

	function clear(): void {
		clearTimeout(timer);
		value = "";
		frozen = null;
		enter = null;
	}

	onDestroy(() => clearTimeout(timer));

	/** The verdict on a reading: what to tell, in what tone. */
	const verdict = $derived.by(() => {
		const d = diagnosis;
		if (!d) {
			return null;
		}
		if (d.layoutMishap) {
			const pairs = d.repairs
				.map((r) => i18n.t("admin.checklist.tests.scanner.verdict.pair", r))
				.join("; ");
			return {
				tone: "warning" as const,
				kind: "mishap",
				text:
					d.repairs.length > 0
						? i18n.t("admin.checklist.tests.scanner.verdict.mishap", { pairs, layout })
						: i18n.t("admin.checklist.tests.scanner.verdict.mishapOther", { layout }),
			};
		}
		if (d.kind === "invalid") {
			return d.strange.length > 0
				? {
						tone: "warning" as const,
						kind: "strange",
						text: i18n.t("admin.checklist.tests.scanner.verdict.strange", {
							chars: d.strange.join(" "),
						}),
					}
				: {
						tone: "error" as const,
						kind: "invalid",
						text: i18n.t(`common.scan.errors.${d.reason ?? "unrecognised"}`),
					};
		}
		return {
			tone: "success" as const,
			kind: "ok",
			text: i18n.t("admin.checklist.tests.scanner.verdict.ok"),
		};
	});
	const VerdictIcon = $derived(
		verdict?.tone === "success" ? OkIcon : verdict?.tone === "warning" ? WarnIcon : ErrorIcon,
	);
	const t = (key: string): string => i18n.t(`admin.checklist.tests.scanner.${key}`);
</script>

<div class="space-y-3" data-testid="scanner-test">
	<Field label={t("label")}>
		<Row align="center" wrap={false}>
			<ScanIcon size={ICON_SIZE.md} class="shrink-0" aria-hidden="true" />
			<Input
				bind:value
				mono
				class="grow"
				type="text"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck={false}
				placeholder={t("placeholder")}
				data-testid="scanner-field"
				{oninput}
				{onkeydown}
			/>
			<Button onclick={clear} disabled={!shown} data-testid="scanner-clear">
				{t("clear")}
			</Button>
		</Row>
	</Field>

	<div role="status" aria-live="polite" class="space-y-3" data-testid="scanner-reading">
		{#if diagnosis && verdict}
			<dl
				class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
				data-testid="scanner-details"
			>
				<dt class="opacity-70">{t("typed")}</dt>
				<dd class="font-mono break-all" data-testid="scanner-typed">{diagnosis.typed}</dd>
				<dt class="opacity-70">{t("code")}</dt>
				<dd class="font-mono break-all" data-testid="scanner-code">{diagnosis.code}</dd>
				<dt class="opacity-70">{t("kind")}</dt>
				<dd data-testid="scanner-kind" data-kind={diagnosis.kind}>
					{t(`kinds.${diagnosis.kind}`)}
				</dd>
				<dt class="opacity-70">{t("enter")}</dt>
				<dd data-testid="scanner-enter" data-state={String(enter)}>
					{enter === true
						? t("enterYes")
						: enter === false
							? t("enterNo")
							: t("enterWaiting")}
				</dd>
			</dl>
			<Alert
				tone={verdict.tone}
				padded
				as="div"
				live={false}
				icon={VerdictIcon}
				data-testid="scanner-verdict"
				data-verdict={verdict.kind}
			>
				{verdict.text}
			</Alert>
		{:else}
			<Hint data-testid="scanner-waiting">{t("waiting")}</Hint>
		{/if}
	</div>
</div>
