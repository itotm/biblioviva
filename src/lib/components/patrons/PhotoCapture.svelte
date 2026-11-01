<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	Portrait photo capture (step 2.3): camera (CameraCapture with a 3:4 guide) or file upload, then
	crop by dragging/zooming inside a 3:4 frame, exported as a 480×640 WebP File for `uploadPhoto`.
-->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { debugReport } from "#lib/debug.js";
	import { icons } from "#lib/ui/icons.js";
	import CameraCapture from "#lib/components/CameraCapture.svelte";
	import CaptureSourceRow from "#lib/components/CaptureSourceRow.svelte";
	import { CaptureSource, canvasFile } from "#lib/components/capture-source.svelte.js";
	import Button from "#lib/ui/Button.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Field from "#lib/ui/Field.svelte";

	interface Props {
		/** Called with the encoded WebP (480×640) when the operator confirms. */
		onphoto: (file: File) => void | Promise<void>;
		oncancel?: () => void;
		/** Output size (defaults to the app's photo settings). */
		width?: number;
		height?: number;
		/** Start with the camera open (phones) or with the two buttons. */
		autostart?: boolean;
		pending?: boolean;
	}

	const {
		onphoto,
		oncancel,
		width = 480,
		height = 640,
		autostart = false,
		pending = false,
	}: Props = $props();
	const i18n = useI18n();
	const RetryIcon = icons.renew;
	const OkIcon = icons.confirm;

	const capture = new CaptureSource<"crop">({
		tag: "photo",
		autostart: () => autostart,
		onload: crop,
		// not decodable in the browser: let the server explain it
		onundecodable: (file) => onphoto(file),
	});
	const source = $derived(capture.source);
	let zoom = $state(1);
	let offset = $state({ x: 0, y: 0 });
	let canvas = $state<HTMLCanvasElement>();
	let dragging: { x: number; y: number; ox: number; oy: number } | null = null;
	const FRAME_W = 240;
	const FRAME_H = 320;

	function crop(): void {
		zoom = 1;
		offset = { x: 0, y: 0 };
		// the camera stays on while cropping (hidden), so the next shot needs no restart (census flow)
		capture.mode = "crop";
		draw();
	}

	/** Scale so the image covers the frame at zoom 1; offsets are clamped so the frame stays full. */
	function geometry(target: {
		w: number;
		h: number;
	}): { w: number; h: number; dx: number; dy: number } | null {
		if (!source) {
			return null;
		}
		const cover =
			Math.max(target.w / source.naturalWidth, target.h / source.naturalHeight) * zoom;
		const w = source.naturalWidth * cover;
		const h = source.naturalHeight * cover;
		const maxX = (w - target.w) / 2;
		const maxY = (h - target.h) / 2;
		const scale = target.w / FRAME_W;
		const x = Math.max(-maxX, Math.min(maxX, offset.x * scale));
		const y = Math.max(-maxY, Math.min(maxY, offset.y * scale));
		return { w, h, dx: (target.w - w) / 2 + x, dy: (target.h - h) / 2 + y };
	}

	/** The parameters only make the effect below track zoom and offset. */
	function draw(..._deps: number[]): void {
		const ctx = canvas?.getContext("2d");
		const g = geometry({ w: FRAME_W, h: FRAME_H });
		if (!ctx || !g || !source) {
			return;
		}
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, FRAME_W, FRAME_H);
		ctx.drawImage(source, g.dx, g.dy, g.w, g.h);
	}

	$effect(() => {
		// redraw whenever the zoom or the offset change (read here so the effect tracks them)
		draw(zoom, offset.x, offset.y);
	});

	function onPointerDown(e: PointerEvent): void {
		dragging = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function onPointerMove(e: PointerEvent): void {
		if (!dragging) {
			return;
		}
		offset = {
			x: dragging.ox + (e.clientX - dragging.x),
			y: dragging.oy + (e.clientY - dragging.y),
		};
	}
	function onPointerUp(): void {
		dragging = null;
	}

	async function confirm(): Promise<void> {
		const g = geometry({ w: width, h: height });
		if (!g || !source) {
			return;
		}
		const out = document.createElement("canvas");
		out.width = width;
		out.height = height;
		const ctx = out.getContext("2d");
		if (!ctx) {
			return;
		}
		ctx.drawImage(source, g.dx, g.dy, g.w, g.h);
		const file = await canvasFile(out, "photo.webp");
		if (!file) {
			return;
		}
		debugReport("photo", "used", { bytes: file.size, zoom: Math.round(zoom * 100) / 100 });
		await onphoto(file);
	}

	/** Back to the camera (or the idle buttons) for the next shot; exported for the census flow. */
	export function reset(): void {
		capture.reset();
	}
</script>

{#snippet sourceRow(camera: boolean)}
	<CaptureSourceRow
		shootLabel={i18n.t("patrons.photo.take")}
		shootTestid={camera ? "photo-snapshot" : "photo-open-camera"}
		onshoot={camera ? capture.snapshot : capture.openCamera}
		shootDisabled={camera && !capture.cameraReady}
		uploadLabel={i18n.t("patrons.photo.upload")}
		uploadTestid="photo-file"
		onfile={capture.onFile}
		cancelLabel={i18n.t("patrons.photo.cancel")}
		{oncancel}
	/>
{/snippet}

<div class="space-y-3" data-testid="photo-capture">
	{#if capture.mode !== "idle"}
		<div class="space-y-3" class:hidden={capture.mode === "crop"}>
			<CameraCapture
				bind:this={capture.camera}
				facing="user"
				showDevices={false}
				stoppable={false}
				portrait
				onready={() => (capture.cameraReady = true)}
				onerror={() => (capture.cameraReady = false)}
			>
				<div
					class="absolute inset-y-[6%] left-1/2 aspect-[3/4] h-[88%] -translate-x-1/2 rounded-container border-4 border-surface-50/80"
				></div>
			</CameraCapture>
			{@render sourceRow(true)}
		</div>
	{/if}
	{#if capture.mode === "crop"}
		<Hint>{i18n.t("patrons.photo.dragHint")}</Hint>
		<canvas
			bind:this={canvas}
			width={FRAME_W}
			height={FRAME_H}
			class="touch-none rounded-container ring-2 ring-primary-500"
			style:cursor="grab"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			data-testid="photo-crop"
		></canvas>
		<Field label={i18n.t("patrons.photo.zoom")} class="max-w-60"
			><input
				type="range"
				min="1"
				max="3"
				step="0.05"
				bind:value={zoom}
				class="w-full"
			/></Field
		>
		<Row>
			<Button
				icon={OkIcon}
				variant="primary"
				onclick={confirm}
				disabled={pending}
				data-testid="photo-use"
				>{pending ? i18n.t("common.status.loading") : i18n.t("patrons.photo.use")}</Button
			>
			<Button icon={RetryIcon} onclick={reset} disabled={pending}
				>{i18n.t("patrons.photo.retake")}</Button
			>
			{#if oncancel}<Button onclick={oncancel} disabled={pending}
					>{i18n.t("patrons.photo.cancel")}</Button
				>{/if}
		</Row>
	{:else if capture.mode === "idle"}
		{@render sourceRow(false)}
	{/if}
</div>
