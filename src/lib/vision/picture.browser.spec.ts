// SPDX-License-Identifier: GPL-3.0-or-later
// Runs in Chromium: a class picture is scaled to the configured longest side and sent as JPEG.
import { describe, expect, it, vi } from "vitest";
import cardsUrl from "../../../tests/fixtures/images/class-cards.jpg?url";
import { fitSize, imageDataOf, loadImage, uprightJpeg } from "./picture.js";

describe("class picture before upload", () => {
	it("fits the longest side and never enlarges", () => {
		expect(fitSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
		expect(fitSize(896, 1200, 4000)).toEqual({ width: 896, height: 1200 });
	});

	it("encodes the picture upright as a scaled JPEG", async () => {
		const file = await (await fetch(cardsUrl)).blob();
		const jpeg = await uprightJpeg(file, 600);
		expect(jpeg.type).toBe("image/jpeg");
		const bitmap = await createImageBitmap(jpeg);
		expect([bitmap.width, bitmap.height]).toEqual([448, 600]);
		const img = new Image();
		img.src = URL.createObjectURL(jpeg);
		await img.decode();
		expect(imageDataOf(img).width).toBe(448);
	});

	it("loads a picture and releases its object URL", async () => {
		const file = await (await fetch(cardsUrl)).blob();
		const revoke = vi.spyOn(URL, "revokeObjectURL");
		try {
			const img = await loadImage(file);
			expect(img.naturalWidth).toBeGreaterThan(0);
			expect(revoke).toHaveBeenCalledWith(img.src);
			// still drawable once its URL is gone
			expect(imageDataOf(img).width).toBe(img.naturalWidth);
		} finally {
			revoke.mockRestore();
		}
	});
});
