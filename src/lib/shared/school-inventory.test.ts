// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	euroInput,
	formatEuro,
	inventorySeries,
	numericInventoryNumber,
	parseEuro,
	validInventoryNumber,
} from "./school-inventory.js";

describe("inventory numbers", () => {
	it("accepts letters, digits and a few separators", () => {
		for (const ok of ["1", "000123", "2026/15", "B-12", "A.7"]) {
			expect(validInventoryNumber(ok), ok).toBe(true);
		}
		for (const bad of ["", " 1", "-1", "12 3", "a".repeat(21), "1#"]) {
			expect(validInventoryNumber(bad), bad).toBe(false);
		}
		expect(numericInventoryNumber("0012")).toBe(true);
		expect(numericInventoryNumber("B-12")).toBe(false);
	});

	it("numbers the copies after the first one, keeping its width", () => {
		expect(inventorySeries("98", 3)).toEqual(["98", "99", "100"]);
		expect(inventorySeries("0098", 3)).toEqual(["0098", "0099", "0100"]);
		expect(inventorySeries("B-12", 1)).toEqual(["B-12"]);
		expect(inventorySeries("B-12", 2)).toBeNull();
	});
});

describe("values in euro", () => {
	it("reads the usual ways of writing an amount", () => {
		expect(parseEuro("")).toBeNull();
		expect(parseEuro("  ")).toBeNull();
		expect(parseEuro("12")).toBe(1200);
		expect(parseEuro("12,5")).toBe(1250);
		expect(parseEuro("12.50")).toBe(1250);
		expect(parseEuro("€ 12,50")).toBe(1250);
		expect(parseEuro("12,50 EUR")).toBe(1250);
		expect(parseEuro("1.200,00")).toBe(120000);
		expect(parseEuro("1,200.00")).toBe(120000);
		expect(parseEuro("1.200")).toBe(120000);
		expect(parseEuro("0,99")).toBe(99);
	});

	it("refuses what is not an amount", () => {
		for (const bad of ["-3", "abc", "12,5x", "1e3"]) {
			expect(parseEuro(bad), bad).toBeNaN();
		}
	});

	it("writes the cents back for a field and for a page", () => {
		expect(euroInput(1250, "it")).toBe("12,50");
		expect(euroInput(1250, "en")).toBe("12.50");
		expect(euroInput(null, "it")).toBe("");
		expect(formatEuro(1250, "it")).toMatch(/12,50\s*€/);
		expect(formatEuro(null, "it")).toBe("");
	});
});
