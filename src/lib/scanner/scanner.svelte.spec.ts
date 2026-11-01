// SPDX-License-Identifier: GPL-3.0-or-later
// Decodes the SVGs rendered by the server (tests/fixtures/barcodes, written by barcodes.test.ts
// and, for the label of the pair template, by labels.test.ts)
// with the same detector the camera scanner uses, WASM served from our origin (no CDN).
import { describe, expect, it } from "vitest";
import card from "../../../tests/fixtures/barcodes/card-code128.svg?raw";
import item from "../../../tests/fixtures/barcodes/item-code39.svg?raw";
import label from "../../../tests/fixtures/barcodes/label-code128.svg?raw";
import isbn from "../../../tests/fixtures/barcodes/isbn-ean13.svg?raw";
import { createDetector, normaliseDetection } from "./index.js";
import { buildCodeTable } from "#lib/shared/barcodes/table.js";
import { FORMATS_2026 } from "../../../tests/helpers/codes.js";
const CODES = buildCodeTable(FORMATS_2026);

async function rasterise(svg: string): Promise<ImageBitmap> {
	const blob = new Blob([svg], { type: "image/svg+xml" });
	const url = URL.createObjectURL(blob);
	try {
		const img = new Image();
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error("svg did not load"));
			img.src = url;
		});
		const canvas = document.createElement("canvas");
		canvas.width = img.width * 2;
		canvas.height = img.height * 2;
		const ctx = canvas.getContext("2d")!;
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		return await createImageBitmap(canvas);
	} finally {
		URL.revokeObjectURL(url);
	}
}

describe("rendered barcodes scan back", () => {
	it("Code 128 card, Code 39 legacy item and EAN-13 ISBN are recognised", async () => {
		const detector = await createDetector();
		const cases = [
			{ svg: card, format: "code_128", kind: "card", value: "0001000018" },
			{ svg: item, format: "code_39", kind: "legacy_item", value: "2026-0042" },
			{ svg: isbn, format: "ean_13", kind: "isbn", value: "9788804668237" },
			// the barcode label of pair-default: Code 128, new item format with the Luhn digit
			{ svg: label, format: "code_128", kind: "item", value: "2026-02678" },
		] as const;
		for (const c of cases) {
			const found = await detector.detect(await rasterise(c.svg));
			expect(found.length, `${c.kind} not detected`).toBeGreaterThan(0);
			expect(found[0]!.format).toBe(c.format);
			expect(normaliseDetection(found[0]!, CODES)).toEqual({ kind: c.kind, value: c.value });
		}
	}, 30_000);
});
