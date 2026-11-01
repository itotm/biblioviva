// SPDX-License-Identifier: GPL-3.0-or-later
// The source of a picture taken for a cover or a patron photo (steps 2.3, 3.7): the camera or a
// file, decoded into an image element, with the idle / camera states every capture starts from.
// The component adds its own states (crop, straighten) after the picture is loaded and turns its
// result into a file with `canvasFile`.
import { debugReport } from "#lib/debug.js";
import { loadImage } from "#lib/vision/picture.js";

interface Camera {
	snapshot(): Promise<Blob | null>;
}

interface Options {
	/** The tag of the debug reports (`cover`, `photo`). */
	tag: string;
	/** Start with the camera open, and come back to it after a reset. */
	autostart: () => boolean;
	/** The picture is decoded: the component takes it from here. */
	onload: (img: HTMLImageElement) => void | Promise<void>;
	/** A file the browser cannot decode goes to the server as it is, which explains the problem. */
	onundecodable: (file: File) => void | Promise<void>;
}

export class CaptureSource<Extra extends string> {
	mode = $state<"idle" | "camera" | Extra>("idle");
	camera = $state<Camera>();
	cameraReady = $state(false);
	source = $state<HTMLImageElement | null>(null);
	readonly #options: Options;

	constructor(options: Options) {
		this.#options = options;
		this.mode = options.autostart() ? "camera" : "idle";
	}

	async load(blob: Blob): Promise<void> {
		const img = await loadImage(blob);
		this.source = img;
		await this.#options.onload(img);
	}

	/** A shot from the camera. */
	snapshot = async (): Promise<void> => {
		const blob = await this.camera?.snapshot();
		debugReport(this.#options.tag, "snapshot", { bytes: blob?.size ?? 0 });
		if (blob) {
			await this.load(blob);
		}
	};

	/** The file picked by the upload button. */
	onFile = async (e: Event): Promise<void> => {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) {
			return;
		}
		debugReport(this.#options.tag, "file", { type: file.type, bytes: file.size });
		try {
			await this.load(file);
		} catch {
			await this.#options.onundecodable(file);
		}
	};

	openCamera = (): void => {
		this.mode = "camera";
	};

	/** Back to the camera (or the idle buttons) for the next shot. */
	reset(): void {
		this.source = null;
		this.mode = this.#options.autostart() ? "camera" : "idle";
	}
}

/** A canvas encoded as WebP (quality 0.85) in a file named `name`; null when it cannot be encoded. */
export async function canvasFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/webp", 0.85),
	);
	return blob ? new File([blob], name, { type: "image/webp" }) : null;
}
