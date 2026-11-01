// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { isOnShelfLendable, LENDABLE_STATUSES, labelStatus } from "./copy-status.js";

describe("copy status", () => {
	it("lends available and damaged copies only", () => {
		expect([...LENDABLE_STATUSES].sort()).toEqual(["available", "damaged"]);
		const copy = { status: "available", notForLoan: false, loan: null };
		expect(isOnShelfLendable(copy)).toBe(true);
		expect(isOnShelfLendable({ ...copy, status: "damaged" })).toBe(true);
		expect(isOnShelfLendable({ ...copy, status: "lost" })).toBe(false);
		expect(isOnShelfLendable({ ...copy, notForLoan: true })).toBe(false);
		expect(isOnShelfLendable({ ...copy, loan: { id: 1 } })).toBe(false);
	});

	it("tells how far the labels are printed", () => {
		const at = "2026-01-01T00:00:00Z";
		expect(labelStatus({ barcodeLabelPrintedAt: at, spineLabelPrintedAt: at })).toBe("printed");
		expect(labelStatus({ barcodeLabelPrintedAt: at, spineLabelPrintedAt: null })).toBe(
			"partial",
		);
		expect(labelStatus({ barcodeLabelPrintedAt: null, spineLabelPrintedAt: at })).toBe(
			"partial",
		);
		expect(labelStatus({ barcodeLabelPrintedAt: null, spineLabelPrintedAt: null })).toBe(
			"pending",
		);
	});
});
