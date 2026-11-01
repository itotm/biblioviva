// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CHECK_ALGORITHMS } from "./barcodes/check.js";
import { KEYBOARD_LAYOUTS, LAYOUT_REPAIRS, type KeyboardLayout } from "./barcodes/layouts.js";
import { generateCode } from "./barcodes/pattern.js";
import { CODE_PRESETS, presetFormats } from "./barcodes/presets.js";
import { buildCodeTable, type CodeFormats, type CodeTable } from "./barcodes/table.js";
import { FORMATS_2026 } from "../../../tests/helpers/codes.js";
import { normalizeScan, recognise, recogniseIsbn, recogniseScan } from "./scan.js";

/**
 * What a scanner set to a US layout would type on a computer with `layout` (the inverse of the
 * repair), to simulate the mishaps.
 */
function simulateMistyping(code: string, layout: KeyboardLayout): string {
	const repair = LAYOUT_REPAIRS[layout];
	const inverse: Record<string, string> = {};
	for (const [typed, meant] of Object.entries({ ...repair.digits, ...repair.letters })) {
		inverse[meant] = typed;
	}
	const dash = repair.dash[0] ?? "-";
	return Array.from(code, (c) => (c === "-" ? dash : (inverse[c] ?? c))).join("");
}

const CLASSIC = buildCodeTable(FORMATS_2026);
const item = generateCode(CLASSIC.item.current, { year: 2026, counter: 42 }); // 2026-0042C
const card = generateCode(CLASSIC.card.current, { counter: 1_000_000 });

describe("normalizeScan (formats of 2026)", () => {
	const digits = item.replace("-", "");

	it.each([
		[`${item}\n`, item],
		[`  ${item}\r\n`, item],
		[item.replace("-", "'"), item],
		[item.replace("-", "’"), item],
		[item.replace("-", " "), item],
		[digits, item],
		["2026 0042", "2026-0042"],
		["20260042", "2026-0042"],
		["0000001240", "0000001240"],
		["9788804668237", "9788804668237"],
		["12345678", "12345678"],
		["gatto", "gatto"],
	])("%s → %s", (raw, expected) => {
		expect(normalizeScan(raw, CLASSIC)).toBe(expected);
	});
});

describe("recognise (formats of 2026)", () => {
	it("follows the §3.7 table", () => {
		expect(recognise(item, CLASSIC)).toEqual({ kind: "item", value: item });
		expect(recognise("2026-0042", CLASSIC)).toEqual({
			kind: "legacy_item",
			value: "2026-0042",
		});
		expect(recognise("9788804668237", CLASSIC)).toEqual({
			kind: "isbn",
			value: "9788804668237",
		});
		expect(recognise("080442957X", CLASSIC)).toEqual({ kind: "isbn", value: "9780804429573" });
		expect(recognise(card, CLASSIC)).toEqual({ kind: "card", value: card });
		expect(recognise("0000001240", CLASSIC)).toEqual({ kind: "card", value: "0000001240" });
		expect(recognise("0000123", CLASSIC)).toEqual({ kind: "ambiguous", value: "0000123" });
		expect(recognise("1234567897", CLASSIC)).toEqual({ kind: "card", value: "1234567897" });
	});

	it("rejects wrong check digits with a reason", () => {
		const wrong = `${item.slice(0, -1)}${(Number(item.at(-1)) + 1) % 10}`;
		expect(recognise(wrong, CLASSIC)).toEqual({
			kind: "invalid",
			value: wrong,
			reason: "item_check_digit",
		});
		expect(recognise("9788804668238", CLASSIC).reason).toBe("isbn_check_digit");
		expect(recognise("080442957A", CLASSIC).reason).toBe("unrecognised");
		expect(recognise("123456788X", CLASSIC).reason).toBe("isbn_check_digit");
		expect(recognise("   ", CLASSIC).reason).toBe("empty");
		expect(recognise("ABC", CLASSIC).reason).toBe("unrecognised");
	});

	it("verifies the card check digit only from the configured counter start", () => {
		const at = (start: number): CodeTable =>
			buildCodeTable({ ...FORMATS_2026, cardCounterStart: start });
		const legacy = "0000001240"; // below the counter start: a plain counter
		expect(recognise(legacy, at(1000))).toEqual({ kind: "card", value: legacy });
		expect(recognise(card, at(1_000_000))).toEqual({ kind: "card", value: card });
		const wrong = `${card.slice(0, -1)}${(Number(card.at(-1)) + 1) % 10}`;
		expect(recognise(wrong, at(1_000_000))).toEqual({ kind: "ambiguous", value: wrong });
		// an ISBN-10 typed by hand in the new range
		expect(recognise("0306406152", at(1))).toEqual({ kind: "isbn", value: "9780306406157" });
	});
});

describe("recogniseScan", () => {
	it("repairs the scanner's mishaps first, then classifies the repaired text", () => {
		expect(recogniseScan(`${item.replace("-", "'")}\r\n`, CLASSIC)).toEqual({
			code: item,
			result: { kind: "item", value: item },
		});
		expect(recogniseScan("20260042", CLASSIC)).toEqual({
			code: "2026-0042",
			result: { kind: "legacy_item", value: "2026-0042" },
		});
		expect(recogniseScan(" gatto ", CLASSIC)).toEqual({
			code: "gatto",
			result: { kind: "invalid", value: "gatto", reason: "unrecognised" },
		});
	});
});

describe("recognise (new formats next to the legacy codes)", () => {
	const { item: newItem, card: newCard } = presetFormats("standard", "mod23");
	const table = buildCodeTable({
		...FORMATS_2026,
		item: { ...FORMATS_2026.item, current: newItem, retired: [FORMATS_2026.item.current] },
		card: { ...FORMATS_2026.card, current: newCard, retired: [FORMATS_2026.card.current] },
	});

	it("tells new, retired and legacy codes apart", () => {
		const copy = generateCode(table.item.current, { year: 2026, counter: 267 });
		const member = generateCode(table.card.current, { counter: 12345 });
		expect(copy).toBe("2026-E0267");
		expect(recognise(copy, table)).toEqual({ kind: "item", value: copy });
		expect(recognise(member, table)).toEqual({ kind: "card", value: member });
		expect(recognise(item, table)).toEqual({ kind: "item", value: item });
		expect(recognise("2026-0042", table).kind).toBe("legacy_item");
		expect(recognise("0000001240", table).kind).toBe("card");
		expect(recognise("2026-A0267", table)).toMatchObject({ reason: "item_check_digit" });
		const wrongCard = `${member.startsWith("A") ? "B" : "A"}${member.slice(1)}`;
		expect(recognise(wrongCard, table)).toMatchObject({ reason: "card_check_digit" });
	});

	it("repairs lower case and a lost dash", () => {
		expect(normalizeScan("2026-e0267", table)).toBe("2026-E0267");
		expect(normalizeScan("2026E0267", table)).toBe("2026-E0267");
		expect(normalizeScan("2026'e0267", table)).toBe("2026-E0267");
	});
});

describe("recogniseIsbn", () => {
	it("reads ISBN-13 and ISBN-10 with hyphens or spaces", () => {
		expect(recogniseIsbn("978-88-04-66823-7")).toBe("9788804668237");
		expect(recogniseIsbn("0-306-40615-2")).toBe("9780306406157");
		expect(recogniseIsbn("080442957X")).toBe("9780804429573");
		expect(recogniseIsbn("9788804668238")).toBeNull();
		expect(recogniseIsbn("1984")).toBeNull();
	});
});

/** Deterministic pseudo-random integers. */
function* numbers(seed: number): Generator<number> {
	let x = seed;
	for (;;) {
		x = (x * 1103515245 + 12345) % 2147483648;
		yield x;
	}
}

describe("every preset, every check, every keyboard", () => {
	const COUNT = 10_000;
	const MISHAPS = 500;

	for (const preset of CODE_PRESETS) {
		for (const check of CHECK_ALGORITHMS) {
			it(`${preset}/${check}: each code is recognised as its own kind only`, () => {
				const { item: i, card: c } = presetFormats(preset, check);
				const formats: CodeFormats = {
					item: { current: i, retired: [], legacy: [] },
					card: { current: c, retired: [], legacy: [] },
					plainMaxLength: 0,
					libraryCode: "",
					layout: "it",
				};
				const random = numbers(preset.length * 31 + check.length);
				const codes: { kind: "item" | "card"; code: string }[] = [];
				const base = buildCodeTable(formats);
				for (let k = 0; k < COUNT; k++) {
					const year = 2000 + (random.next().value % 40);
					codes.push({
						kind: "item",
						code: generateCode(base.item.current, {
							year,
							counter: random.next().value % 10_000,
						}),
					});
					codes.push({
						kind: "card",
						code: generateCode(base.card.current, {
							counter: random.next().value % 1_000_000,
						}),
					});
				}
				for (const { kind, code } of codes) {
					expect(recognise(code, base).kind, code).toBe(kind);
				}
				for (const layout of KEYBOARD_LAYOUTS) {
					const table = buildCodeTable({ ...formats, layout });
					for (const { kind, code } of codes.slice(0, MISHAPS)) {
						for (const typed of [
							simulateMistyping(code, layout),
							code.replaceAll("-", ""),
							code.toLowerCase(),
						]) {
							const normal = normalizeScan(typed, table);
							expect(normal, `${layout}: ${typed}`).toBe(code);
							expect(recognise(normal, table).kind).toBe(kind);
						}
					}
				}
			});
		}
	}
});
