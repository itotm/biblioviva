// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { contrastRatio, oklchToRgb, parseCssColor, toHex } from "./color.js";

describe("colour maths", () => {
	it("parses hex, rgb and oklch", () => {
		expect(parseCssColor("#fff")).toEqual({ r: 1, g: 1, b: 1 });
		expect(toHex(parseCssColor("#0770ef")!)).toBe("#0770ef");
		expect(toHex(parseCssColor("rgb(7, 112, 239)")!)).toBe("#0770ef");
		expect(toHex(parseCssColor("oklch(1 0 0)")!)).toBe("#ffffff");
		expect(parseCssColor("not a colour")).toBeNull();
	});

	it("converts oklch to sRGB within tolerance", () => {
		// oklch(0.57 0.21 258.29) is the cerberus primary, rendered by Chromium as #0770ef.
		const rgb = oklchToRgb(0.57, 0.21, 258.29);
		expect(Math.abs(rgb.r * 255 - 7)).toBeLessThan(6);
		expect(Math.abs(rgb.g * 255 - 112)).toBeLessThan(6);
		expect(Math.abs(rgb.b * 255 - 239)).toBeLessThan(6);
	});

	it("computes WCAG contrast ratios", () => {
		const black = parseCssColor("#000")!;
		const white = parseCssColor("#fff")!;
		expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
		expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
		expect(contrastRatio(parseCssColor("#0770ef")!, white)).toBeGreaterThan(4.5);
	});
});
