// SPDX-License-Identifier: GPL-3.0-or-later
// The next runs of a five-field cron expression in the library's time zone (step 11.8: the backup
// page shows when the next backups happen while the expression is typed), and the last one before
// an instant (step 9.33: the backup at start when the scheduled one was missed). Minutes, hours, days of
// the month, months and days of the week, each `*`, a number, a list, a range or a step (`*/15`,
// `1-5`, `0,30`); day 7 is Sunday like 0; when both days are restricted either one matches, as in
// cron. Names (`MON`, `JAN`) are not supported.
import { TZDate } from "@date-fns/tz";

interface Fields {
	minutes: Set<number>;
	hours: Set<number>;
	days: Set<number>;
	months: Set<number>;
	weekdays: Set<number>;
	anyDay: boolean;
	anyWeekday: boolean;
}

function field(text: string, min: number, max: number): Set<number> | null {
	const out = new Set<number>();
	for (const part of text.split(",")) {
		const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
		if (!m) {
			return null;
		}
		const step = m[4] === undefined ? 1 : Number(m[4]);
		const from = m[1] === "*" ? min : Number(m[2]);
		const to = m[1] === "*" ? max : m[3] === undefined ? (m[4] ? max : from) : Number(m[3]);
		if (step < 1 || from < min || to > max || from > to) {
			return null;
		}
		for (let v = from; v <= to; v += step) {
			out.add(v);
		}
	}
	return out;
}

/** The expression's fields, or null when it is not a valid five-field expression. */
export function parseCron(expr: string): Fields | null {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) {
		return null;
	}
	const [mi, h, d, mo, w] = parts as [string, string, string, string, string];
	const minutes = field(mi, 0, 59);
	const hours = field(h, 0, 23);
	const days = field(d, 1, 31);
	const months = field(mo, 1, 12);
	const weekdays = field(w, 0, 7);
	if (!minutes || !hours || !days || !months || !weekdays) {
		return null;
	}
	if (weekdays.has(7)) {
		weekdays.add(0);
	}
	return { minutes, hours, days, months, weekdays, anyDay: d === "*", anyWeekday: w === "*" };
}

/** Whether the expression fires on this day (the month, and the day of the month or of the week). */
function dayMatches(f: Fields, day: TZDate): boolean {
	const dayOk =
		f.anyDay && f.anyWeekday
			? true
			: f.anyDay
				? f.weekdays.has(day.getDay())
				: f.anyWeekday
					? f.days.has(day.getDate())
					: f.days.has(day.getDate()) || f.weekdays.has(day.getDay());
	return f.months.has(day.getMonth() + 1) && dayOk;
}

/** The next `count` runs after `from`, as instants, in the wall clock of `timezone`. */
export function nextCronRuns(expr: string, from: Date, timezone: string, count = 3): Date[] | null {
	const f = parseCron(expr);
	if (!f) {
		return null;
	}
	const out: Date[] = [];
	const start = new TZDate(from.getTime(), timezone);
	const minutes = [...f.minutes].sort((a, b) => a - b);
	const hours = [...f.hours].sort((a, b) => a - b);
	// day by day for up to eight years (enough for 29 February)
	for (let i = 0; i < 366 * 8 && out.length < count; i++) {
		const day = new TZDate(
			start.getFullYear(),
			start.getMonth(),
			start.getDate() + i,
			timezone,
		);
		if (!dayMatches(f, day)) {
			continue;
		}
		for (const h of hours) {
			for (const m of minutes) {
				const at = new TZDate(
					day.getFullYear(),
					day.getMonth(),
					day.getDate(),
					h,
					m,
					timezone,
				);
				// a wall-clock time skipped by the change to summer time does not exist
				if (at.getHours() !== h || at.getTime() <= from.getTime()) {
					continue;
				}
				out.push(new Date(at.getTime()));
				if (out.length === count) {
					return out;
				}
			}
		}
	}
	return out;
}

/**
 * The last run at or before `before`, as an instant, in the wall clock of `timezone`; null when the
 * expression is not valid or never fired in the eight years before.
 */
export function previousCronRun(expr: string, before: Date, timezone: string): Date | null {
	const f = parseCron(expr);
	if (!f) {
		return null;
	}
	const start = new TZDate(before.getTime(), timezone);
	const minutes = [...f.minutes].sort((a, b) => b - a);
	const hours = [...f.hours].sort((a, b) => b - a);
	// day by day backwards, latest time of the day first
	for (let i = 0; i < 366 * 8; i++) {
		const day = new TZDate(
			start.getFullYear(),
			start.getMonth(),
			start.getDate() - i,
			timezone,
		);
		if (!dayMatches(f, day)) {
			continue;
		}
		for (const h of hours) {
			for (const m of minutes) {
				const at = new TZDate(
					day.getFullYear(),
					day.getMonth(),
					day.getDate(),
					h,
					m,
					timezone,
				);
				// a wall-clock time skipped by the change to summer time does not exist
				if (at.getHours() !== h || at.getTime() > before.getTime()) {
					continue;
				}
				return new Date(at.getTime());
			}
		}
	}
	return null;
}
