// SPDX-License-Identifier: GPL-3.0-or-later
// The library calendar (PLAN.md §3.8, step 4.1): open and closed days from the weekly closing
// days, the Italian national holidays (Easter Monday by computus), explicit holidays and closed
// ranges, and the three Koha-like due date modes. Pure functions over `YYYY-MM-DD` strings, so
// the server and the browser agree and the container's time zone never matters.

export interface CalendarRules {
	/** 0 = Sunday … 6 = Saturday. */
	weeklyClosedDays: readonly number[];
	autoItalianHolidays: boolean;
	holidays: readonly string[];
	closedRanges: readonly { from: string; to: string; reason?: string }[];
}

export type DueDateMode = "datedue" | "calendar" | "days";

export type ClosedReason =
	| { kind: "weekly" }
	| { kind: "national"; name: NationalHoliday }
	| { kind: "holiday" }
	| { kind: "range"; reason: string };

export type NationalHoliday =
	| "newYear"
	| "epiphany"
	| "easterMonday"
	| "liberation"
	| "labour"
	| "republic"
	| "assumption"
	| "allSaints"
	| "immaculate"
	| "christmas"
	| "stStephen";

/** Days are handled at noon UTC so no DST change can move them. */
function toDate(iso: string): Date {
	return new Date(`${iso}T12:00:00Z`);
}

function toIso(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
	const d = toDate(iso);
	d.setUTCDate(d.getUTCDate() + days);
	return toIso(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string): number {
	return toDate(iso).getUTCDay();
}

/** Easter Sunday (Gregorian calendar, anonymous algorithm, "Meeus/Jones/Butcher"). */
/** The first day of the week (`library.weekStart`, 9.13 round 17). */
export const WEEK_STARTS = ["monday", "sunday", "saturday"] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];
const FIRST_DAY: Record<WeekStart, number> = { monday: 1, sunday: 0, saturday: 6 };

/** The seven JavaScript weekdays (0 = Sunday) in the order a week row shows them. */
export function weekOrder(start: WeekStart): number[] {
	return Array.from({ length: 7 }, (_, i) => (FIRST_DAY[start] + i) % 7);
}

/** The position of a date in its week row (0 = the first day of the week). */
export function weekPosition(iso: string, start: WeekStart): number {
	return (weekday(iso) - FIRST_DAY[start] + 7) % 7;
}

/** The last day of the week of `iso`. */
export function endOfWeek(iso: string, start: WeekStart): string {
	return addDays(iso, 6 - weekPosition(iso, start));
}

/**
 * The week start chosen at the first start from the language: Monday in Italy (and by default),
 * Sunday for English (owner decision); changeable in the configuration afterwards.
 */
export function defaultWeekStart(locale: string): WeekStart {
	return locale === "en" ? "sunday" : "monday";
}

export function easterSunday(year: number): string {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The Italian national holidays of a year. */
export function italianHolidays(year: number): Map<string, NationalHoliday> {
	const y = String(year);
	return new Map<string, NationalHoliday>([
		[`${y}-01-01`, "newYear"],
		[`${y}-01-06`, "epiphany"],
		[addDays(easterSunday(year), 1), "easterMonday"],
		[`${y}-04-25`, "liberation"],
		[`${y}-05-01`, "labour"],
		[`${y}-06-02`, "republic"],
		[`${y}-08-15`, "assumption"],
		[`${y}-11-01`, "allSaints"],
		[`${y}-12-08`, "immaculate"],
		[`${y}-12-25`, "christmas"],
		[`${y}-12-26`, "stStephen"],
	]);
}

const nationalCache = new Map<number, Map<string, NationalHoliday>>();

function nationalHoliday(iso: string): NationalHoliday | undefined {
	const year = Number(iso.slice(0, 4));
	let map = nationalCache.get(year);
	if (!map) {
		map = italianHolidays(year);
		nationalCache.set(year, map);
	}
	return map.get(iso);
}

/** Why the library is closed on a day, or null when it is open. Explicit closures come first. */
export function closedReason(iso: string, cal: CalendarRules): ClosedReason | null {
	const range = cal.closedRanges.find((r) => iso >= r.from && iso <= r.to);
	if (range) {
		return { kind: "range", reason: range.reason ?? "" };
	}
	if (cal.holidays.includes(iso)) {
		return { kind: "holiday" };
	}
	if (cal.autoItalianHolidays) {
		const name = nationalHoliday(iso);
		if (name) {
			return { kind: "national", name };
		}
	}
	if (cal.weeklyClosedDays.includes(weekday(iso))) {
		return { kind: "weekly" };
	}
	return null;
}

/** Days in a row closed for one reason. */
export interface ClosureRun {
	from: string;
	to: string;
	closed: ClosedReason;
}

const sameReason = (a: ClosedReason, b: ClosedReason): boolean =>
	JSON.stringify(a) === JSON.stringify(b);

/**
 * The closures of a list of days (in date order) joined into runs of consecutive days closed for
 * the same reason; the weekly closed days are left out.
 */
export function closureRuns(
	days: readonly { date: string; closed: ClosedReason | null }[],
): ClosureRun[] {
	const runs: ClosureRun[] = [];
	for (const d of days) {
		if (!d.closed || d.closed.kind === "weekly") {
			continue;
		}
		const last = runs.at(-1);
		if (last && addDays(last.to, 1) === d.date && sameReason(last.closed, d.closed)) {
			last.to = d.date;
		} else {
			runs.push({ from: d.date, to: d.date, closed: d.closed });
		}
	}
	return runs;
}

export function isOpenDay(iso: string, cal: CalendarRules): boolean {
	return closedReason(iso, cal) === null;
}

export class CalendarClosedError extends Error {
	constructor(readonly from: string) {
		super(`no open day within a year after ${from}`);
		this.name = "CalendarClosedError";
	}
}

/** Longest search for an open day: a year covers any summer closure. */
const MAX_SCAN_DAYS = 400;

/** The day itself when open, else the next open day ("push to open day"). */
export function pushToOpenDay(iso: string, cal: CalendarRules): string {
	let day = iso;
	for (let i = 0; i < MAX_SCAN_DAYS; i++) {
		if (isOpenDay(day, cal)) {
			return day;
		}
		day = addDays(day, 1);
	}
	throw new CalendarClosedError(iso);
}

/** The first open day strictly after `iso`. */
export function nextOpenDay(iso: string, cal: CalendarRules): string {
	return pushToOpenDay(addDays(iso, 1), cal);
}

/** The day `count` open days after `iso` (`iso` itself is not counted). */
export function addOpenDays(iso: string, count: number, cal: CalendarRules): string {
	let day = iso;
	for (let i = 0; i < count; i++) {
		day = nextOpenDay(day, cal);
	}
	return day;
}

/**
 * The due date of a loan made (or renewed) on `from` for `days` days (§3.8):
 * `datedue` adds the days and moves to the next open day, `calendar` counts open days only,
 * `days` ignores the calendar. A hard due date caps the result.
 */
export function computeDueDate(
	from: string,
	days: number,
	mode: DueDateMode,
	cal: CalendarRules,
	hardDueDate: string | null = null,
): string {
	const due =
		mode === "calendar"
			? addOpenDays(from, days, cal)
			: mode === "days"
				? addDays(from, days)
				: pushToOpenDay(addDays(from, days), cal);
	return hardDueDate !== null && hardDueDate < due ? hardDueDate : due;
}

/** Days between two dates (`to - from`), negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
	return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}
