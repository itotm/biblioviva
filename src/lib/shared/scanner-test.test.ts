// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { LAYOUT_REPAIRS } from "./barcodes/layouts.js";
import { generateCode } from "./barcodes/pattern.js";
import { buildCodeTable } from "./barcodes/table.js";
import { diagnoseScan } from "./scanner-test.js";
import { FORMATS_2026, itemCode, TEST_CODES } from "../../../tests/helpers/codes.js";

const COPY = itemCode(2026, 42); // 2026-C0042 style code of the test formats
const US = buildCodeTable({ ...FORMATS_2026, layout: "us" });
const FR = buildCodeTable({ ...FORMATS_2026, layout: "fr" });

describe("diagnoseScan", () => {
	it("takes a code as typed without a word about the layout", () => {
		const d = diagnoseScan(`${COPY}\n`, TEST_CODES);
		expect(d).toMatchObject({
			typed: COPY,
			code: COPY,
			kind: "item",
			layoutMishap: false,
			repairs: [],
			strange: [],
		});
	});

	it("names the apostrophe typed in place of the dash (Italian keyboard)", () => {
		const d = diagnoseScan(COPY.replace("-", "'"), TEST_CODES);
		expect(d.layoutMishap).toBe(true);
		expect(d.code).toBe(COPY);
		expect(d.kind).toBe("item");
		expect(d.repairs).toEqual([{ typed: "'", meant: "-" }]);
	});

	it("tells a lost dash apart: the layout is wrong but no character is replaced", () => {
		const d = diagnoseScan(COPY.replace("-", ""), TEST_CODES);
		expect(d.layoutMishap).toBe(true);
		expect(d.code).toBe(COPY);
		expect(d.repairs).toEqual([]);
	});

	it("is not a mishap when only the letter case changed", () => {
		const d = diagnoseScan(COPY.toLowerCase(), TEST_CODES);
		expect(d.layoutMishap).toBe(false);
		expect(d.kind).toBe("item");
	});

	it("repairs the AZERTY digit row and lists every character it changed", () => {
		// a scanner set to US typing on a French keyboard: the digits come out as their unshifted symbols
		const code = generateCode(FR.item.current, { year: 2026, counter: 42 });
		const symbols: Record<string, string> = {
			...Object.fromEntries(
				Object.entries(LAYOUT_REPAIRS.fr.digits ?? {}).map(([typed, meant]) => [
					meant,
					typed,
				]),
			),
			"-": ")",
		};
		const typed = Array.from(code, (c) => symbols[c] ?? c).join("");
		expect(typed).not.toBe(code);
		const d = diagnoseScan(typed, FR);
		expect(d.layoutMishap).toBe(true);
		expect(d.code).toBe(code);
		expect(d.kind).toBe("item");
		expect(d.repairs).toContainEqual({ typed: ")", meant: "-" });
		expect(d.repairs.length).toBeGreaterThan(2);
	});

	it("lists the characters a barcode never carries when the reading is not a code", () => {
		const d = diagnoseScan("ab§c", US);
		expect(d.kind).toBe("invalid");
		expect(d.layoutMishap).toBe(false);
		expect(d.strange).toEqual(["§"]);
	});

	it("reads an ISBN and an empty reading", () => {
		expect(diagnoseScan("9788804668794", TEST_CODES).kind).toBe("isbn");
		const empty = diagnoseScan("  \n", TEST_CODES);
		expect(empty).toMatchObject({ typed: "", kind: "invalid", layoutMishap: false });
	});
});
