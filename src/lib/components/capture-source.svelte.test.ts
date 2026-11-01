// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import { CaptureSource, canvasFile } from "./capture-source.svelte.js";

async function pngFile(): Promise<File> {
	const canvas = document.createElement("canvas");
	canvas.width = 4;
	canvas.height = 3;
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
	return new File([blob ?? new Blob()], "shot.png", { type: "image/png" });
}

const picked = (file: File): Event => {
	const input = document.createElement("input");
	input.type = "file";
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input.files = transfer.files;
	return { currentTarget: input } as unknown as Event;
};

describe("CaptureSource", () => {
	it("starts on the camera or the buttons, and comes back there on reset", () => {
		const options = { tag: "t", onload: vi.fn(), onundecodable: vi.fn() };
		const idle = new CaptureSource<"crop">({ ...options, autostart: () => false });
		expect(idle.mode).toBe("idle");
		idle.openCamera();
		expect(idle.mode).toBe("camera");
		const camera = new CaptureSource<"crop">({ ...options, autostart: () => true });
		camera.mode = "crop";
		camera.reset();
		expect(camera.mode).toBe("camera");
		expect(camera.source).toBeNull();
	});

	it("decodes a picked file and hands it over; a broken one goes to the server as it is", async () => {
		const onload = vi.fn();
		const onundecodable = vi.fn();
		const capture = new CaptureSource<"crop">({
			tag: "t",
			autostart: () => false,
			onload,
			onundecodable,
		});
		await capture.onFile(picked(await pngFile()));
		expect(onload).toHaveBeenCalledOnce();
		expect(capture.source?.naturalWidth).toBe(4);
		const broken = new File(["not a picture"], "x.jpg", { type: "image/jpeg" });
		await capture.onFile(picked(broken));
		expect(onundecodable).toHaveBeenCalledWith(broken);
	});

	it("takes a shot from the camera", async () => {
		const onload = vi.fn();
		const capture = new CaptureSource<"crop">({
			tag: "t",
			autostart: () => true,
			onload,
			onundecodable: vi.fn(),
		});
		const shot = await pngFile();
		capture.camera = { snapshot: () => Promise.resolve(shot) };
		await capture.snapshot();
		expect(onload).toHaveBeenCalledOnce();
	});

	it("encodes a canvas as a WebP file", async () => {
		const canvas = document.createElement("canvas");
		canvas.width = 2;
		canvas.height = 2;
		const file = await canvasFile(canvas, "cover.webp");
		expect(file?.name).toBe("cover.webp");
		expect(file?.type).toBe("image/webp");
	});
});
