// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { blankToNull, escapeLike, normalizeSearchText } from "./text.js";

describe("normalizeSearchText", () => {
	it("strips diacritics, case and punctuation", () => {
		expect(normalizeSearchText("D'Angelo  Müller")).toBe("d angelo muller");
		expect(normalizeSearchText("  Città ")).toBe("citta");
	});
});

describe("escapeLike", () => {
	it("makes the wildcards and the escape character match themselves", () => {
		expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
		expect(escapeLike("2026-C0001")).toBe("2026-C0001");
	});
});

describe("blankToNull", () => {
	it("trims a field and stores nothing for a blank one", () => {
		expect(blankToNull("  Rossi ")).toBe("Rossi");
		expect(blankToNull("   ")).toBeNull();
		expect(blankToNull("")).toBeNull();
	});
});
