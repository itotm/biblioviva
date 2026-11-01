<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	Camera barcode scanner: video preview with a scan region, detection loop, identical results
	debounced for 1.5 s, visual flash + vibration + the configured beep on success (the only sound of
	the application, `barcodes.cameraSound`, Q137; the tap that opens the camera opens the audio with
	`unlockScanSound`). The detector
	(barcode-detector + WASM) is loaded lazily on mount. A read that is not a valid code (a partial
	or damaged read, a wrong check digit) is not reported: the frame turns amber with a small
	warning and the scanner keeps looking, so the operator just holds the code steady (9.13).
	A code counts only after it has been read the same way in consecutive frames (`confirmations`):
	a single-frame misread can pass the EAN check digit by chance (one in ten), two in a row do not.
	A valid code that `accept` refuses can be offered with a "use it anyway" button (`offer`).
-->
<script lang="ts">
	import { version } from "$app/env";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { reportScan } from "#lib/remote/debug.remote.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { createReadConfirmer } from "#lib/scanner/confirm.js";
	import { playScanSound, unlockScanSound } from "#lib/scanner/sound.js";
	import type { Detector, normaliseDetection } from "#lib/scanner/index.js";
	import type { ScanResult } from "#lib/shared/scan.js";
	import { useCodeTable } from "#lib/scanner/context.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Row from "#lib/ui/Row.svelte";
	import CameraCapture from "./CameraCapture.svelte";
	import Button from "#lib/ui/Button.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Loading from "#lib/ui/Loading.svelte";

	interface Props {
		onscan: (result: ScanResult) => void;
		onclose?: () => void;
		/**
		 * Which reads count (default: every valid code); the others are shown as bad reads while
		 * scanning goes on (fast add wants an ISBN or an EAN, not a fragment of one).
		 */
		accept?: (result: ScanResult) => boolean;
		/** The badge shown for a valid code that `accept` refuses (default: the invalid-read one). */
		rejectedLabel?: string;
		/** Which refused valid codes are offered with a "use it anyway" button (none by default). */
		offer?: (result: ScanResult) => boolean;
		/** Consecutive identical reads needed before a code counts. */
		confirmations?: number;
		/** Milliseconds during which the same value is not reported twice. */
		debounceMs?: number;
	}

	const {
		onscan,
		onclose,
		accept = (r: ScanResult) => r.kind !== "invalid",
		rejectedLabel,
		offer,
		confirmations = 2,
		debounceMs = 1500,
	}: Props = $props();
	const i18n = useI18n();
	const codes = useCodeTable();
	const CloseIcon = icons.close;
	const WarningIcon = icons.damaged;
	const UseIcon = icons.confirm;

	let camera = $state<CameraCapture>();
	let flash = $state(false);
	/** The last read that was not taken, shown briefly while scanning goes on. */
	let invalidRead = $state<string | null>(null);
	/** Whether that read was a valid code refused by `accept` (not a damaged read). */
	let refused = $state(false);
	/** The last refused valid code, offered until another code is taken. */
	let offered = $state<ScanResult | null>(null);
	let invalidTimer: ReturnType<typeof setTimeout> | undefined;
	let loading = $state(true);
	let frame = 0;
	let detector: Detector | null = null;
	let normalise: typeof normaliseDetection | null = null;
	let lastValue = "";
	let lastAt = 0;
	let busy = false;
	// svelte-ignore state_referenced_locally
	const confirmer = createReadConfirmer(confirmations);

	function take(result: ScanResult): void {
		invalidRead = null;
		offered = null;
		flash = true;
		setTimeout(() => (flash = false), 250);
		navigator.vibrate?.(80);
		void playScanSound(page.data.cameraSound ?? "off").catch(() => undefined); // silent, the flash stays
		onscan(result);
	}

	async function loop(): Promise<void> {
		const video = camera?.getVideo();
		if (video && video.readyState >= 2 && detector && normalise && !busy) {
			busy = true;
			try {
				const found = await detector.detect(video);
				const first = found[0];
				const now = performance.now();
				if (
					first &&
					confirmer.read(first.rawValue, now) &&
					(first.rawValue !== lastValue || now - lastAt > debounceMs)
				) {
					lastValue = first.rawValue;
					lastAt = now;
					const result = normalise(first, codes);
					const taken = result.kind !== "invalid" && accept(result);
					if (page.data.debug) {
						void reportScan({
							page: page.url.pathname,
							format: first.format,
							kind: result.kind,
							value: result.value,
							accepted: taken,
							build: version,
						}).catch(() => undefined); // a lost diagnostic report is harmless
					}
					if (taken) {
						take(result);
					} else {
						invalidRead = result.value;
						refused = result.kind !== "invalid";
						if (refused && offer?.(result)) {
							offered = result;
						}
						clearTimeout(invalidTimer);
						invalidTimer = setTimeout(() => (invalidRead = null), 2000);
					}
				}
			} catch {
				// a failed frame is simply skipped
			} finally {
				busy = false;
			}
		}
		frame = requestAnimationFrame(loop);
	}

	onMount(() => {
		// the tap that opened the camera opened the audio already; this covers a browser that
		// counts any earlier tap on the page
		unlockScanSound(page.data.cameraSound ?? "off");
		let cancelled = false;
		void import("#lib/scanner/index.js").then(async (mod) => {
			if (cancelled) {
				return;
			}
			detector = await mod.createDetector();
			normalise = mod.normaliseDetection;
			loading = false;
			frame = requestAnimationFrame(loop);
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
	});
</script>

<div class="space-y-3" data-testid="scanner-overlay">
	<Row align="center" justify="between" gap="0" wrap={false}>
		<h2 class="h4">{i18n.t("common.scan.cameraTitle")}</h2>
		{#if onclose}
			<IconButton icon={CloseIcon} label={i18n.t("common.actions.close")} onclick={onclose} />
		{/if}
	</Row>
	<CameraCapture bind:this={camera} showDevices={false} stoppable={false}>
		<div
			class="absolute inset-x-[10%] top-[30%] h-[40%] rounded-base border-4 {flash
				? 'border-success-500 bg-success-500/30'
				: invalidRead
					? 'border-warning-500'
					: 'border-surface-50/80'}"
		></div>
		{#if invalidRead}
			<span
				class="absolute bottom-3 left-1/2 badge inline-flex -translate-x-1/2 items-center gap-1 preset-filled-warning-500"
				role="status"
				data-testid="scan-invalid"
				title={i18n.t("common.scan.invalidRead", { code: invalidRead })}
			>
				<WarningIcon size={ICON_SIZE.sm} aria-hidden="true" />
				{refused && rejectedLabel ? rejectedLabel : i18n.t("common.scan.invalidShort")}
			</span>
		{/if}
	</CameraCapture>
	{#if offered}
		{@const code = offered}
		<Button icon={UseIcon} onclick={() => take(code)} data-testid="scan-use-anyway"
			>{i18n.t("common.scan.useAnyway", { code: code.value })}</Button
		>
	{/if}
	{#if loading}
		<Loading size="sm" />
	{/if}
</div>
