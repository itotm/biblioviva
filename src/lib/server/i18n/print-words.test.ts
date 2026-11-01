// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ITALIAN_WORDS, printWords, WORD_FIELDS, WORD_KEYS } from "./print-words.js";

describe("print words (9.41)", () => {
	it("are the Italian dictionary's when none is handed in, the date filled in", () => {
		const words = printWords(undefined, "19/09/2026");
		expect(words.teacher).toBe("Docente");
		expect(words.loan_on).toBe("Prestito del 19/09/2026 a");
		expect(words.overdues_on).toBe("Solleciti biblioteca del 19/09/2026");
		expect(ITALIAN_WORDS("missing", {})).toBe("missing");
		expect(WORD_FIELDS).toEqual(WORD_KEYS.map((k) => `words.${k}`));
	});

	it("take every word from the source handed in", () => {
		const en = JSON.parse(readFileSync("src/lib/i18n/en/printing.json", "utf8")) as {
			words: Record<string, string>;
		};
		const words = printWords(
			(key, p) => (en.words[key] ?? "").replace("{{date}}", p.date ?? ""),
			"1/2",
		);
		expect(Object.values(words).every((w) => w !== "")).toBe(true);
		expect(words.due_by).toBe("Return by");
		expect(words.loan_on).toBe("Loan of 1/2 to");
	});
});
