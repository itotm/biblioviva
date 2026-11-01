// SPDX-License-Identifier: GPL-3.0-or-later
// The library calendar from the configuration (PLAN.md §3.8, step 4.1): the rules of
// `calendar` (yearly `calendar.<year>.json` fragments already merged by the loader), "today" in
// `library.timezone`, and the months of a school year for the read-only view of Administration.
import type { AppConfig } from "#lib/server/config/schema.js";
import {
	addDays,
	closedReason,
	type CalendarRules,
	type ClosedReason,
} from "#lib/shared/calendar-core.js";
import { todayIn, zonedParts } from "#lib/shared/dates.js";
import { schoolYearStartDate } from "#lib/shared/school-year.js";

export function calendarRules(config: AppConfig): CalendarRules {
	return config.calendar;
}

/** Today in the library's time zone (never the container's): `todayIn` of `library.timezone`. */
export function libraryToday(config: AppConfig, now = new Date()): string {
	return todayIn(config.library.timezone, now);
}

/** The calendar year in the library's time zone: the year in new copy barcodes and card numbers. */
export function libraryYear(config: AppConfig, now = new Date()): number {
	return Number(zonedParts(now, config.library.timezone).year);
}

export interface CalendarDay {
	date: string;
	/** 1 = Monday … 7 = Sunday (Italian weeks start on Monday). */
	isoWeekday: number;
	closed: ClosedReason | null;
}

export interface CalendarMonth {
	/** `YYYY-MM` */
	month: string;
	days: CalendarDay[];
	openDays: number;
}

/** Twelve months of the school year that starts in `startYear` (September to August by default). */
export function schoolYearMonths(config: AppConfig, startYear: number): CalendarMonth[] {
	const cal = calendarRules(config);
	const first = `${startYear}-${config.library.schoolYearStart}`;
	const months: CalendarMonth[] = [];
	let day = `${first.slice(0, 7)}-01`;
	for (let m = 0; m < 12; m++) {
		const month = day.slice(0, 7);
		const days: CalendarDay[] = [];
		while (day.slice(0, 7) === month) {
			const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
			days.push({ date: day, isoWeekday: wd === 0 ? 7 : wd, closed: closedReason(day, cal) });
			day = addDays(day, 1);
		}
		months.push({ month, days, openDays: days.filter((d) => d.closed === null).length });
	}
	return months;
}

/** The first calendar year of the school year that contains today. */
export function currentSchoolYearStart(config: AppConfig, now = new Date()): number {
	return Number(
		schoolYearStartDate(libraryToday(config, now), config.library.schoolYearStart).slice(0, 4),
	);
}
