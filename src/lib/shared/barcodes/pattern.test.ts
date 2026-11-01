// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	capacity,
	checkValid,
	compileFormat,
	counterOf,
	CounterOverflowError,
	generateCode,
	isValidCode,
	letterPositions,
	matchesShape,
	PatternError,
	separatorPositions,
	withoutSeparators,
	yearOf,
	type PatternErrorCode,
} from "./pattern.js";

describe("compileFormat", () => {
	it("reads every token", () => {
		const f = compileFormat({ pattern: "YYYY-CNNNN", check: "mod23" });
		expect(f.length).toBe(10);
		expect(f.year).toEqual({ start: 0, length: 4 });
		expect(f.check).toBe(5);
		expect(f.counter).toEqual({ start: 6, length: 4 });
		const lib = compileFormat(
			{ pattern: "'B'{lib}YYNNNC", check: "damm" },
			{ libraryCode: "07" },
		);
		expect(lib.length).toBe(9);
		expect(lib.year).toEqual({ start: 3, length: 2 });
		expect(compileFormat({ pattern: "YYYY-NNNN", check: "none" }).check).toBeNull();
		expect(
			compileFormat({ pattern: "0000", check: "none" }, { counterOptional: true }).counter,
		).toBeNull();
	});

	it.each<[string, string, PatternErrorCode]>([
		["", "luhn", "empty"],
		["YYY-NNNNC", "luhn", "year"],
		["YYYY-YY-NNC", "luhn", "twoYears"],
		["NN-NNC", "luhn", "twoCounters"],
		["YYYY-C", "luhn", "noCounter"],
		["CNNNC", "luhn", "twoChecks"],
		["NNNNC", "none", "checkWithoutAlgorithm"],
		["NNNN", "luhn", "algorithmWithoutCheck"],
		["'I'NNNNC", "luhn", "badLetter"],
		["'A", "luhn", "unclosedQuote"],
		["A-NNNNC", "luhn", "badToken"],
		["{lib}NNNNC", "luhn", "noLibraryCode"],
		["NNNNNNNNNNNNNNNNNNNNNNNNC", "luhn", "tooLong"],
	])("refuses %s (%s): %s", (pattern, check, code) => {
		let thrown: unknown = null;
		try {
			compileFormat({ pattern, check: check as "luhn" | "none" });
		} catch (e) {
			thrown = e;
		}
		expect(thrown).toBeInstanceOf(PatternError);
		expect((thrown as PatternError).code).toBe(code);
	});

	it("refuses a library code with forbidden characters", () => {
		expect(() =>
			compileFormat({ pattern: "{lib}NNNC", check: "luhn" }, { libraryCode: "a1" }),
		).toThrow(PatternError);
	});
});

describe("codes", () => {
	const standard = compileFormat({ pattern: "YYYY-CNNNN", check: "mod23" });
	const classic = compileFormat({ pattern: "YYYY-NNNNC", check: "luhn" });
	const card = compileFormat({ pattern: "CNNNNNN", check: "mod23" });

	it("generates codes with their check character", () => {
		// 20260267 mod 23 = 4 → E
		expect(generateCode(standard, { year: 2026, counter: 267 })).toBe("2026-E0267");
		expect(generateCode(classic, { year: 2026, counter: 267 })).toMatch(/^2026-0267\d$/);
		expect(generateCode(card, { counter: 12345 })).toMatch(/^[A-Z]012345$/);
		const yy = compileFormat({ pattern: "'L'-YYNNNNC", check: "luhn" });
		expect(generateCode(yy, { year: 2026, counter: 7 })).toMatch(/^L-260007\d$/);
	});

	it("validates shape and check", () => {
		const code = generateCode(standard, { year: 2026, counter: 267 });
		expect(isValidCode(standard, code)).toBe(true);
		expect(matchesShape(standard, "2026-A0267")).toBe(true);
		expect(checkValid(standard, "2026-A0267")).toBe(false);
		expect(matchesShape(standard, "2026-I0267")).toBe(false);
		expect(matchesShape(standard, "2026-E026")).toBe(false);
		expect(counterOf(standard, code)).toBe(267);
		expect(yearOf(standard, code)).toBe(2026);
		expect(yearOf(compileFormat({ pattern: "YYNNC", check: "luhn" }), "26011")).toBe(2026);
		expect(
			counterOf(
				compileFormat({ pattern: "0000", check: "none" }, { counterOptional: true }),
				"0000",
			),
		).toBeNull();
	});

	it("refuses counters that do not fit and missing years", () => {
		expect(capacity(card)).toBe(999_999);
		expect(() => generateCode(card, { counter: 1_000_000 })).toThrow(CounterOverflowError);
		expect(() => generateCode(card, { counter: -1 })).toThrow(CounterOverflowError);
		expect(() => generateCode(standard, { counter: 1 })).toThrow();
	});

	it("describes the separators and the letters", () => {
		expect(separatorPositions(standard)).toEqual([4]);
		expect(letterPositions(standard)).toEqual([5]);
		expect(letterPositions(classic)).toEqual([]);
		const bare = withoutSeparators(standard);
		expect(bare.length).toBe(9);
		expect(bare.check).toBe(4);
		expect(bare.counter).toEqual({ start: 5, length: 4 });
		expect(isValidCode(bare, "2026E0267")).toBe(true);
	});
});
