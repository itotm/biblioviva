// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	figureFrames,
	figurePictures,
	startWindow,
	webpSize,
	type FigurePicture,
} from "./site-figures.js";

/** The first bytes of a lossless WebP file of a given size (RIFF header, `VP8L`, signature, size). */
function losslessHeader(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(40);
	bytes.set([...new TextEncoder().encode("RIFF")], 0);
	bytes.set([...new TextEncoder().encode("WEBPVP8L")], 8);
	bytes[20] = 0x2f;
	const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
	bytes.set([bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255], 21);
	return bytes;
}

/** A folder laid out like `site/.shots/`, with the given pictures (language, name, window, size). */
function shotsFolder(files: [string, string, string, [number, number]][]): string {
	const dir = mkdtempSync(join(tmpdir(), "bv-figures-"));
	for (const [lang, name, window, [w, h]] of files) {
		const file = join(dir, lang, `${name}.${window}.webp`);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, losslessHeader(w, h));
	}
	return dir;
}

const texts = {
	group: "Schermo",
	windows: { computer: "Computer", tablet: "Tablet", phone: "Telefono" },
};

describe("webpSize", () => {
	it("reads the size of a lossless picture", () => {
		expect(webpSize(losslessHeader(1280, 800))).toEqual({ width: 1280, height: 800 });
		expect(webpSize(losslessHeader(1668, 2388))).toEqual({ width: 1668, height: 2388 });
	});

	it("reads the size of a real picture made by Bun", async () => {
		const png = await new Bun.Image(
			new Uint8Array(
				Buffer.from(
					"iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAEUlEQVR4nGP4z8DwH4YZkDkAm34L9XKwuTwAAAAASUVORK5CYII=",
					"base64",
				),
			),
		)
			.webp({ lossless: true })
			.bytes();
		expect(webpSize(png)).toEqual({ width: 3, height: 2 });
	});

	it("answers null for anything else", () => {
		expect(webpSize(new Uint8Array(40))).toBeNull();
		expect(webpSize(new TextEncoder().encode("not a picture"))).toBeNull();
	});
});

describe("figurePictures", () => {
	it("lists the windows in order, with the size of the window's pixels over its scale", () => {
		const dir = shotsFolder([
			["it", "desk/ok", "phone", [824, 1830]],
			["it", "desk/ok", "computer", [1280, 800]],
			["it", "desk/ok", "tablet", [1668, 2388]],
		]);
		expect(figurePictures(dir, "it", "desk/ok")).toEqual([
			{
				window: "computer",
				src: "/shots/it/desk/ok.computer.webp",
				width: 1280,
				height: 800,
			},
			{ window: "tablet", src: "/shots/it/desk/ok.tablet.webp", width: 834, height: 1194 },
			{ window: "phone", src: "/shots/it/desk/ok.phone.webp", width: 412, height: 915 },
		]);
	});

	it("falls back to the Italian pictures as a whole, never half and half", () => {
		const dir = shotsFolder([
			["it", "a", "computer", [100, 50]],
			["it", "a", "phone", [200, 100]],
			["en", "a", "computer", [100, 50]],
			["it", "b", "computer", [100, 50]],
		]);
		expect(figurePictures(dir, "en", "a").map((p) => p.src)).toEqual([
			"/shots/en/a.computer.webp",
		]);
		expect(figurePictures(dir, "en", "b").map((p) => p.src)).toEqual([
			"/shots/it/b.computer.webp",
		]);
		expect(figurePictures(dir, "en", "missing")).toEqual([]);
		expect(figurePictures(dir, "it", "missing")).toEqual([]);
	});
});

describe("startWindow", () => {
	it("starts on the window of the screen, else the nearest, the bigger one on a tie", () => {
		const all = ["computer", "tablet", "phone"] as const;
		expect(startWindow(all, "wide")).toBe("computer");
		expect(startWindow(all, "medium")).toBe("tablet");
		expect(startWindow(all, "narrow")).toBe("phone");
		expect(startWindow(["computer", "phone"], "medium")).toBe("computer");
		expect(startWindow(["computer", "tablet"], "narrow")).toBe("tablet");
		expect(startWindow(["phone"], "wide")).toBe("phone");
		expect(startWindow(["computer"], "narrow")).toBe("computer");
	});
});

describe("figureFrames", () => {
	const picture = (
		window: FigurePicture["window"],
		width: number,
		height: number,
	): FigurePicture => ({
		window,
		src: `/shots/it/x.${window}.webp`,
		width,
		height,
	});
	const three = [
		picture("computer", 1280, 800),
		picture("tablet", 834, 1194),
		picture("phone", 412, 915),
	];

	it("has a radio group with a label per window, none checked, and every picture sized", () => {
		const html = figureFrames("fw1", "Il banco", three, texts);
		expect(html).toContain('role="radiogroup" aria-label="Schermo"');
		expect(html.match(/<input type="radio"/g)).toHaveLength(3);
		expect(html).not.toContain("checked");
		for (const [window, label] of [
			["computer", "Computer"],
			["tablet", "Tablet"],
			["phone", "Telefono"],
		] as const) {
			expect(html).toContain(`id="fw1-${window}" value="${window}"`);
			expect(html).toContain(`<label for="fw1-${window}"`);
			expect(html).toContain(`] ${label}</label>`);
		}
		expect(html).toContain('width="834" height="1194" alt="Il banco" loading="lazy"');
		expect(html).toContain("[[icon:monitor]]");
		expect(html).toContain("[[icon:tablet]]");
		expect(html).toContain("[[icon:smartphone]]");
	});

	it("marks the window each screen starts on, on the picture and on its label", () => {
		const html = figureFrames("fw1", "x", three, texts);
		expect(html).toMatch(/fig-win-computer fig-on-wide fig-print"/);
		expect(html).toMatch(/fig-win-tablet fig-on-medium"/);
		expect(html).toMatch(/fig-win-phone fig-on-narrow"/);
		expect(html).toMatch(/<label for="fw1-phone" class="fig-on-narrow">/);
	});

	it("gives the screen without a window of its own the nearest one", () => {
		const html = figureFrames(
			"fw2",
			"x",
			[picture("computer", 1280, 800), picture("phone", 412, 915)],
			texts,
		);
		expect(html).toMatch(/fig-win-computer fig-on-wide fig-on-medium fig-print"/);
		expect(html).toMatch(/fig-win-phone fig-on-narrow"/);
	});

	it("shows a single window without a switch", () => {
		const html = figureFrames("fw3", "Una finestra", [picture("tablet", 834, 1194)], texts);
		expect(html).not.toContain("radio");
		expect(html).not.toContain("fig-switch");
		expect(html).toContain('class="fig-frames fig-single"');
		// and the print page takes it, there being no computer window
		expect(html).toContain("fig-print");
	});

	it("escapes the caption used as the alternative text", () => {
		const html = figureFrames("fw4", 'Il "banco" <1>', [picture("computer", 10, 10)], texts);
		expect(html).toContain('alt="Il &quot;banco&quot; &lt;1&gt;"');
	});
});
