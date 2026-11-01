// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, calendarEvent, staffUser } from "#lib/server/db/schema.js";
import {
	EVENT_NOTES_MAX,
	EVENT_TITLE_MAX,
	type CalendarEventInput,
} from "#lib/shared/calendar-events.js";
import {
	calendarEventsBetween,
	CalendarEventNotFoundError,
	type CalendarEventRow,
	CalendarEventValidationError,
	createCalendarEvent,
	deleteCalendarEvent,
	upcomingCalendarEvents,
	updateCalendarEvent,
	validateCalendarEvent,
} from "./calendar-events.js";

/** A stored date as the calendar page lists it. */
function stored(db: Db, id: number): CalendarEventRow | undefined {
	return calendarEventsBetween(db, "2000-01-01", "2099-12-31").find((e) => e.id === id);
}

function setup(): { db: Db; desk: { id: number } } {
	const db = createTestDb();
	const desk = db
		.insert(staffUser)
		.values({ username: "prestiti", displayName: "Gestione prestiti", passwordHash: "x" })
		.returning({ id: staffUser.id })
		.get();
	return { db, desk };
}

const day = (title: string, startsOn: string, endsOn = "", notes = ""): CalendarEventInput => ({
	title,
	notes,
	startsOn,
	endsOn,
});

const issue = (input: CalendarEventInput): string => {
	try {
		validateCalendarEvent(input);
		return "ok";
	} catch (e) {
		return e instanceof CalendarEventValidationError ? e.code : "other";
	}
};

describe("notable dates of the calendar (9.25)", () => {
	it("trims the texts and checks title, note, days and period", () => {
		expect(
			validateCalendarEvent(day("  Lettura in classe ", "2026-11-12", "", " libro \n\n ")),
		).toEqual({
			title: "Lettura in classe",
			notes: "libro",
			startsOn: "2026-11-12",
			endsOn: null,
		});
		// a period ending on its first day is one day
		expect(validateCalendarEvent(day("Mostra", "2026-11-12", "2026-11-12")).endsOn).toBeNull();
		expect(issue(day("   ", "2026-11-12"))).toBe("title");
		expect(issue(day("x".repeat(EVENT_TITLE_MAX + 1), "2026-11-12"))).toBe("titleTooLong");
		expect(issue(day("t", "2026-11-12", "", "n".repeat(EVENT_NOTES_MAX + 1)))).toBe(
			"notesTooLong",
		);
		expect(issue(day("t", "2026-02-30"))).toBe("date");
		expect(issue(day("t", "12/11/2026"))).toBe("date");
		expect(issue(day("t", "2026-11-12", "2026-11-10"))).toBe("period");
		expect(issue(day("t", "2026-11-12", "2026-11-14"))).toBe("ok");
	});

	it("lists the dates of a range, a period on every one of its days, in order", () => {
		const { db, desk } = setup();
		const contest = createCalendarEvent(db, day("Concorso", "2026-11-02", "2026-11-20"), desk);
		const reading = createCalendarEvent(db, day("Lettura", "2026-11-12"), desk);
		const december = createCalendarEvent(db, day("Natale", "2026-12-18"), desk);
		expect(calendarEventsBetween(db, "2026-11-01", "2026-11-30").map((e) => e.id)).toEqual([
			contest,
			reading,
		]);
		// a period that started before the month still shows in it
		expect(calendarEventsBetween(db, "2026-11-15", "2026-11-30").map((e) => e.id)).toEqual([
			contest,
		]);
		expect(calendarEventsBetween(db, "2026-12-01", "2026-12-31").map((e) => e.id)).toEqual([
			december,
		]);
		expect(stored(db, reading)).toMatchObject({
			title: "Lettura",
			endsOn: null,
			author: "Gestione prestiti",
		});
	});

	it("gives the dashboard the next dates: still running or within the days ahead", () => {
		const { db, desk } = setup();
		const past = createCalendarEvent(db, day("Passato", "2026-10-01"), desk);
		const running = createCalendarEvent(db, day("In corso", "2026-10-15", "2026-10-25"), desk);
		const soon = createCalendarEvent(db, day("Presto", "2026-10-22"), desk);
		const later = createCalendarEvent(db, day("Più avanti", "2026-11-30"), desk);
		const next = upcomingCalendarEvents(db, "2026-10-20", 30, 5);
		expect(next.events.map((e) => e.id)).toEqual([running, soon]);
		expect(next.total).toBe(2);
		expect(next.events.map((e) => e.id)).not.toContain(past);
		expect(upcomingCalendarEvents(db, "2026-10-20", 60, 1)).toMatchObject({ total: 3 });
		expect(upcomingCalendarEvents(db, "2026-10-20", 60, 1).events.map((e) => e.id)).toEqual([
			running,
		]);
		expect(later).toBeGreaterThan(0);
	});

	it("edits and deletes, auditing the id only, never the text", () => {
		const { db, desk } = setup();
		const id = createCalendarEvent(db, day("Lettura segreta", "2026-11-12"), desk);
		updateCalendarEvent(
			db,
			id,
			day("Lettura in 3 B", "2026-11-13", "", "Il piccolo principe"),
			desk,
		);
		expect(stored(db, id)).toMatchObject({
			title: "Lettura in 3 B",
			startsOn: "2026-11-13",
			notes: "Il piccolo principe",
		});
		deleteCalendarEvent(db, id, desk);
		expect(db.select().from(calendarEvent).where(eq(calendarEvent.id, id)).all()).toEqual([]);
		expect(() => deleteCalendarEvent(db, id, desk)).toThrow(CalendarEventNotFoundError);
		expect(() => updateCalendarEvent(db, id, day("x", "2026-11-13"), desk)).toThrow(
			CalendarEventNotFoundError,
		);
		const rows = db.select().from(auditLog).all();
		expect(rows.map((r) => r.action)).toEqual([
			"calendar_event.create",
			"calendar_event.update",
			"calendar_event.delete",
		]);
		expect(JSON.stringify(rows)).not.toContain("Lettura");
	});
});
