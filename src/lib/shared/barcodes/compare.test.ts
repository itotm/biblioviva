// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CHECK_ALGORITHMS } from "./check.js";
import { checkCodeTable, commonCode, shapeOf, visiblyDifferent } from "./compare.js";
import { compileFormat, type CompiledFormat } from "./pattern.js";
import { CODE_PRESETS, presetFormats } from "./presets.js";
import { buildCodeTable, type CodeFormats } from "./table.js";
import { FORMATS_2026 } from "../../../../tests/helpers/codes.js";

function table(item: string, card: string, extra: Partial<CodeFormats> = {}): CodeFormats {
	return {
		item: { current: { pattern: item, check: "luhn" }, retired: [], legacy: [] },
		card: { current: { pattern: card, check: "luhn" }, retired: [], legacy: [] },
		plainMaxLength: 0,
		libraryCode: "",
		layout: "it",
		...extra,
	};
}

function errors(formats: CodeFormats): string[] {
	return checkCodeTable(buildCodeTable(formats))
		.filter((i) => i.severity === "error")
		.map((i) => i.code);
}

describe("commonCode", () => {
	it("finds a code both shapes accept, or none", () => {
		const a = compileFormat({ pattern: "NNNNC", check: "luhn" });
		const b = compileFormat({ pattern: "'T'NNNC", check: "luhn" });
		const c = compileFormat({ pattern: "1NNNC", check: "luhn" });
		expect(commonCode(shapeOf(a), shapeOf(b))).toBeNull();
		expect(commonCode(shapeOf(a), shapeOf(c))).toBe("10000");
	});
});

describe("checkCodeTable", () => {
	it("accepts every preset with every check algorithm", () => {
		for (const preset of CODE_PRESETS) {
			for (const check of CHECK_ALGORITHMS) {
				const { item, card } = presetFormats(preset, check);
				const formats: CodeFormats = {
					item: { current: item, retired: [], legacy: [] },
					card: { current: card, retired: [], legacy: [] },
					plainMaxLength: 0,
					libraryCode: "",
					layout: "it",
				};
				expect(errors(formats), `${preset}/${check}`).toEqual([]);
			}
		}
	});

	it("accepts the formats of 2026 with their legacy shapes (an ISBN-10 shape is a warning)", () => {
		const issues = checkCodeTable(buildCodeTable(FORMATS_2026));
		expect(issues.filter((i) => i.severity === "error")).toEqual([]);
		expect(issues.map((i) => i.code)).toContain("overlapIsbn10");
	});

	it("accepts the new default next to this library's legacy codes", () => {
		const { item, card } = presetFormats("standard", "mod23");
		expect(
			errors({
				...FORMATS_2026,
				item: {
					current: item,
					retired: [FORMATS_2026.item.current],
					legacy: FORMATS_2026.item.legacy,
				},
				card: {
					current: card,
					retired: [FORMATS_2026.card.current],
					legacy: FORMATS_2026.card.legacy,
				},
			}),
		).toEqual([]);
	});

	it("refuses formats that share a code, with an example", () => {
		const issues = checkCodeTable(buildCodeTable(table("NNNNNC", "1NNNNC")));
		const overlap = issues.find((i) => i.code === "overlap");
		expect(overlap).toMatchObject({ kind: "item", otherKind: "card", severity: "error" });
		expect(overlap?.example).toMatch(/^1\d{5}$/);
	});

	it("refuses formats that meet once the dash is lost", () => {
		expect(errors(table("YYYY-NNNNC", "NNNNNNNNC"))).toEqual(["overlapWithoutDash"]);
	});

	it("refuses a generated format that matches the other kind's legacy shapes or the plain numbers", () => {
		expect(
			errors({
				...table("YYYY-NNNNC", "'T'NNNNNC"),
				card: {
					current: { pattern: "'T'NNNNNC", check: "luhn" },
					retired: [],
					legacy: [{ pattern: "NNNNNNNNNN", check: "none" }],
				},
				item: {
					current: { pattern: "NNNNNNNNNC", check: "luhn" },
					retired: [],
					legacy: [],
				},
			}),
		).toContain("overlap");
		expect(errors(table("YYYY-CNNNN", "NNNNNNC", { plainMaxLength: 9 }))).toEqual([
			"overlapPlain",
		]);
		// with a check letter the card is never a plain number
		expect(
			errors({
				...table("YYYY-CNNNN", "CNNNNNN", { plainMaxLength: 9 }),
				item: {
					current: { pattern: "YYYY-CNNNN", check: "mod23" },
					retired: [],
					legacy: [],
				},
				card: { current: { pattern: "CNNNNNN", check: "mod23" }, retired: [], legacy: [] },
			}),
		).toEqual([]);
	});

	it("refuses the shape of an ISBN-13", () => {
		expect(errors(table("978NNNNNNNNNC", "'T'NNNNNC"))).toContain("overlapIsbn");
	});

	it("refuses look-alike formats even when they never share a code", () => {
		// different first letter only: the rule wants a visible sign
		expect(errors(table("'L'NNNNNC", "'T'NNNNNC"))).toEqual(["lookAlike"]);
	});

	it("reports overlapping legacy shapes as a warning", () => {
		const issues = checkCodeTable(
			buildCodeTable({
				...table("YYYY-CNNNN", "'T'NNNNNC"),
				item: {
					current: { pattern: "YYYY-CNNNN", check: "mod23" },
					retired: [],
					legacy: [{ pattern: "NNNNNN", check: "none" }],
				},
				card: {
					current: { pattern: "'T'NNNNNC", check: "luhn" },
					retired: [],
					legacy: [{ pattern: "NNNNNN", check: "none" }],
				},
			}),
		);
		expect(issues.map((i) => [i.code, i.severity])).toEqual([["overlapLegacy", "warning"]]);
	});
});

describe("visiblyDifferent", () => {
	const f = (pattern: string, check: "luhn" | "mod23" = "luhn"): CompiledFormat =>
		compileFormat({ pattern, check });

	it("needs a length difference of two, a letter elsewhere or other dashes", () => {
		expect(visiblyDifferent(f("NNNNNNC"), f("NNNNNNNNC"))).toBe(true);
		expect(visiblyDifferent(f("NNNNNNC"), f("NNNNNNNC"))).toBe(false);
		expect(visiblyDifferent(f("CNNNNNN", "mod23"), f("NNNNNNC", "mod23"))).toBe(true);
		expect(visiblyDifferent(f("YYYY-NNC"), f("NNNNNNNC"))).toBe(true);
	});
});
