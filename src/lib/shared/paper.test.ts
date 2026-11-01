// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { pageSizeMm, PAPER_MM } from "./paper.js";

describe("paper sizes", () => {
	it("reads a CSS page size, turned for landscape, A4 by default", () => {
		expect(pageSizeMm("A4 portrait")).toEqual({ width: 210, height: 297 });
		expect(pageSizeMm("A5")).toEqual(PAPER_MM.A5);
		expect(pageSizeMm("A5 landscape")).toEqual({ width: 210, height: 148 });
		expect(pageSizeMm("B9")).toEqual(PAPER_MM.A4);
	});
});
