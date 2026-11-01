// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, note, staffUser } from "#lib/server/db/schema.js";
import { NOTE_COLORS, NOTE_MAX_LENGTH } from "#lib/shared/notes.js";
import {
	archiveNotes,
	countOpenNotes,
	createNote,
	deleteNote,
	listArchivedNotes,
	listOpenNotes,
	type NoteInput,
	NoteNotFoundError,
	NoteValidationError,
	pinnedNotes,
	restoreNote,
	setNotePinned,
	validateNote,
} from "./notes.js";

function setup(): { db: Db; desk: { id: number }; admin: { id: number } } {
	const db = createTestDb();
	const desk = db
		.insert(staffUser)
		.values({ username: "prestiti", displayName: "Gestione prestiti", passwordHash: "x" })
		.returning({ id: staffUser.id })
		.get();
	const admin = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x" })
		.returning({ id: staffUser.id })
		.get();
	return { db, desk, admin };
}

const at = (minute: number): Date => new Date(Date.UTC(2026, 9, 5, 8, minute));
const yellow = (body: string, pinned = false): NoteInput => ({ body, color: "yellow", pinned });

describe("notes", () => {
	it("keeps the line breaks, trims the text and checks length and colour", () => {
		expect(
			validateNote({
				body: "  Scanner \r\n\r\n\r\nnon legge  \n",
				color: "pink",
				pinned: false,
			}),
		).toEqual({
			body: "Scanner\n\nnon legge",
			color: "pink",
			pinned: false,
		});
		expect(() => validateNote(yellow(" \n "))).toThrow(NoteValidationError);
		expect(() => validateNote(yellow("x".repeat(NOTE_MAX_LENGTH + 1)))).toThrow("tooLong");
		expect(validateNote(yellow("x".repeat(NOTE_MAX_LENGTH))).body).toHaveLength(
			NOTE_MAX_LENGTH,
		);
		expect(() => validateNote({ body: "ok", color: "purple", pinned: false })).toThrow("color");
	});

	it("stores every colour the pages offer", () => {
		const { db, desk } = setup();
		for (const color of NOTE_COLORS) {
			createNote(db, { body: color, color, pinned: false }, desk);
		}
		expect(
			listOpenNotes(db)
				.map((n) => n.color)
				.sort(),
		).toEqual([...NOTE_COLORS].sort());
	});

	it("lists the pinned notes first, then the newest, with the account that wrote them", () => {
		const { db, desk, admin } = setup();
		const old = createNote(db, yellow("vecchia"), desk, at(1));
		const pinned = createNote(db, yellow("avviso", true), admin, at(2));
		const fresh = createNote(db, yellow("nuova"), desk, at(3));
		const open = listOpenNotes(db);
		expect(open.map((n) => n.id)).toEqual([pinned, fresh, old]);
		expect(open[0]).toMatchObject({ pinned: true, author: "admin", archivedAt: null });
		expect(open[1]).toMatchObject({ pinned: false, author: "Gestione prestiti" });
		expect(pinnedNotes(db).map((n) => n.id)).toEqual([pinned]);
		expect(countOpenNotes(db)).toBe(3);
	});

	it("pins and unpins an open note", () => {
		const { db, desk, admin } = setup();
		const id = createNote(db, yellow("toner finito"), desk);
		setNotePinned(db, id, true, admin);
		expect(pinnedNotes(db).map((n) => n.id)).toEqual([id]);
		setNotePinned(db, id, false, admin);
		expect(pinnedNotes(db)).toEqual([]);
		expect(() => setNotePinned(db, 999, true, admin)).toThrow(NoteNotFoundError);
	});

	it("archives (off the dashboard too), restores unpinned, deletes only archived notes", () => {
		const { db, desk, admin } = setup();
		const id = createNote(db, yellow("avviso", true), admin, at(1));
		const other = createNote(db, yellow("altra"), desk, at(2));
		expect(() => deleteNote(db, id, admin)).toThrow(NoteNotFoundError);

		expect(archiveNotes(db, [id], admin, at(5))).toBe(1);
		expect(archiveNotes(db, [id], admin, at(6))).toBe(0);
		expect(pinnedNotes(db)).toEqual([]);
		expect(listOpenNotes(db).map((n) => n.id)).toEqual([other]);
		const archived = listArchivedNotes(db);
		expect(archived.total).toBe(1);
		expect(archived.rows[0]).toMatchObject({
			id,
			pinned: false,
			archivedAt: at(5).toISOString(),
			archivedBy: "admin",
		});
		expect(() => setNotePinned(db, id, true, admin)).toThrow(NoteNotFoundError);

		restoreNote(db, id, admin);
		expect(listOpenNotes(db).find((n) => n.id === id)).toMatchObject({
			pinned: false,
			archivedAt: null,
			archivedBy: null,
		});
		expect(() => restoreNote(db, id, admin)).toThrow(NoteNotFoundError);

		archiveNotes(db, [id], admin);
		deleteNote(db, id, admin);
		expect(db.select().from(note).where(eq(note.id, id)).all()).toEqual([]);
		expect(archiveNotes(db, [], admin)).toBe(0);
	});

	it("pages the archive, the most recently archived first", () => {
		const { db, admin } = setup();
		const ids = [1, 2, 3].map((m) => createNote(db, yellow(`n${String(m)}`), admin, at(m)));
		ids.forEach((id, i) => archiveNotes(db, [id], admin, at(10 + i)));
		expect(listArchivedNotes(db, { limit: 2 }).rows.map((n) => n.body)).toEqual(["n3", "n2"]);
		expect(listArchivedNotes(db, { offset: 2, limit: 2 })).toMatchObject({
			total: 3,
			rows: [{ body: "n1" }],
		});
	});

	it("audits ids, never the text", () => {
		const { db, desk, admin } = setup();
		const id = createNote(db, yellow("Mario ha rotto lo scanner"), desk);
		setNotePinned(db, id, true, admin);
		setNotePinned(db, id, false, admin);
		archiveNotes(db, [id], admin);
		restoreNote(db, id, admin);
		archiveNotes(db, [id], admin);
		deleteNote(db, id, admin);
		const rows = db.select().from(auditLog).all();
		expect(rows.map((r) => r.action)).toEqual([
			"note.create",
			"note.pin",
			"note.unpin",
			"note.archive",
			"note.restore",
			"note.archive",
			"note.delete",
		]);
		expect(JSON.stringify(rows)).not.toContain("Mario");
		expect(rows.every((r) => r.entityId === String(id))).toBe(true);
	});

	it("never stores an archived note as pinned", () => {
		const { db, admin } = setup();
		expect(() =>
			db
				.insert(note)
				.values({
					body: "x",
					pinned: 1,
					archivedAt: at(1).toISOString(),
					createdBy: admin.id,
				})
				.run(),
		).toThrow(/Failed query/);
	});
});
