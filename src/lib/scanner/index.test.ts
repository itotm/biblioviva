// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { normaliseDetection, SCAN_FORMATS } from "./index.js";
import { buildCodeTable } from "#lib/shared/barcodes/table.js";
import { FORMATS_2026 } from "../../../tests/helpers/codes.js";
const CODES = buildCodeTable(FORMATS_2026);

describe("normaliseDetection", () => {
	it("maps detections to the §3.7 kinds", () => {
		expect(normaliseDetection({ rawValue: "9788804668237", format: "ean_13" }, CODES)).toEqual({
			kind: "isbn",
			value: "9788804668237",
		});
		// an EAN-13 that is not an ISBN: the caller decides (fast add takes it for a DVD)
		expect(normaliseDetection({ rawValue: "5901234123457", format: "ean_13" }, CODES)).toEqual({
			kind: "ambiguous",
			value: "5901234123457",
		});
		expect(
			normaliseDetection({ rawValue: "5901234123458", format: "ean_13" }, CODES).kind,
		).toBe("invalid");
		expect(normaliseDetection({ rawValue: "2026-0042", format: "code_39" }, CODES)).toEqual({
			kind: "legacy_item",
			value: "2026-0042",
		});
		expect(normaliseDetection({ rawValue: "0000001240", format: "code_39" }, CODES).kind).toBe(
			"card",
		);
	});

	it("enables both legacy and new symbologies", () => {
		expect(SCAN_FORMATS).toContain("code_39");
		expect(SCAN_FORMATS).toContain("code_128");
		expect(SCAN_FORMATS).toContain("ean_13");
	});
});
