// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import {
	calendarRules,
	currentSchoolYearStart,
	libraryToday,
	libraryYear,
	schoolYearMonths,
} from "./calendar.js";

const config = parseConfig(exampleRaw()).config;

describe("library calendar from the configuration", () => {
	it("reads the rules and today in the library's time zone", () => {
		expect(calendarRules(config).weeklyClosedDays).toEqual([0, 6]);
		// 23:30 UTC on 30 September is already 1 October in Rome
		expect(libraryToday(config, new Date("2026-09-30T23:30:00Z"))).toBe("2026-10-01");
		expect(currentSchoolYearStart(config, new Date("2026-08-31T10:00:00Z"))).toBe(2025);
		expect(currentSchoolYearStart(config, new Date("2026-09-01T10:00:00Z"))).toBe(2026);
	});

	it("takes the year of new codes on the library's clock, the New Year included", () => {
		// 23:30 UTC on 31 December is already 1 January in Rome
		const newYear = new Date("2026-12-31T23:30:00Z");
		expect(config.library.timezone).toBe("Europe/Rome");
		expect(libraryYear(config, newYear)).toBe(2027);
		const inUtc = { ...config, library: { ...config.library, timezone: "UTC" } };
		expect(libraryYear(inUtc, newYear)).toBe(2026);
		expect(libraryYear(config, new Date("2026-06-15T10:00:00Z"))).toBe(2026);
	});

	it("lays out the twelve months of a school year with the closures", () => {
		const months = schoolYearMonths(config, 2026);
		expect(months.map((m) => m.month)).toEqual([
			"2026-09",
			"2026-10",
			"2026-11",
			"2026-12",
			"2027-01",
			"2027-02",
			"2027-03",
			"2027-04",
			"2027-05",
			"2027-06",
			"2027-07",
			"2027-08",
		]);
		const september = months[0]!;
		expect(september.days).toHaveLength(30);
		// 1 September 2026 is a Tuesday
		expect(september.days[0]).toMatchObject({
			date: "2026-09-01",
			isoWeekday: 2,
			closed: null,
		});
		expect(september.days[5]).toMatchObject({
			date: "2026-09-06",
			isoWeekday: 7,
			closed: { kind: "weekly" },
		});
		expect(september.openDays).toBe(22);
		const november = months[2]!;
		expect(november.days[1]?.closed).toEqual({ kind: "holiday" });
		// 1 November 2026 is a Sunday: the holiday is named rather than the weekly closure
		expect(november.days[0]?.closed).toEqual({ kind: "national", name: "allSaints" });
		const december = months[3]!;
		expect(december.days[24]?.closed).toEqual({ kind: "range", reason: "Vacanze di Natale" });
		expect(months[11]!.openDays).toBe(0);
	});
});
