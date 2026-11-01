// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { normalizeDate } from "./dates.js";

describe("import dates", () => {
	it("normalises the date formats of spreadsheets and databases", () => {
		expect(normalizeDate("2024-03-15")).toBe("2024-03-15");
		expect(normalizeDate("2024-03-15 10:20:00")).toBe("2024-03-15");
		expect(normalizeDate("5/3/2024")).toBe("2024-03-05");
		expect(normalizeDate("15.03.2024")).toBe("2024-03-15");
		expect(normalizeDate("2024-02-30")).toBeNull();
		expect(normalizeDate("marzo")).toBeNull();
	});
});
