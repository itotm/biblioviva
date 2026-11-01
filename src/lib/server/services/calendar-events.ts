// SPDX-License-Identifier: GPL-3.0-or-later
// The notable dates of the calendar (PLAN.md step 9.25, Q125): what the staff mark for
// everyone — a reading in a class, the deadlines of the bookmark contest — as a title, a note and
// one day or a period. Every account reads them; the remote functions let only the accounts with
// `loans` write them. They never change a due date. Audit rows carry the id, never the text.
import { NotFoundError, ServiceError } from "#lib/server/errors.js";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { DbOrTx } from "#lib/server/db/client.js";
import { calendarEvent, staffUser } from "#lib/server/db/schema.js";
import { demoText } from "#lib/server/demo/content.js";
import { addDays } from "#lib/shared/calendar-core.js";
import {
	EVENT_NOTES_MAX,
	EVENT_TITLE_MAX,
	UPCOMING_DAYS,
	UPCOMING_LIMIT,
	type CalendarEventInput,
} from "#lib/shared/calendar-events.js";
import { audit, type AuditActor } from "./audit.js";

export interface CalendarEventRow {
	id: number;
	startsOn: string;
	/** The last day of a period; null for one day. */
	endsOn: string | null;
	title: string;
	notes: string | null;
	/** The account that last wrote it (display name, or username). */
	author: string | null;
}

export type CalendarEventIssue = "title" | "titleTooLong" | "notesTooLong" | "date" | "period";

export class CalendarEventValidationError extends ServiceError {
	constructor(override readonly code: CalendarEventIssue) {
		super(code, `calendar event: ${code}`);
		this.name = "CalendarEventValidationError";
	}
}

export class CalendarEventNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("calendar event", `calendar event ${String(id)} not found`);
		this.name = "CalendarEventNotFoundError";
	}
}

/** A real day of the calendar written `YYYY-MM-DD` (no 30 February). */
function isDay(value: string): boolean {
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
	);
}

/** Trims the texts, checks the lengths and the days; a period ending on its first day is one day. */
export function validateCalendarEvent(input: CalendarEventInput): {
	startsOn: string;
	endsOn: string | null;
	title: string;
	notes: string | null;
} {
	const title = input.title.trim();
	const notes = input.notes
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.trim();
	if (title === "") {
		throw new CalendarEventValidationError("title");
	}
	if (title.length > EVENT_TITLE_MAX) {
		throw new CalendarEventValidationError("titleTooLong");
	}
	if (notes.length > EVENT_NOTES_MAX) {
		throw new CalendarEventValidationError("notesTooLong");
	}
	if (!isDay(input.startsOn) || (input.endsOn !== "" && !isDay(input.endsOn))) {
		throw new CalendarEventValidationError("date");
	}
	if (input.endsOn !== "" && input.endsOn < input.startsOn) {
		throw new CalendarEventValidationError("period");
	}
	return {
		startsOn: input.startsOn,
		endsOn: input.endsOn === "" || input.endsOn === input.startsOn ? null : input.endsOn,
		title,
		notes: notes === "" ? null : notes,
	};
}

/** The last day of a date: its end, or the day itself. */
const lastDay = sql<string>`coalesce(${calendarEvent.endsOn}, ${calendarEvent.startsOn})`;

function listWhere(db: DbOrTx, where: ReturnType<typeof and>, limit?: number): CalendarEventRow[] {
	const author = alias(staffUser, "author");
	const query = db
		.select({
			id: calendarEvent.id,
			startsOn: calendarEvent.startsOn,
			endsOn: calendarEvent.endsOn,
			title: calendarEvent.title,
			notes: calendarEvent.notes,
			author: sql<string | null>`coalesce(${author.displayName}, ${author.username})`,
		})
		.from(calendarEvent)
		.leftJoin(author, eq(author.id, calendarEvent.updatedBy))
		.where(where)
		.orderBy(asc(calendarEvent.startsOn), asc(lastDay), asc(calendarEvent.id));
	return limit === undefined ? query.all() : query.limit(limit).all();
}

/** The dates touching the days from `from` to `to` (a period counts on every one of its days). */
export function calendarEventsBetween(db: DbOrTx, from: string, to: string): CalendarEventRow[] {
	return listWhere(db, and(lte(calendarEvent.startsOn, to), gte(lastDay, from)));
}

/**
 * The next dates for the dashboard: those still running today or starting within `days`, the
 * nearest first, at most `limit`.
 */
export function upcomingCalendarEvents(
	db: DbOrTx,
	today: string,
	days = UPCOMING_DAYS,
	limit = UPCOMING_LIMIT,
): { events: CalendarEventRow[]; total: number } {
	const where = and(lte(calendarEvent.startsOn, addDays(today, days)), gte(lastDay, today));
	const total =
		db
			.select({ n: sql<number>`count(*)` })
			.from(calendarEvent)
			.where(where)
			.get()?.n ?? 0;
	return { events: listWhere(db, where, limit), total };
}

/** What the public demo keeps of the texts a visitor sends (Q121): an example instead. */
function sent(
	input: CalendarEventInput,
	stored: { title: string; notes: string | null } | undefined,
	now: Date,
): CalendarEventInput {
	return {
		...input,
		title: demoText("date", input.title, stored?.title, now),
		notes: demoText("comment", input.notes, stored?.notes, now),
	};
}

export function createCalendarEvent(
	db: DbOrTx,
	input: CalendarEventInput,
	actor: AuditActor,
	now = new Date(),
): number {
	const data = validateCalendarEvent(sent(input, undefined, now));
	return db.transaction((tx) => {
		const row = tx
			.insert(calendarEvent)
			.values({
				...data,
				createdBy: actor.id,
				updatedBy: actor.id,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
			})
			.returning({ id: calendarEvent.id })
			.get();
		audit(tx, actor, "calendar_event.create", "calendar_event", row.id, undefined, now);
		return row.id;
	});
}

export function updateCalendarEvent(
	db: DbOrTx,
	id: number,
	input: CalendarEventInput,
	actor: AuditActor,
	now = new Date(),
): void {
	db.transaction((tx) => {
		const stored = tx.select().from(calendarEvent).where(eq(calendarEvent.id, id)).get();
		if (!stored) {
			throw new CalendarEventNotFoundError(id);
		}
		const data = validateCalendarEvent(sent(input, stored, now));
		tx.update(calendarEvent)
			.set({ ...data, updatedBy: actor.id, updatedAt: now.toISOString() })
			.where(eq(calendarEvent.id, id))
			.run();
		audit(tx, actor, "calendar_event.update", "calendar_event", id, undefined, now);
	});
}

export function deleteCalendarEvent(
	db: DbOrTx,
	id: number,
	actor: AuditActor,
	now = new Date(),
): void {
	db.transaction((tx) => {
		const removed = tx
			.delete(calendarEvent)
			.where(eq(calendarEvent.id, id))
			.returning({ id: calendarEvent.id })
			.get();
		if (!removed) {
			throw new CalendarEventNotFoundError(id);
		}
		audit(tx, actor, "calendar_event.delete", "calendar_event", id, undefined, now);
	});
}
