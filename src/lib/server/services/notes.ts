// SPDX-License-Identifier: GPL-3.0-or-later
// The staff notes, "Segnalazioni" (PLAN.md step 9.18, Q113, ADR-029): post-its any account leaves
// for the others and for the administrator. A note is written once and never edited; only the
// administrator pins it to the dashboard, archives, restores and deletes it (the remote functions
// check the permission). Audit rows carry the note's id, never its text.
import { NotFoundError, ServiceError } from "#lib/server/errors.js";
import { and, count, desc, eq, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { DbOrTx } from "#lib/server/db/client.js";
import { note, staffUser } from "#lib/server/db/schema.js";
import { isNoteColor, NOTE_MAX_LENGTH, type NoteColor } from "#lib/shared/notes.js";
import { demoText } from "#lib/server/demo/content.js";
import { audit, type AuditActor } from "./audit.js";

export interface NoteInput {
	body: string;
	color: string;
	pinned: boolean;
}

export interface NoteRow {
	id: number;
	body: string;
	color: NoteColor;
	pinned: boolean;
	/** The account that wrote it (display name, or username). */
	author: string | null;
	createdAt: string;
	archivedAt: string | null;
	archivedBy: string | null;
}

export class NoteValidationError extends ServiceError {
	constructor(override readonly code: "empty" | "tooLong" | "color") {
		super(code, `note: ${code}`);
		this.name = "NoteValidationError";
	}
}

export class NoteNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("note", `note ${String(id)} not found`);
		this.name = "NoteNotFoundError";
	}
}

/** Archived notes are listed this many at a time. */
export const ARCHIVE_PAGE = 48;

/** Trims the text (line breaks kept, trailing spaces of each line dropped), checks length and colour. */
export function validateNote(input: NoteInput): {
	body: string;
	color: NoteColor;
	pinned: boolean;
} {
	const body = input.body
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	if (body === "") {
		throw new NoteValidationError("empty");
	}
	if (body.length > NOTE_MAX_LENGTH) {
		throw new NoteValidationError("tooLong");
	}
	if (!isNoteColor(input.color)) {
		throw new NoteValidationError("color");
	}
	return { body, color: input.color, pinned: input.pinned };
}

const author = alias(staffUser, "author");
const archiver = alias(staffUser, "archiver");

/** The notes matching `where` in the given order, with the names of their accounts. */
function selectNotes(
	db: DbOrTx,
	where: SQL | undefined,
	order: SQL[],
	page: { limit?: number; offset?: number } = {},
): NoteRow[] {
	const query = db
		.select({
			id: note.id,
			body: note.body,
			color: note.color,
			pinned: note.pinned,
			authorName: author.displayName,
			authorUser: author.username,
			createdAt: note.createdAt,
			archivedAt: note.archivedAt,
			archiverName: archiver.displayName,
			archiverUser: archiver.username,
		})
		.from(note)
		.leftJoin(author, eq(author.id, note.createdBy))
		.leftJoin(archiver, eq(archiver.id, note.archivedBy))
		.where(where)
		.orderBy(...order)
		.limit(page.limit ?? -1)
		.offset(page.offset ?? 0);
	return query.all().map((r) => ({
		id: r.id,
		body: r.body,
		color: isNoteColor(r.color) ? r.color : "yellow",
		pinned: r.pinned === 1,
		author: r.authorName ?? r.authorUser,
		createdAt: r.createdAt,
		archivedAt: r.archivedAt,
		archivedBy: r.archivedAt ? (r.archiverName ?? r.archiverUser) : null,
	}));
}

/** The open notes: the pinned ones first, then the newest. */
export function listOpenNotes(db: DbOrTx): NoteRow[] {
	return selectNotes(db, isNull(note.archivedAt), [
		desc(note.pinned),
		desc(note.createdAt),
		desc(note.id),
	]);
}

/** The archived notes, the most recently archived first, a page at a time. */
export function listArchivedNotes(
	db: DbOrTx,
	options: { offset?: number; limit?: number } = {},
): { rows: NoteRow[]; total: number } {
	const rows = selectNotes(
		db,
		isNotNull(note.archivedAt),
		[desc(note.archivedAt), desc(note.id)],
		{ limit: options.limit ?? ARCHIVE_PAGE, offset: options.offset ?? 0 },
	);
	const total = db.select({ n: count() }).from(note).where(isNotNull(note.archivedAt)).get();
	return { rows, total: total?.n ?? 0 };
}

/** The pinned notes, for the top of the dashboard and of the desk. */
export function pinnedNotes(db: DbOrTx): NoteRow[] {
	return selectNotes(db, and(isNull(note.archivedAt), eq(note.pinned, 1)), [
		desc(note.createdAt),
		desc(note.id),
	]);
}

export function countOpenNotes(db: DbOrTx): number {
	return db.select({ n: count() }).from(note).where(isNull(note.archivedAt)).get()?.n ?? 0;
}

/** Writes a note; whether the account may pin it is checked by the caller. */
export function createNote(
	db: DbOrTx,
	input: NoteInput,
	actor: AuditActor,
	now = new Date(),
): number {
	const data = validateNote(input);
	const id = db
		.insert(note)
		.values({
			// the public demo stores its own text, colour and pin as chosen (Q121)
			body: demoText("note", data.body, null, now),
			color: data.color,
			pinned: data.pinned ? 1 : 0,
			createdBy: actor.id,
			createdAt: now.toISOString(),
		})
		.returning({ id: note.id })
		.get().id;
	audit(db, actor, "note.create", "note", id, data.pinned ? { pinned: true } : undefined, now);
	return id;
}

/** Puts an open note at the top of the dashboard, or takes it off. */
export function setNotePinned(
	db: DbOrTx,
	id: number,
	pinned: boolean,
	actor: AuditActor,
	now = new Date(),
): void {
	const changed = db
		.update(note)
		.set({ pinned: pinned ? 1 : 0 })
		.where(and(eq(note.id, id), isNull(note.archivedAt)))
		.run().changes;
	if (changed === 0) {
		throw new NoteNotFoundError(id);
	}
	audit(db, actor, pinned ? "note.pin" : "note.unpin", "note", id, undefined, now);
}

/** Archives open notes (they leave the dashboard too); returns how many. */
export function archiveNotes(
	db: DbOrTx,
	ids: readonly number[],
	actor: AuditActor,
	now = new Date(),
): number {
	if (ids.length === 0) {
		return 0;
	}
	const changed = db
		.update(note)
		.set({ archivedAt: now.toISOString(), archivedBy: actor.id, pinned: 0 })
		.where(and(inArray(note.id, [...ids]), isNull(note.archivedAt)))
		.run().changes;
	const one = ids.length === 1 ? (ids[0] ?? null) : null;
	audit(db, actor, "note.archive", "note", one, { count: changed }, now);
	return changed;
}

/** Puts an archived note back among the open ones, not pinned. */
export function restoreNote(db: DbOrTx, id: number, actor: AuditActor, now = new Date()): void {
	const changed = db
		.update(note)
		.set({ archivedAt: null, archivedBy: null })
		.where(and(eq(note.id, id), isNotNull(note.archivedAt)))
		.run().changes;
	if (changed === 0) {
		throw new NoteNotFoundError(id);
	}
	audit(db, actor, "note.restore", "note", id, undefined, now);
}

/** Deletes an archived note for good (an open one must be archived first). */
export function deleteNote(db: DbOrTx, id: number, actor: AuditActor, now = new Date()): void {
	const changed = db
		.delete(note)
		.where(and(eq(note.id, id), isNotNull(note.archivedAt)))
		.run().changes;
	if (changed === 0) {
		throw new NoteNotFoundError(id);
	}
	audit(db, actor, "note.delete", "note", id, undefined, now);
}
