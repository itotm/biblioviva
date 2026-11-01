// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { expandGroupNames } from "./class-names.js";

describe("expandGroupNames", () => {
	it("splits on commas, semicolons and new lines; a name may contain spaces", () => {
		expect(expandGroupNames("A, B;C\nD")).toEqual(["A", "B", "C", "D"]);
		expect(expandGroupNames("Infanzia A,  Coccinelle   blu ")).toEqual([
			"Infanzia A",
			"Coccinelle blu",
		]);
	});

	it("expands letter and number ranges", () => {
		expect(expandGroupNames("a-c, F")).toEqual(["A", "B", "C", "F"]);
		expect(expandGroupNames("1-3")).toEqual(["1", "2", "3"]);
	});

	it("keeps names that are not ranges, and drops duplicates", () => {
		expect(expandGroupNames("Rossi, A-B, A")).toEqual(["Rossi", "A", "B"]);
		expect(expandGroupNames("C-A")).toBeNull();
		expect(expandGroupNames("A-3")).toEqual(["A-3"]);
	});

	it("refuses nothing and too many classes", () => {
		expect(expandGroupNames("  ")).toBeNull();
		expect(expandGroupNames("1-50")).toBeNull();
	});
});
