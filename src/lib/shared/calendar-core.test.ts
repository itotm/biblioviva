// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	addDays,
	addOpenDays,
	CalendarClosedError,
	closedReason,
	closureRuns,
	computeDueDate,
	daysBetween,
	defaultWeekStart,
	easterSunday,
	endOfWeek,
	isOpenDay,
	italianHolidays,
	nextOpenDay,
	pushToOpenDay,
	weekday,
	weekOrder,
	weekPosition,
	type CalendarRules,
} from "./calendar-core.js";

const cal: CalendarRules = {
	weeklyClosedDays: [0, 6],
	autoItalianHolidays: true,
	holidays: ["2026-11-02"],
	closedRanges: [
		{ from: "2026-12-23", to: "2027-01-06", reason: "Vacanze di Natale" },
		{ from: "2027-06-10", to: "2027-09-13", reason: "Chiusura estiva" },
	],
};

describe("dates", () => {
	it("adds days across months, years and DST changes", () => {
		expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
		expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
		expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
		expect(weekday("2026-09-25")).toBe(5);
		expect(daysBetween("2026-09-01", "2026-09-25")).toBe(24);
		expect(daysBetween("2026-09-25", "2026-09-01")).toBe(-24);
	});

	it("computes Easter and Easter Monday", () => {
		expect(easterSunday(2026)).toBe("2026-04-05");
		expect(easterSunday(2027)).toBe("2027-03-28");
		expect(easterSunday(2024)).toBe("2024-03-31");
		expect(easterSunday(2038)).toBe("2038-04-25");
		const h2026 = italianHolidays(2026);
		expect(h2026.get("2026-04-06")).toBe("easterMonday");
		expect(italianHolidays(2027).get("2027-03-29")).toBe("easterMonday");
		expect(h2026.size).toBe(11);
		expect(h2026.get("2026-06-02")).toBe("republic");
	});
});

describe("open and closed days", () => {
	it("explains why a day is closed", () => {
		expect(closedReason("2026-09-25", cal)).toBeNull();
		expect(closedReason("2026-09-26", cal)).toEqual({ kind: "weekly" });
		expect(closedReason("2026-04-06", cal)).toEqual({ kind: "national", name: "easterMonday" });
		expect(closedReason("2026-11-02", cal)).toEqual({ kind: "holiday" });
		expect(closedReason("2026-12-28", cal)).toEqual({
			kind: "range",
			reason: "Vacanze di Natale",
		});
		// the range wins over the national holiday it contains
		expect(closedReason("2026-12-25", cal)).toEqual({
			kind: "range",
			reason: "Vacanze di Natale",
		});
		expect(isOpenDay("2026-04-06", { ...cal, autoItalianHolidays: false })).toBe(true);
		expect(
			closedReason("2026-12-28", {
				...cal,
				closedRanges: [{ from: "2026-12-28", to: "2026-12-28" }],
			}),
		).toEqual({
			kind: "range",
			reason: "",
		});
	});

	it("joins consecutive days closed for the same reason, weekly closures left out", () => {
		const days = Array.from({ length: 70 }, (_, i) => {
			const date = addDays("2026-10-30", i);
			return { date, closed: closedReason(date, cal) };
		});
		expect(closureRuns(days)).toEqual([
			{
				from: "2026-11-01",
				to: "2026-11-01",
				closed: { kind: "national", name: "allSaints" },
			},
			{ from: "2026-11-02", to: "2026-11-02", closed: { kind: "holiday" } },
			{
				from: "2026-12-08",
				to: "2026-12-08",
				closed: { kind: "national", name: "immaculate" },
			},
			{
				from: "2026-12-23",
				to: "2027-01-06",
				closed: { kind: "range", reason: "Vacanze di Natale" },
			},
		]);
		// two ranges side by side stay apart, as their reasons
		const two = {
			...cal,
			closedRanges: [
				{ from: "2027-02-15", to: "2027-02-16", reason: "Carnevale" },
				{ from: "2027-02-17", to: "2027-02-17", reason: "Ceneri" },
			],
		};
		const feb = ["2027-02-15", "2027-02-16", "2027-02-17"].map((date) => ({
			date,
			closed: closedReason(date, two),
		}));
		expect(closureRuns(feb).map((r) => [r.from, r.to])).toEqual([
			["2027-02-15", "2027-02-16"],
			["2027-02-17", "2027-02-17"],
		]);
	});

	it("pushes to the next open day and counts open days", () => {
		expect(pushToOpenDay("2026-09-25", cal)).toBe("2026-09-25");
		expect(pushToOpenDay("2026-09-26", cal)).toBe("2026-09-28");
		expect(nextOpenDay("2026-09-25", cal)).toBe("2026-09-28");
		// Christmas break: from the 23rd to the Epiphany, then the weekend
		expect(pushToOpenDay("2026-12-23", cal)).toBe("2027-01-07");
		expect(addOpenDays("2026-09-25", 3, cal)).toBe("2026-09-30");
		expect(addOpenDays("2026-09-25", 0, cal)).toBe("2026-09-25");
		expect(() =>
			pushToOpenDay("2026-01-01", { ...cal, weeklyClosedDays: [0, 1, 2, 3, 4, 5, 6] }),
		).toThrow(CalendarClosedError);
	});
});

describe("due dates", () => {
	it("datedue: add the days, then move to the next open day", () => {
		// 15 days from Friday 25 September = Saturday 10 October → Monday 12
		expect(computeDueDate("2026-09-25", 15, "datedue", cal)).toBe("2026-10-12");
		// Easter Monday 2026 is closed
		expect(computeDueDate("2026-03-22", 15, "datedue", cal)).toBe("2026-04-07");
		// into the summer closure
		expect(computeDueDate("2027-06-01", 15, "datedue", cal)).toBe("2027-09-14");
	});

	it("calendar: count open days only", () => {
		expect(computeDueDate("2026-09-25", 15, "calendar", cal)).toBe("2026-10-16");
		// Monday 21, Tuesday 22, then the break until Thursday 7 January
		expect(computeDueDate("2026-12-18", 3, "calendar", cal)).toBe("2027-01-07");
	});

	it("days: ignore the calendar", () => {
		expect(computeDueDate("2026-09-25", 15, "days", cal)).toBe("2026-10-10");
	});

	it("a hard due date caps every mode", () => {
		expect(computeDueDate("2027-05-30", 15, "datedue", cal, "2027-06-09")).toBe("2027-06-09");
		expect(computeDueDate("2027-05-30", 15, "calendar", cal, "2027-06-09")).toBe("2027-06-09");
		expect(computeDueDate("2027-05-30", 15, "days", cal, "2027-06-09")).toBe("2027-06-09");
		// a later hard due date changes nothing
		expect(computeDueDate("2026-09-25", 15, "datedue", cal, "2027-06-09")).toBe("2026-10-12");
	});
});

describe("week start (9.13, round 17)", () => {
	it("orders the week, places a date in its row and finds the end of its week", () => {
		expect(weekOrder("monday")).toEqual([1, 2, 3, 4, 5, 6, 0]);
		expect(weekOrder("sunday")).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(weekOrder("saturday")).toEqual([6, 0, 1, 2, 3, 4, 5]);
		// 2026-09-01 is a Tuesday
		expect(weekPosition("2026-09-01", "monday")).toBe(1);
		expect(weekPosition("2026-09-01", "sunday")).toBe(2);
		expect(weekPosition("2026-09-01", "saturday")).toBe(3);
		// 2026-09-25 is a Friday
		expect(endOfWeek("2026-09-25", "monday")).toBe("2026-09-27");
		expect(endOfWeek("2026-09-25", "sunday")).toBe("2026-09-26");
		expect(endOfWeek("2026-09-27", "monday")).toBe("2026-09-27");
		expect(endOfWeek("2026-09-27", "sunday")).toBe("2026-10-03");
		expect(endOfWeek("2026-09-25", "saturday")).toBe("2026-09-25");
	});

	it("starts on Monday in Italian and on Sunday in English", () => {
		expect(defaultWeekStart("it")).toBe("monday");
		expect(defaultWeekStart("en")).toBe("sunday");
		expect(defaultWeekStart("de")).toBe("monday");
	});
});
