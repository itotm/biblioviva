<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	Scanner-first code input (PLAN.md §3.7): a code is taken on Enter (a scanner sends it by itself
	when configured with the Enter suffix; there is no automatic submit, 9.13 round 16, so whoever
	types can check before sending), normalises layout mishaps (`'`/space for `-`), recognises the
	code kind and reports it through `onscan(kind, value, result)`. On a phone the keyboard is the
	one with letters, in capitals, since copy and card codes carry letters; the optional camera
	button lazy-loads the scanner overlay. With `patrons` (the checkout desk's first field, 9.13
	round 33) the same field also finds a patron by name: from three characters a list of patrons
	opens under it (arrow keys, Enter, Escape), and Enter on a text that is not a code picks the
	highlighted one.
-->
<script lang="ts">
	import { page } from "$app/state";
	import { recogniseScan, type ScanKind, type ScanResult } from "#lib/shared/scan.js";
	import { useCodeTable } from "#lib/scanner/context.js";
	import { unlockScanSound } from "#lib/scanner/sound.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { debugReport, maskCard } from "#lib/debug.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Hint from "#lib/ui/Hint.svelte";
	import { SEARCH_MIN_CHARS } from "#lib/shared/text.js";
	import type { findPatronsAtDesk } from "#lib/remote/circulation.remote.js";
	import type { QuickPatron } from "#lib/server/services/patron-search.js";
	import PatronOptions from "./patrons/PatronOptions.svelte";
	import CameraStage from "./CameraStage.svelte";

	interface Props {
		value?: string;
		label?: string;
		placeholder?: string;
		/** Reported when a valid code is recognised (`ambiguous` included: the caller resolves it). */
		onscan: (kind: Exclude<ScanKind, "invalid">, value: string, result: ScanResult) => void;
		/** Reported for invalid codes (the component already shows the message). */
		oninvalid?: (result: ScanResult) => void;
		/** Which camera reads count (see ScannerOverlay); the others do not stop the scan. */
		cameraAccept?: (result: ScanResult) => boolean;
		/** Badge for a valid camera read that `cameraAccept` refuses. */
		cameraRejectedLabel?: string;
		/** Refused camera reads offered with a "use it anyway" button. */
		cameraOffer?: (result: ScanResult) => boolean;
		/** Show the camera button (lazy-loads the scanner). */
		camera?: boolean;
		/** Keep the field focused and empty after each scan (circulation desk). */
		clearAfterScan?: boolean;
		/** The name search of the patrons (a remote query): the field finds a patron by name too. */
		patrons?: typeof findPatronsAtDesk;
		/** A patron picked from the list of `patrons`. */
		onpatron?: (patron: QuickPatron) => void;
		autofocus?: boolean;
		disabled?: boolean;
		id?: string;
		class?: string;
		/** The `data-testid` of the field's block (its list of patrons: `<testid>-results`). */
		testid?: string;
	}

	let {
		value = $bindable(""),
		label,
		placeholder,
		onscan,
		oninvalid,
		camera = false,
		cameraAccept,
		cameraRejectedLabel,
		cameraOffer,
		clearAfterScan = true,
		patrons,
		onpatron,
		autofocus = false,
		disabled = false,
		id: idProp,
		class: className = "",
		testid = "barcode-input",
	}: Props = $props();

	const uid = $props.id();
	const id = $derived(idProp ?? `barcode-${uid}`);
	const i18n = useI18n();
	const codes = useCodeTable();
	const ScanIcon = icons.scan;
	const CameraIcon = icons.camera;

	let input = $state<HTMLInputElement>();
	let error = $state<string | null>(null);
	let showCamera = $state(false);

	export function focus(): void {
		input?.focus();
	}

	// the name search (`patrons`): a short pause after the last key, then the list
	let debounced = $state("");
	let active = $state(0);
	$effect(() => {
		const typed = value.trim();
		if (!patrons) {
			return;
		}
		const timer = setTimeout(() => {
			debounced = typed;
			active = 0;
		}, 200);
		return () => clearTimeout(timer);
	});
	const found = $derived(
		patrons && debounced.length >= SEARCH_MIN_CHARS ? patrons(debounced) : null,
	);
	const rows = $derived(found?.current ?? []);
	const listOpen = $derived(found !== null && value.trim() !== "");
	const activeRow = $derived(listOpen ? rows[active] : undefined);

	function pick(patron: QuickPatron): void {
		value = "";
		debounced = "";
		error = null;
		onpatron?.(patron);
	}

	/** A text that is not a code: with the name search, a name being typed rather than a mistake. */
	function isName(text: string): boolean {
		const { result } = recogniseScan(text, codes);
		return result.kind === "invalid" && result.reason === "unrecognised";
	}

	function submit(): void {
		const { result } = recogniseScan(value, codes);
		debugReport("code", result.kind === "invalid" ? "refused" : "entered", {
			kind: result.kind,
			value: maskCard(result.kind, result.value),
			reason: result.kind === "invalid" ? (result.reason ?? null) : null,
		});
		if (result.kind === "invalid") {
			error = i18n.t(`common.scan.errors.${result.reason ?? "unrecognised"}`);
			oninvalid?.(result);
			input?.select();
			return;
		}
		error = null;
		value = clearAfterScan ? "" : result.value;
		onscan(result.kind, result.value, result);
	}

	function onkeydown(e: KeyboardEvent): void {
		if (listOpen && e.key === "ArrowDown") {
			e.preventDefault();
			active = Math.min(active + 1, Math.max(rows.length - 1, 0));
		} else if (listOpen && e.key === "ArrowUp") {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (patrons && e.key === "Escape") {
			value = "";
			debounced = "";
		} else if (e.key === "Enter") {
			e.preventDefault();
			const typed = value.trim();
			if (!typed) {
				return;
			}
			if (patrons && isName(typed)) {
				const row = debounced === typed ? rows[active] : undefined;
				if (row) {
					pick(row);
				} else {
					// typed faster than the pause: search now, the list opens under the field
					debounced = typed;
					active = 0;
				}
				return;
			}
			submit();
		}
	}

	function oninput(): void {
		error = null;
	}

	// the camera reports valid codes only (it keeps scanning past bad reads): the first one wins
	function onCameraScan(result: ScanResult): void {
		showCamera = false;
		if (result.kind === "invalid") {
			return;
		}
		error = null;
		onscan(result.kind, result.value, result);
	}
</script>

<div class="relative space-y-2 {className}" data-testid={testid}>
	<label class="label" for={id}>
		<span class="label-text">{label ?? i18n.t("common.scan.label")}</span>
	</label>
	<div class="input-group joined grid-cols-[auto_1fr_auto]">
		<span class="ig-cell preset-tonal" aria-hidden="true">
			<ScanIcon size={ICON_SIZE.md} />
		</span>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			{id}
			bind:this={input}
			bind:value
			class="ig-input"
			type="text"
			inputmode="text"
			autocomplete="off"
			autocapitalize={patrons ? "words" : "characters"}
			autocorrect="off"
			spellcheck={false}
			enterkeyhint="go"
			placeholder={placeholder ?? i18n.t("common.scan.placeholder")}
			role={patrons ? "combobox" : undefined}
			aria-expanded={patrons ? listOpen : undefined}
			aria-controls={patrons ? `${id}-list` : undefined}
			aria-activedescendant={activeRow ? `${id}-list-opt-${activeRow.id}` : undefined}
			aria-invalid={error ? "true" : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
			{autofocus}
			{disabled}
			{onkeydown}
			{oninput}
		/>
		{#if camera}
			<button
				type="button"
				class="ig-btn preset-tonal"
				aria-label={i18n.t("common.scan.camera")}
				title={i18n.t("common.scan.camera")}
				onclick={() => {
					unlockScanSound(page.data.cameraSound ?? "off");
					showCamera = !showCamera;
				}}
				{disabled}
			>
				<CameraIcon size={ICON_SIZE.md} aria-hidden="true" />
			</button>
		{:else}
			<button
				type="button"
				class="ig-btn preset-filled-primary-500"
				aria-label={i18n.t("common.scan.submit")}
				title={i18n.t("common.scan.submit")}
				onclick={submit}
				disabled={disabled || !value.trim()}
			>
				<span aria-hidden="true">↵</span>
			</button>
		{/if}
	</div>
	{#if listOpen}
		<PatronOptions id="{id}-list" {rows} {active} onpick={pick} testid="{testid}-results" />
	{/if}
	{#if error}
		<Hint tone="error" id="{id}-error" role="alert" data-testid="barcode-error">
			{error}
		</Hint>
	{/if}
	{#if showCamera}
		<!-- full screen on a phone, so the camera is never half off the screen (9.13) -->
		<CameraStage data-testid="barcode-camera" onclose={() => (showCamera = false)}>
			{#await import("./ScannerOverlay.svelte") then { default: ScannerOverlay }}
				<ScannerOverlay
					accept={cameraAccept}
					rejectedLabel={cameraRejectedLabel}
					offer={cameraOffer}
					onscan={onCameraScan}
					onclose={() => (showCamera = false)}
				/>
			{/await}
		</CameraStage>
	{/if}
</div>
