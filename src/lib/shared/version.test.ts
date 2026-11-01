// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { BUILT_AT, demoVersion } from "./version.js";

describe("version", () => {
	it("shows the public demo's version as the time of its build, on the library's clock", () => {
		expect(demoVersion("2026-10-21T16:43:00.000Z", "Europe/Rome")).toBe("2026.10.21.1843");
		// past midnight in Rome, still the day before in UTC
		expect(demoVersion("2026-01-05T23:07:00.000Z", "Europe/Rome")).toBe("2026.01.06.0007");
		expect(demoVersion("2026-01-05T23:07:00.000Z", "UTC")).toBe("2026.01.05.2307");
		expect(Number.isNaN(Date.parse(BUILT_AT))).toBe(false);
	});
});
