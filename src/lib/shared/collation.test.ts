// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { collatorFor } from "./collation.js";

describe("collatorFor", () => {
	it("orders as the language does, numbers by value, case and accents aside", () => {
		expect(["Ödla", "Zebra"].sort(collatorFor("sv").compare)).toEqual(["Zebra", "Ödla"]);
		expect(["Zebra", "Ödla"].sort(collatorFor("it").compare)).toEqual(["Ödla", "Zebra"]);
		expect(["B 10", "B 9"].sort(collatorFor("it").compare)).toEqual(["B 9", "B 10"]);
		expect(collatorFor("it").compare("rossi", "Rossì")).toBe(0);
	});

	it("is Italian when no language is given, one collator per language", () => {
		expect(collatorFor()).toBe(collatorFor("it"));
	});
});
