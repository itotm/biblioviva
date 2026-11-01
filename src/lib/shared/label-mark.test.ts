// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { canMarkPrinted } from "./label-mark.js";

describe("canMarkPrinted", () => {
	it("allows marking the copies chosen by id or by record", () => {
		expect(canMarkPrinted({ ids: [1], biblioIds: [], pendingIds: [] })).toBe(true);
		expect(canMarkPrinted({ ids: [], biblioIds: [4], pendingIds: [] })).toBe(true);
		expect(canMarkPrinted({ ids: [], biblioIds: [], pendingIds: [] })).toBe(false);
	});

	it("allows marking the pending labels once their copies are known (9.42)", () => {
		expect(canMarkPrinted({ pending: true, ids: [], biblioIds: [], pendingIds: [] })).toBe(
			false,
		);
		expect(canMarkPrinted({ pending: true, ids: [], biblioIds: [], pendingIds: [7, 8] })).toBe(
			true,
		);
	});

	it("leaves a print list to its own action", () => {
		expect(canMarkPrinted({ listId: 3, ids: [1], biblioIds: [], pendingIds: [] })).toBe(false);
	});
});
