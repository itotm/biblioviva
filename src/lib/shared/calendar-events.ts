// SPDX-License-Identifier: GPL-3.0-or-later
// The notable dates of the calendar (PLAN.md step 9.25, Q125), shared by the pages and the server:
// the form of a date (a title, a note, one day or a period) and its limits.
import * as v from "valibot";
import { isoDay, isoDayOrEmpty } from "#lib/shared/input-schemas.js";

export const EVENT_TITLE_MAX = 120;
export const EVENT_NOTES_MAX = 500;
/** The dashboard lists the dates of this many days ahead, at most `UPCOMING_LIMIT` of them. */
export const UPCOMING_DAYS = 30;
export const UPCOMING_LIMIT = 5;

export const calendarEventSchema = v.object({
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(EVENT_TITLE_MAX)),
	notes: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(EVENT_NOTES_MAX)), ""),
	startsOn: isoDay,
	/** `""`: one day only. */
	endsOn: v.optional(isoDayOrEmpty, ""),
});
export type CalendarEventInput = v.InferOutput<typeof calendarEventSchema>;
