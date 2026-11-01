<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	Cover capture with perspective correction (PLAN.md step 3.7, Q6): camera or file, OpenCV.js
	loaded on demand with a determinate progress, automatic detection of the cover's corners,
	four draggable handles to fix them, warp to an upright rectangle, WebP at the configured width
	handed to `oncover` (the page submits it through `uploadCover`).
-->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { debugReport } from "#lib/debug.js";
	import { icons } from "#lib/ui/icons.js";
	import CameraCapture from "#lib/components/CameraCapture.svelte";
	import CaptureSourceRow from "#lib/components/CaptureSourceRow.svelte";
	import { CaptureSource, canvasFile } from "#lib/components/capture-source.svelte.js";
	import type { Point, Quad } from "#lib/shared/geometry.js";
	import { defaultQuad, detectQuad, scaleQuad, warpQuad } from "#lib/vision/dewarp.js";
	import { loadOpenCv, type CvModule, type LoadProgress } from "#lib/vision/loader.js";
	import { imageDataOf } from "#lib/vision/picture.js";
	import VisionLoading from "#lib/components/VisionLoading.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		/** Called with the straightened cover (WebP, `width` pixels wide) when the operator confirms. */
		oncover: (file: File) => void | Promise<void>;
		oncancel?: () => void;
		/** Output width (the app's `covers.width`, 600 by default). */
		width?: number;
		/** Start with the camera open (phones) or with the two buttons. */
		autostart?: boolean;
		pending?: boolean;
	}

	const { oncover, oncancel, width = 600, autostart = false, pending = false }: Props = $props();
	const i18n = useI18n();
	const RetryIcon = icons.renew;
	const OkIcon = icons.confirm;
	const StraightenIcon = icons.straighten;

	const capture = new CaptureSource<"loading" | "adjust" | "result">({
		tag: "cover",
		autostart: () => autostart,
		onload: adjust,
		// not decodable in the browser: let the server explain it
		onundecodable: (file) => oncover(file),
	});
	let cv: CvModule | null = null;
	let progress = $state<LoadProgress>({ loaded: 0, total: null });
	let loadError = $state(false);
	let detected = $state<boolean | null>(null);
	let quad = $state<Quad>(defaultQuad(300, 400));
	let display = $state({ width: 300, height: 400, scale: 1 });
	let root = $state<HTMLDivElement>();
	let stage = $state<HTMLDivElement>();
	let result = $state<HTMLCanvasElement | null>(null);
	let dragging: { index: number; pointerId: number } | null = null;

	/** Display size: fit the source inside the component's width, at most 560 px tall. */
	function fit(img: HTMLImageElement): void {
		const available =
			root?.clientWidth || (typeof window === "undefined" ? 640 : window.innerWidth - 32);
		const maxW = Math.max(240, Math.min(available, 900));
		const scale = Math.min(maxW / img.naturalWidth, 560 / img.naturalHeight, 1);
		display = {
			width: Math.round(img.naturalWidth * scale),
			height: Math.round(img.naturalHeight * scale),
			scale,
		};
	}

	async function adjust(img: HTMLImageElement): Promise<void> {
		await ensureOpenCv();
		if (!cv) {
			return;
		}
		fit(img);
		detect();
		capture.mode = "adjust";
	}

	async function ensureOpenCv(): Promise<void> {
		if (cv) {
			return;
		}
		capture.mode = "loading";
		loadError = false;
		try {
			const started = performance.now();
			cv = await loadOpenCv((p) => (progress = p));
			debugReport("cover", "opencv", { ms: Math.round(performance.now() - started) });
		} catch (e) {
			debugReport("cover", "opencv failed", {
				message: e instanceof Error ? e.message : String(e),
			});
			loadError = true;
			capture.mode = "idle";
		}
	}

	function detect(): void {
		const source = capture.source;
		if (!cv || !source) {
			return;
		}
		const started = performance.now();
		let pass: string | null = null;
		const found = detectQuad(cv, imageDataOf(source), {
			report: (p) => (pass = p),
		});
		detected = found !== null;
		debugReport("cover", "corners", {
			found: detected,
			pass,
			ms: Math.round(performance.now() - started),
			width: source.naturalWidth,
			height: source.naturalHeight,
		});
		quad = found ? scaleQuad(found, display.scale) : defaultQuad(display.width, display.height);
	}

	function clamp(p: Point): Point {
		return {
			x: Math.max(0, Math.min(display.width, p.x)),
			y: Math.max(0, Math.min(display.height, p.y)),
		};
	}

	function onPointerDown(index: number, e: PointerEvent): void {
		dragging = { index, pointerId: e.pointerId };
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}
	function onPointerMove(e: PointerEvent): void {
		if (!dragging || !stage) {
			return;
		}
		const rect = stage.getBoundingClientRect();
		const next = [...quad] as Quad;
		next[dragging.index] = clamp({ x: e.clientX - rect.left, y: e.clientY - rect.top });
		quad = next;
	}
	function onPointerUp(): void {
		dragging = null;
	}

	function straighten(): void {
		if (!cv || !capture.source) {
			return;
		}
		result = warpQuad(cv, capture.source, scaleQuad(quad, 1 / display.scale), width);
		debugReport("cover", "straightened", {
			width: result.width,
			height: result.height,
			moved: detected === false ? "manual" : "detected",
		});
		capture.mode = "result";
	}

	async function confirm(): Promise<void> {
		const file = result ? await canvasFile(result, "cover.webp") : null;
		if (file) {
			debugReport("cover", "used", { bytes: file.size });
			await oncover(file);
		}
	}

	/** Back to the camera (or the idle buttons) for the next shot. */
	export function reset(): void {
		result = null;
		detected = null;
		capture.reset();
	}

	const polygon = $derived(quad.map((p) => `${p.x},${p.y}`).join(" "));
</script>

{#snippet sourceRow(camera: boolean)}
	<CaptureSourceRow
		shootLabel={i18n.t(camera ? "catalog.cover.shoot" : "catalog.cover.take")}
		shootTestid={camera ? "cover-snapshot" : "cover-open-camera"}
		onshoot={camera ? capture.snapshot : capture.openCamera}
		shootDisabled={camera && !capture.cameraReady}
		uploadLabel={i18n.t("catalog.cover.upload")}
		uploadTestid="cover-file"
		onfile={capture.onFile}
		cancelLabel={i18n.t("catalog.cover.cancel")}
		{oncancel}
	/>
{/snippet}

<div class="space-y-3" bind:this={root} data-testid="cover-capture">
	{#if capture.mode === "camera"}
		<div class="space-y-3">
			<CameraCapture
				bind:this={capture.camera}
				facing="environment"
				showDevices={false}
				stoppable={false}
				portrait
				onready={() => (capture.cameraReady = true)}
				onerror={() => (capture.cameraReady = false)}
			>
				<div
					class="absolute inset-[6%] rounded-container border-4 border-dashed border-surface-50/80"
				></div>
			</CameraCapture>
			<Hint>{i18n.t("catalog.cover.cameraHint")}</Hint>
			{@render sourceRow(true)}
		</div>
	{:else if capture.mode === "loading"}
		<VisionLoading {progress} testid="cover-loading" />
	{:else if capture.mode === "adjust" && capture.source}
		<Hint data-testid="cover-detect-status">
			{detected ? i18n.t("catalog.cover.adjustHint") : i18n.t("catalog.cover.notFound")}
		</Hint>
		<div
			bind:this={stage}
			class="relative mx-auto touch-none overflow-hidden rounded-container bg-surface-900 select-none"
			style:width="{display.width}px"
			style:height="{display.height}px"
			role="application"
			aria-label={i18n.t("catalog.cover.adjustHint")}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			data-testid="cover-stage"
		>
			<img
				src={capture.source.src}
				width={display.width}
				height={display.height}
				alt=""
				class="block"
				draggable="false"
			/>
			<svg
				class="overlay-fill"
				viewBox="0 0 {display.width} {display.height}"
				aria-hidden="true"
			>
				<polygon
					points={polygon}
					fill="rgba(0, 120, 255, 0.15)"
					stroke="#ffffff"
					stroke-width="2"
				/>
				{#each quad as p, i (i)}
					<circle
						cx={p.x}
						cy={p.y}
						r="14"
						fill="rgba(255,255,255,0.9)"
						stroke="var(--color-primary-500)"
						stroke-width="3"
						class="pointer-events-auto cursor-grab"
						role="slider"
						aria-label={String(i + 1)}
						aria-valuenow={Math.round(p.x)}
						tabindex="-1"
						onpointerdown={(e) => onPointerDown(i, e)}
						data-testid="cover-corner-{i}"
					/>
				{/each}
			</svg>
		</div>
		<Row>
			<Button
				variant="primary"
				icon={StraightenIcon}
				onclick={straighten}
				data-testid="cover-straighten">{i18n.t("catalog.cover.straighten")}</Button
			>
			<Button icon={RetryIcon} onclick={reset}>{i18n.t("catalog.cover.retake")}</Button>
			{#if oncancel}<Button onclick={oncancel}>{i18n.t("catalog.cover.cancel")}</Button>{/if}
		</Row>
	{:else if capture.mode === "result" && result}
		<p class="label-text">{i18n.t("catalog.cover.result")}</p>
		<div class="flex justify-center rounded-container bg-surface-100 p-3">
			{#key result}
				<canvas
					class="max-h-[420px] max-w-full rounded-base shadow"
					data-testid="cover-result"
					{@attach (node: HTMLCanvasElement) => {
						node.width = result?.width ?? 1;
						node.height = result?.height ?? 1;
						if (result) {
							node.getContext("2d")?.drawImage(result, 0, 0);
						}
					}}
				></canvas>
			{/key}
		</div>
		<Row>
			<Button
				icon={OkIcon}
				variant="primary"
				onclick={confirm}
				disabled={pending}
				data-testid="cover-use"
				>{pending ? i18n.t("common.status.loading") : i18n.t("catalog.cover.use")}</Button
			>
			<Button icon={RetryIcon} onclick={() => (capture.mode = "adjust")} disabled={pending}
				>{i18n.t("catalog.cover.retake")}</Button
			>
			{#if oncancel}<Button onclick={oncancel} disabled={pending}
					>{i18n.t("catalog.cover.cancel")}</Button
				>{/if}
		</Row>
	{:else}
		{@render sourceRow(false)}
		{#if loadError}
			<p class="text-error-700" role="alert" data-testid="cover-load-error">
				{i18n.t("catalog.cover.loadFailed")}
			</p>
		{/if}
	{/if}
</div>
