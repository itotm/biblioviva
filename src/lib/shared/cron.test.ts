// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { nextCronRuns, parseCron, previousCronRun } from "./cron.js";

const TZ = "Europe/Rome";
const iso = (d: Date[] | null): string[] => (d ?? []).map((x) => x.toISOString());

describe("cron", () => {
	it("parses five fields and refuses the rest", () => {
		expect(parseCron("0 3 * * *")).not.toBeNull();
		expect(parseCron("*/15 8-18 * * 1-5")?.minutes.size).toBe(4);
		expect(parseCron("0 3 * *")).toBeNull();
		expect(parseCron("60 3 * * *")).toBeNull();
		expect(parseCron("0 3 * * MON")).toBeNull();
		expect(parseCron("0 3 5-1 * *")).toBeNull();
		expect(parseCron("0 3 * * 7")?.weekdays.has(0)).toBe(true);
	});

	it("gives the next runs in the library's time zone", () => {
		const from = new Date("2026-09-26T10:00:00Z"); // 12:00 in Rome
		expect(iso(nextCronRuns("0 3 * * *", from, TZ))).toEqual([
			"2026-09-27T01:00:00.000Z",
			"2026-09-28T01:00:00.000Z",
			"2026-09-29T01:00:00.000Z",
		]);
		// weekdays only, twice an hour
		expect(iso(nextCronRuns("0,30 13 * * 1-5", from, TZ, 2))).toEqual([
			"2026-09-28T11:00:00.000Z",
			"2026-09-28T11:30:00.000Z",
		]);
		// the day of the month or the day of the week
		expect(iso(nextCronRuns("0 0 1 * 0", from, TZ, 2))).toEqual([
			"2026-09-26T22:00:00.000Z",
			"2026-09-30T22:00:00.000Z",
		]);
		// winter time from 25 October
		expect(iso(nextCronRuns("0 3 25 10 *", from, TZ, 1))).toEqual(["2026-10-25T02:00:00.000Z"]);
		expect(nextCronRuns("nope", from, TZ)).toBeNull();
	});

	it("gives the last run before an instant (daily and weekly)", () => {
		const at = (expr: string, before: string): string | undefined =>
			previousCronRun(expr, new Date(before), TZ)?.toISOString();
		// daily at 3: before 3 in Rome it is yesterday's, after it today's
		expect(at("0 3 * * *", "2026-09-26T00:30:00Z")).toBe("2026-09-25T01:00:00.000Z");
		expect(at("0 3 * * *", "2026-09-26T07:00:00Z")).toBe("2026-09-26T01:00:00.000Z");
		// exactly at the run: that run
		expect(at("0 3 * * *", "2026-09-26T01:00:00Z")).toBe("2026-09-26T01:00:00.000Z");
		// several times a day: the latest one that already passed
		expect(at("0,30 8-18 * * *", "2026-09-26T10:10:00Z")).toBe("2026-09-26T10:00:00.000Z");
		// weekly, Fridays at 18: on Monday morning it is last Friday's (26 September 2026 is a Saturday)
		expect(at("0 18 * * 5", "2026-09-28T06:00:00Z")).toBe("2026-09-25T16:00:00.000Z");
		// the day of the month or the day of the week
		expect(at("0 0 1 * 0", "2026-09-29T10:00:00Z")).toBe("2026-09-26T22:00:00.000Z");
		expect(previousCronRun("nope", new Date(), TZ)).toBeNull();
		// 30 February never comes
		expect(previousCronRun("0 3 30 2 *", new Date("2026-09-26T00:00:00Z"), TZ)).toBeNull();
	});

	it("follows the library's time zone across the changes of daylight saving time", () => {
		const at = (expr: string, before: string, tz = TZ): string | undefined =>
			previousCronRun(expr, new Date(before), tz)?.toISOString();
		// winter time from 25 October 2026: 3:00 is 02:00 UTC that day, 01:00 UTC the day before
		expect(at("0 3 * * *", "2026-10-25T10:00:00Z")).toBe("2026-10-25T02:00:00.000Z");
		expect(at("0 3 * * *", "2026-10-25T01:30:00Z")).toBe("2026-10-24T01:00:00.000Z");
		// summer time from 29 March 2026: 2:30 does not exist that night, the last run is the 28th
		expect(at("30 2 * * *", "2026-03-29T10:00:00Z")).toBe("2026-03-28T01:30:00.000Z");
		// another zone, same expression
		expect(at("0 3 * * *", "2026-09-26T12:00:00Z", "America/New_York")).toBe(
			"2026-09-26T07:00:00.000Z",
		);
	});
});
