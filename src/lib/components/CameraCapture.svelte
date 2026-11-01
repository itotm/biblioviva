<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	getUserMedia wrapper (PLAN.md step 1.6): device selection, facing mode, torch when supported,
	snapshot to canvas, and clear messages when the camera is unavailable (denied permission,
	insecure context, no device, device busy). The parent reads frames through `getVideo()`.
-->
<script lang="ts">
	import Overlay from "#lib/ui/Overlay.svelte";
	import { onMount, type Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { debugReport } from "#lib/debug.js";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Row from "#lib/ui/Row.svelte";

	type CameraError = "insecure" | "denied" | "notFound" | "busy" | "timeout" | "generic";
	/** Firefox shows the permission prompt in the address bar: after this long without an answer we explain. */
	const START_TIMEOUT_MS = 20_000;

	interface Props {
		facing?: "user" | "environment";
		/** Start as soon as the component mounts. */
		autostart?: boolean;
		/** Show the device selector when more than one camera exists. */
		showDevices?: boolean;
		/**
		 * A portrait preview (3:4) instead of 4:3, for covers and faces: on a phone held upright it
		 * fills the screen width and most of its height (9.13).
		 */
		portrait?: boolean;
		/** Show the "stop the camera" button (off where the page has its own close, 9.13). */
		stoppable?: boolean;
		/** Show the "take photo" button (calls `onsnapshot`). */
		snapshotButton?: boolean;
		onsnapshot?: (blob: Blob) => void;
		onready?: (video: HTMLVideoElement) => void;
		onerror?: (error: CameraError) => void;
		/** Overlay drawn on top of the video (scan region, hints…). */
		children?: Snippet;
		class?: string;
		/** Injected in tests; defaults to `navigator.mediaDevices`, `null` = not available. */
		mediaDevices?: MediaDevices | null;
	}

	let {
		facing = "environment",
		autostart = true,
		showDevices = true,
		stoppable = true,
		portrait = false,
		snapshotButton = false,
		onsnapshot,
		onready,
		onerror,
		children,
		class: className = "",
		mediaDevices = typeof navigator === "undefined" ? null : (navigator.mediaDevices ?? null),
	}: Props = $props();

	const i18n = useI18n();
	let video = $state<HTMLVideoElement>();
	let stream = $state<MediaStream | null>(null);
	let starting = $state(false);
	let error = $state<{ kind: CameraError; message?: string } | null>(null);
	let devices = $state<MediaDeviceInfo[]>([]);
	let deviceId = $state<string | undefined>(undefined);
	let torchSupported = $state(false);
	let torchOn = $state(false);
	const active = $derived(stream !== null);

	const StartIcon = icons.camera;
	const StopIcon = icons.cameraOff;
	const SwitchIcon = icons.switchCamera;
	const TorchIcon = icons.torch;
	const TorchOffIcon = icons.torchOff;

	function classify(e: unknown): { kind: CameraError; message?: string } {
		const name = e instanceof DOMException ? e.name : "";
		if (
			name === "NotSupportedError" ||
			(typeof window !== "undefined" && !window.isSecureContext)
		) {
			return { kind: "insecure" };
		}
		if (name === "NotAllowedError" || name === "SecurityError") {
			return { kind: "denied" };
		}
		if (name === "NotFoundError" || name === "OverconstrainedError") {
			return { kind: "notFound" };
		}
		if (name === "NotReadableError" || name === "AbortError") {
			return { kind: "busy" };
		}
		if (name === "TimeoutError") {
			return { kind: "timeout" };
		}
		return { kind: "generic", message: e instanceof Error ? e.message : String(e) };
	}

	/** `play()` may resolve before the first frame: wait until the video has real dimensions. */
	function waitForFrames(v: HTMLVideoElement, timeoutMs = 3000): Promise<void> {
		return new Promise((resolve) => {
			const started = performance.now();
			const tick = (): void => {
				if (v.videoWidth > 0 || performance.now() - started > timeoutMs) {
					resolve();
				} else {
					requestAnimationFrame(tick);
				}
			};
			tick();
		});
	}

	export async function start(): Promise<void> {
		stop();
		error = null;
		if (
			!mediaDevices?.getUserMedia ||
			(typeof window !== "undefined" && !window.isSecureContext)
		) {
			error = { kind: "insecure" };
			onerror?.("insecure");
			return;
		}
		starting = true;
		try {
			const constraints: MediaStreamConstraints = {
				audio: false,
				video: deviceId
					? { deviceId: { exact: deviceId } }
					: { facingMode: { ideal: facing } },
			};
			const s = await Promise.race([
				mediaDevices.getUserMedia(constraints),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new DOMException("no answer", "TimeoutError")),
						START_TIMEOUT_MS,
					),
				),
			]);
			stream = s;
			if (video) {
				video.srcObject = s;
				await video.play();
				await waitForFrames(video);
				onready?.(video);
			}
			const track = s.getVideoTracks()[0];
			const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
				torch?: boolean;
			};
			torchSupported = caps.torch === true;
			if (showDevices && mediaDevices.enumerateDevices) {
				devices = (await mediaDevices.enumerateDevices()).filter(
					(d) => d.kind === "videoinput",
				);
				deviceId ??= track?.getSettings().deviceId;
			}
			const settings = track?.getSettings();
			debugReport("camera", "started", {
				width: video?.videoWidth ?? null,
				height: video?.videoHeight ?? null,
				facing: settings?.facingMode ?? facing,
				torch: torchSupported,
				devices: devices.length,
			});
		} catch (e) {
			error = classify(e);
			debugReport("camera", "failed", {
				kind: error.kind,
				name: e instanceof DOMException ? e.name : null,
				message: error.message ?? null,
			});
			onerror?.(error.kind);
			stream = null;
		} finally {
			starting = false;
		}
	}

	export function stop(): void {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		torchOn = false;
		if (video) {
			video.srcObject = null;
		}
	}

	export function getVideo(): HTMLVideoElement | undefined {
		return video;
	}

	/** JPEG snapshot of the current frame. */
	export function snapshot(quality = 0.9): Promise<Blob | null> {
		return new Promise((resolve) => {
			if (!video?.videoWidth) {
				return resolve(null);
			}
			const canvas = document.createElement("canvas");
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			canvas.getContext("2d")?.drawImage(video, 0, 0);
			canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
		});
	}

	async function takeSnapshot(): Promise<void> {
		const blob = await snapshot();
		if (blob) {
			onsnapshot?.(blob);
		}
	}

	async function toggleTorch(): Promise<void> {
		const track = stream?.getVideoTracks()[0];
		if (!track) {
			return;
		}
		try {
			await track.applyConstraints({
				advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
			});
			torchOn = !torchOn;
		} catch {
			torchSupported = false;
		}
	}

	async function switchDevice(id: string): Promise<void> {
		deviceId = id;
		await start();
	}

	async function switchFacing(): Promise<void> {
		facing = facing === "user" ? "environment" : "user";
		deviceId = undefined;
		await start();
	}

	// onMount, not $effect: start() reads reactive state and must not re-run when it changes.
	onMount(() => {
		if (autostart) {
			void start();
		}
		return () => stop();
	});
</script>

<div class="space-y-2 {className}" data-testid="camera-capture">
	<div
		class="relative overflow-hidden rounded-container bg-surface-950 {portrait
			? 'mx-auto aspect-[3/4] max-h-[65svh] md:max-w-md'
			: 'aspect-[4/3]'}"
	>
		<video
			bind:this={video}
			class="h-full w-full object-cover {active ? '' : 'invisible'}"
			playsinline
			muted
			autoplay
		></video>
		{#if active && children}
			<Overlay>{@render children()}</Overlay>
		{/if}
		{#if starting}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-surface-50"
			>
				<p class="font-semibold">{i18n.t("common.camera.starting")}</p>
				<Hint tone="soft">{i18n.t("common.camera.permissionHint")}</Hint>
			</div>
		{/if}
		{#if error}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-surface-50"
				role="alert"
				data-testid="camera-error"
			>
				<StopIcon size={40} aria-hidden="true" />
				<p>
					{i18n.t(`common.camera.errors.${error.kind}`, { message: error.message ?? "" })}
				</p>
				{#if error.kind !== "insecure"}
					<button type="button" class="btn preset-filled-surface-50-950" onclick={start}>
						{i18n.t("common.actions.retry")}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<Row align="center">
		{#if active}
			{#if stoppable}
				<Button icon={StopIcon} onclick={stop}>{i18n.t("common.camera.stop")}</Button>
			{/if}
			<Button
				icon={SwitchIcon}
				onclick={switchFacing}
				aria-label={i18n.t("common.camera.switch")}
				title={i18n.t("common.camera.switch")}
			/>
			{#if torchSupported}
				<Button
					icon={torchOn ? TorchOffIcon : TorchIcon}
					aria-pressed={torchOn}
					onclick={toggleTorch}>{i18n.t("common.camera.torch")}</Button
				>
			{/if}
			{#if snapshotButton}
				<Button variant="primary" icon={StartIcon} onclick={takeSnapshot}
					>{i18n.t("common.camera.snapshot")}</Button
				>
			{/if}
			{#if showDevices && devices.length > 1}
				<label class="label ml-auto flex items-center gap-2">
					<span class="sr-only label-text">{i18n.t("common.camera.device")}</span>
					<Select
						auto
						value={deviceId}
						onchange={(e) => switchDevice(e.currentTarget.value)}
					>
						{#each devices as d, i (d.deviceId)}
							<option value={d.deviceId}
								>{d.label || `${i18n.t("common.camera.device")} ${i + 1}`}</option
							>
						{/each}
					</Select>
				</label>
			{/if}
		{:else if !starting && !error}
			<Button variant="primary" icon={StartIcon} onclick={start}
				>{i18n.t("common.camera.start")}</Button
			>
		{/if}
	</Row>
</div>
