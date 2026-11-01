// SPDX-License-Identifier: GPL-3.0-or-later
// Date helpers that respect the library time zone (`library.timezone`), never the host clock.
import { TZDate } from "@date-fns/tz";
import { endOfDay, startOfDay } from "date-fns";

/** The wall-clock parts of an instant in a zone, zero-padded (`month` "03", `hour` "07"). */
export interface ZonedParts {
	year: string;
	month: string;
	day: string;
	hour: string;
	minute: string;
	second: string;
}

/** What the clock and the calendar of the zone show at the instant (the library's, `library.timezone`). */
export function zonedParts(instant: Date, timezone: string): ZonedParts {
	const z = new TZDate(instant, timezone);
	const p = (n: number): string => String(n).padStart(2, "0");
	return {
		year: String(z.getFullYear()).padStart(4, "0"),
		month: p(z.getMonth() + 1),
		day: p(z.getDate()),
		hour: p(z.getHours()),
		minute: p(z.getMinutes()),
		second: p(z.getSeconds()),
	};
}

/** `YYYY-MM-DD` of an instant in the given zone. */
export function isoDateIn(instant: Date, timezone: string): string {
	const { year, month, day } = zonedParts(instant, timezone);
	return `${year}-${month}-${day}`;
}

/** Today in the given zone (the library's, `library.timezone`): never the host's clock. */
export function todayIn(timezone: string, now = new Date()): string {
	return isoDateIn(now, timezone);
}

/** `YYYYMMDD-HHmm` of an instant in the given zone: the stamp in the names of exported and backed-up files. */
export function fileStamp(instant: Date, timezone: string): string {
	const { year, month, day, hour, minute } = zonedParts(instant, timezone);
	return `${year}${month}${day}-${hour}${minute}`;
}

/** UTC instants (ISO strings) covering the local days `from`..`to` (inclusive) in the zone. */
export function dayRangeToUtc(
	from: string | undefined,
	to: string | undefined,
	timezone: string,
): { fromIso?: string; toIso?: string } {
	const parse = (s: string): TZDate => {
		const [y, m, d] = s.split("-").map(Number);
		return new TZDate(y ?? 1970, (m ?? 1) - 1, d ?? 1, timezone);
	};
	return {
		fromIso: from ? new Date(startOfDay(parse(from)).getTime()).toISOString() : undefined,
		toIso: to ? new Date(endOfDay(parse(to)).getTime()).toISOString() : undefined,
	};
}

// building a formatter costs far more than using one: lists format many dates with the same one
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

/** Localised date-time for the UI, in the library zone. */
export function formatDateTime(iso: string, locale: string, timezone: string): string {
	const key = `${locale}|${timezone}`;
	let format = dateTimeFormats.get(key);
	if (!format) {
		format = new Intl.DateTimeFormat(locale, {
			dateStyle: "short",
			timeStyle: "short",
			timeZone: timezone,
		});
		dateTimeFormats.set(key, format);
	}
	return format.format(new Date(iso));
}

/** A `dateStyle`, or the parts of a date to show (`{ weekday: "long" }`, `{ month: "long", year: "numeric" }`). */
export type DateShape = "short" | "medium" | "long" | "full" | Intl.DateTimeFormatOptions;

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: string, timeZone: string, shape: DateShape): Intl.DateTimeFormat {
	const key = `${locale}|${timeZone}|${JSON.stringify(shape)}`;
	let format = dateFormats.get(key);
	if (!format) {
		const options = typeof shape === "string" ? { dateStyle: shape } : shape;
		format = new Intl.DateTimeFormat(locale, { ...options, timeZone });
		dateFormats.set(key, format);
	}
	return format;
}

/** Localised date of an instant (ISO timestamp or `Date`), on the library's day. */
export function formatDate(
	instant: string | Date,
	locale: string,
	timezone: string,
	shape: DateShape = "short",
): string {
	return dateFormat(locale, timezone, shape).format(new Date(instant));
}

/**
 * Localised calendar day (`YYYY-MM-DD`: due dates, closures, dates of the calendar): the same
 * day in every zone, since it names a day and not an instant.
 */
export function formatDay(isoDay: string, locale: string, shape: DateShape = "short"): string {
	return dateFormat(locale, "UTC", shape).format(new Date(`${isoDay}T12:00:00Z`));
}
