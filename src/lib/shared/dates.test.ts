// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	dayRangeToUtc,
	fileStamp,
	formatDate,
	formatDateTime,
	formatDay,
	isoDateIn,
	todayIn,
	zonedParts,
} from "./dates.js";

describe("dates", () => {
	it("converts local days to UTC ranges in the library zone", () => {
		// Rome is UTC+2 in September
		expect(dayRangeToUtc("2026-09-19", "2026-09-19", "Europe/Rome")).toEqual({
			fromIso: "2026-09-18T22:00:00.000Z",
			toIso: "2026-09-19T21:59:59.999Z",
		});
		expect(dayRangeToUtc(undefined, undefined, "Europe/Rome")).toEqual({});
	});

	it("formats and extracts dates in the zone", () => {
		expect(isoDateIn(new Date("2026-09-19T23:30:00Z"), "Europe/Rome")).toBe("2026-09-20");
		expect(formatDateTime("2026-09-19T08:05:00Z", "it", "Europe/Rome")).toMatch(
			/19\/09\/26,? 10:05/,
		);
	});

	it("takes today in the library's time zone", () => {
		const late = new Date("2026-03-15T23:30:00Z");
		expect(todayIn("Europe/Rome", late)).toBe("2026-03-16");
		expect(todayIn("UTC", late)).toBe("2026-03-15");
	});

	it("formats an instant on the library's day, not the host's", () => {
		// 23:30 UTC is already the next day in Rome
		expect(formatDate("2026-09-19T23:30:00Z", "it", "Europe/Rome")).toBe("20/09/26");
		expect(formatDate("2026-09-19T23:30:00Z", "it", "America/New_York")).toBe("19/09/26");
		expect(formatDate("2026-09-19T23:30:00Z", "en-GB", "Europe/Rome", "medium")).toBe(
			"20 Sept 2026",
		);
	});

	it("formats a calendar day as itself in every zone", () => {
		expect(formatDay("2026-09-20", "it")).toBe("20/09/26");
		expect(formatDay("2026-09-20", "en-GB", "medium")).toBe("20 Sept 2026");
		expect(formatDay("2026-09-20", "it", { weekday: "long" })).toBe("domenica");
	});

	it("reads the clock of the zone, zero-padded", () => {
		expect(zonedParts(new Date("2026-03-04T05:06:07Z"), "UTC")).toEqual({
			year: "2026",
			month: "03",
			day: "04",
			hour: "05",
			minute: "06",
			second: "07",
		});
		// 23:30 UTC on 31 December is already 00:30 on 1 January in Rome
		const newYear = new Date("2026-12-31T23:30:00Z");
		expect(zonedParts(newYear, "Europe/Rome")).toEqual({
			year: "2027",
			month: "01",
			day: "01",
			hour: "00",
			minute: "30",
			second: "00",
		});
		expect(zonedParts(newYear, "UTC")).toMatchObject({ year: "2026", month: "12", day: "31" });
		// and still 31 December west of Greenwich
		expect(zonedParts(new Date("2027-01-01T03:00:00Z"), "America/New_York")).toMatchObject({
			year: "2026",
			day: "31",
			hour: "22",
		});
	});

	it("stamps file names with the minute in the library zone", () => {
		expect(fileStamp(new Date("2026-12-31T23:05:00Z"), "Europe/Rome")).toBe("20270101-0005");
		expect(fileStamp(new Date("2026-03-04T05:06:00Z"), "UTC")).toBe("20260304-0506");
	});
});
