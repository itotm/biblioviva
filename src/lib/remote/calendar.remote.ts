// SPDX-License-Identifier: GPL-3.0-or-later
// The notable dates of the calendar (step 9.25, Q125): every account reads them, the accounts with
// `loans` write them (add, edit, delete).
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { orNotFound, refusing } from "#lib/server/http/errors.js";
import { getDb } from "#lib/server/db/index.js";
import {
	calendarEventsBetween,
	CalendarEventValidationError,
	createCalendarEvent,
	deleteCalendarEvent,
	updateCalendarEvent,
} from "#lib/server/services/calendar-events.js";
import { EVENT_NOTES_MAX, EVENT_TITLE_MAX } from "#lib/shared/calendar-events.js";
import { dbId as id, isoDay } from "#lib/shared/input-schemas.js";

/** The dates touching the days from `from` to `to` (the months shown). */
export const getCalendarEvents = query(v.object({ from: isoDay, to: isoDay }), ({ from, to }) => {
	requireUser();
	return calendarEventsBetween(getDb(), from, to);
});

export const saveCalendarEvent = command(
	v.object({
		/** Absent: a new date. */
		id: v.optional(id),
		// a little room over the limits: the service trims, then measures
		title: v.pipe(v.string(), v.maxLength(EVENT_TITLE_MAX * 2)),
		notes: v.pipe(v.string(), v.maxLength(EVENT_NOTES_MAX * 2)),
		startsOn: v.string(),
		endsOn: v.string(),
	}),
	({ id: eventId, ...input }) => {
		const user = requireUser("loans");
		return refusing(
			() => {
				if (eventId === undefined) {
					return { ok: true as const, id: createCalendarEvent(getDb(), input, user) };
				}
				updateCalendarEvent(getDb(), eventId, input, user);
				return { ok: true as const, id: eventId };
			},
			CalendarEventValidationError,
			(e) => ({ ok: false as const, error: e.code }),
		);
	},
);

export const removeCalendarEvent = command(v.object({ id }), (input) => {
	const user = requireUser("loans");
	orNotFound(() => deleteCalendarEvent(getDb(), input.id, user));
	return { ok: true as const };
});
