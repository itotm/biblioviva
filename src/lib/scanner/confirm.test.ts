// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createReadConfirmer } from "./confirm.js";

describe("createReadConfirmer", () => {
	it("needs the same value in consecutive reads", () => {
		const c = createReadConfirmer(2, 800);
		expect(c.read("9788804490623", 0)).toBe(false);
		expect(c.read("9788804490623", 30)).toBe(true);
		expect(c.read("9788804490623", 60)).toBe(true);
	});

	it("starts over on a different value or after a pause", () => {
		const c = createReadConfirmer(2, 800);
		expect(c.read("9788804490623", 0)).toBe(false);
		expect(c.read("0101876694291", 30)).toBe(false);
		expect(c.read("9788804490623", 60)).toBe(false);
		expect(c.read("9788804490623", 1000)).toBe(false);
		expect(c.read("9788804490623", 1500)).toBe(true);
	});

	it("takes the first read when one is enough", () => {
		expect(createReadConfirmer(1).read("x", 0)).toBe(true);
	});
});
