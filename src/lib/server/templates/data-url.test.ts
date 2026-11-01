// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dataUrl, fileDataUrl, imageMimeOf, mimeOf } from "./data-url.js";

describe("data URLs", () => {
	it("knows the types inlined and tells pictures apart", () => {
		expect(mimeOf("a.JPG")).toBe("image/jpeg");
		expect(mimeOf("font.woff2")).toBe("font/woff2");
		expect(mimeOf("x.exe")).toBeUndefined();
		expect(imageMimeOf("p.svg")).toBe("image/svg+xml");
		expect(imageMimeOf("font.ttf")).toBeUndefined();
	});

	it("encodes bytes, texts and files", () => {
		expect(dataUrl("<svg/>", "image/svg+xml")).toBe(
			`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
		);
		const bytes = new Uint8Array([0, 1, 2, 250, 251, 252]).subarray(1, 4);
		expect(dataUrl(bytes, "image/png")).toBe("data:image/png;base64,AQL6");
		const dir = mkdtempSync(join(tmpdir(), "bv-data-url-"));
		try {
			writeFileSync(join(dir, "a.png"), Buffer.from([1, 2, 250]));
			writeFileSync(join(dir, "b.bin"), "x");
			expect(fileDataUrl(join(dir, "a.png"))).toBe("data:image/png;base64,AQL6");
			expect(fileDataUrl(join(dir, "a.png"), "image/webp")).toMatch(/^data:image\/webp;/);
			expect(fileDataUrl(join(dir, "b.bin"))).toBe(
				"data:application/octet-stream;base64,eA==",
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
