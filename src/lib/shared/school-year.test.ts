// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { schoolYearFor, schoolYearLabel, schoolYearStartDate } from "./school-year.js";

describe("school year label", () => {
	it("spans two calendar years starting on the configured day", () => {
		expect(schoolYearFor("2026-09-19")).toBe("2026/2027");
		expect(schoolYearFor("2027-06-10")).toBe("2026/2027");
		expect(schoolYearFor("2026-08-31")).toBe("2025/2026");
		expect(schoolYearFor("2026-09-01")).toBe("2026/2027");
		expect(schoolYearFor("2026-09-10", "09-15")).toBe("2025/2026");
		expect(schoolYearStartDate("2027-03-01")).toBe("2026-09-01");
	});
});

describe("school year name (9.41)", () => {
	it("names the year by its start where the country does", () => {
		expect(schoolYearLabel("2026/2027")).toBe("2026/2027");
		expect(schoolYearLabel("2026/2027", "span")).toBe("2026/2027");
		// Brazil: the school year starting in February 2027 is "2027"
		expect(schoolYearLabel(schoolYearFor("2027-03-10", "02-01"), "start")).toBe("2027");
		// a stored value of another shape is shown as it is
		expect(schoolYearLabel("2026", "start")).toBe("2026");
	});
});
