// SPDX-License-Identifier: GPL-3.0-or-later
// Print lists (PLAN.md §3.12, step 2.8): named, ordered baskets of patrons (kind `patrons`) or
// copies (kind `items`, step 3.8) that feed the print routes through `list=<id>`. One generic
// engine: create/rename/delete, add/remove/reorder entries (an entity appears once per
// list), `markPrinted`. The quick filters and rows of each kind are in `print-list-patrons.ts` and
// `print-list-items.ts`. Plain functions `(db, input, actor)`.
import { NotFoundError } from "#lib/server/errors.js";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { printList, printListEntry, type PRINT_LIST_KINDS } from "#lib/server/db/schema.js";
import { demoText } from "#lib/server/demo/content.js";
import { audit, type AuditActor } from "./audit.js";
import { deleteSheetsOfList } from "./class-sheet-erasure.js";
import { markCardsPrinted } from "./cards.js";
import { markLabelsPrinted } from "./label-items.js";
import type { LabelKind } from "./label-templates.js";

export type PrintListKind = (typeof PRINT_LIST_KINDS)[number];

export class PrintListNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("print list", `print list ${id} not found`);
		this.name = "PrintListNotFoundError";
	}
}

/** A list of patrons asked for copies, or the other way round. */
export class PrintListKindError extends Error {
	constructor(
		readonly id: number,
		readonly kind: string,
		readonly expected: PrintListKind,
	) {
		super(`print list ${id} holds ${kind}, not ${expected}`);
		this.name = "PrintListKindError";
	}
}

export class PrintListNameError extends Error {
	constructor() {
		super("a print list needs a name");
		this.name = "PrintListNameError";
	}
}

export interface PrintListSummary {
	id: number;
	kind: PrintListKind;
	name: string;
	count: number;
	lastPrintedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

const countSql = sql<number>`(select count(*) from print_list_entry e where e.list_id = print_list.id)`;

function cleanName(name: string): string {
	const clean = name.trim().slice(0, 80);
	if (clean === "") {
		throw new PrintListNameError();
	}
	return clean;
}

function requireList(
	db: DbOrTx,
	id: number,
	kind?: PrintListKind,
): {
	createdAt: string;
	updatedAt: string;
	id: number;
	kind: string;
	name: string;
	createdBy: number | null;
	lastPrintedAt: string | null;
} {
	const row = db.select().from(printList).where(eq(printList.id, id)).get();
	if (!row) {
		throw new PrintListNotFoundError(id);
	}
	if (kind && row.kind !== kind) {
		throw new PrintListKindError(id, row.kind, kind);
	}
	return row;
}

/** A list that exists (and holds `kind`): `PrintListNotFoundError`, `PrintListKindError` otherwise. */
export function assertPrintList(db: DbOrTx, id: number, kind?: PrintListKind): void {
	requireList(db, id, kind);
}

function touch(db: DbOrTx, id: number, now: Date): void {
	db.update(printList).set({ updatedAt: now.toISOString() }).where(eq(printList.id, id)).run();
}

export function listPrintLists(db: DbOrTx, kind?: PrintListKind): PrintListSummary[] {
	return db
		.select({
			id: printList.id,
			kind: printList.kind,
			name: printList.name,
			count: countSql,
			lastPrintedAt: printList.lastPrintedAt,
			createdAt: printList.createdAt,
			updatedAt: printList.updatedAt,
		})
		.from(printList)
		.where(kind ? eq(printList.kind, kind) : undefined)
		.orderBy(desc(printList.updatedAt), desc(printList.id))
		.all()
		.map((r) => ({ ...r, kind: r.kind as PrintListKind }));
}

export function getPrintList(db: DbOrTx, id: number): PrintListSummary {
	const row = listPrintLists(db).find((l) => l.id === id);
	if (!row) {
		throw new PrintListNotFoundError(id);
	}
	return row;
}

/** A list still to print: it has entries and was never marked as printed (the basket counts these). */
export function isToPrint(list: PrintListSummary): boolean {
	return list.count > 0 && list.lastPrintedAt === null;
}

export function createPrintList(
	db: Db,
	kind: PrintListKind,
	name: string,
	actor: AuditActor,
	now = new Date(),
): number {
	// the public demo stores its example name (Q121)
	const clean = cleanName(demoText("printList", name, null, now));
	return db.transaction((tx) => {
		const row = tx
			.insert(printList)
			.values({
				kind,
				name: clean,
				createdBy: actor.id,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
			})
			.returning({ id: printList.id })
			.get();
		audit(tx, actor, "print_list.create", "print_list", row.id, { kind }, now);
		return row.id;
	});
}

export function renamePrintList(
	db: Db,
	id: number,
	name: string,
	actor: AuditActor,
	now = new Date(),
): void {
	db.transaction((tx) => {
		const stored = requireList(tx, id);
		const clean = cleanName(demoText("printList", name, stored.name, now));
		tx.update(printList)
			.set({ name: clean, updatedAt: now.toISOString() })
			.where(eq(printList.id, id))
			.run();
		audit(tx, actor, "print_list.rename", "print_list", id, undefined, now);
	});
}

/** Deletes a list; the class pictures of a patron list (Phase 13) go with it, files included. */
export function deletePrintList(
	db: Db,
	id: number,
	actor: AuditActor,
	now = new Date(),
	dataDir?: string,
): void {
	db.transaction((tx) => {
		requireList(tx, id);
		if (dataDir !== undefined) {
			deleteSheetsOfList(tx, dataDir, id);
		}
		tx.delete(printListEntry).where(eq(printListEntry.listId, id)).run();
		tx.delete(printList).where(eq(printList.id, id)).run();
		audit(tx, actor, "print_list.delete", "print_list", id, undefined, now);
	});
}

export interface PrintListEntryRow {
	entityId: number;
	position: number;
	addedAt: string;
}

export function orderedEntries(db: DbOrTx, listId: number): PrintListEntryRow[] {
	return db
		.select({
			entityId: printListEntry.entityId,
			position: printListEntry.position,
			addedAt: printListEntry.addedAt,
		})
		.from(printListEntry)
		.where(eq(printListEntry.listId, listId))
		.orderBy(asc(printListEntry.position), asc(printListEntry.entityId))
		.all();
}

/**
 * Entity ids in list order (what the print routes render for `list=<id>`); with `kind`, a list of
 * the other kind is refused (`PrintListKindError`).
 */
export function entityIdsOf(db: DbOrTx, listId: number, kind?: PrintListKind): number[] {
	requireList(db, listId, kind);
	return orderedEntries(db, listId).map((e) => e.entityId);
}

export interface AddResult {
	added: number;
	/** Entities that were already in the list (ignored, reported so the UI can say so). */
	skipped: number[];
}

/** Appends entities to the end of the list; an entity appears once per list. */
export function addEntries(
	db: Db,
	listId: number,
	entityIds: readonly number[],
	actor: AuditActor,
	now = new Date(),
): AddResult {
	return db.transaction((tx) => {
		requireList(tx, listId);
		const existing = new Set(orderedEntries(tx, listId).map((e) => e.entityId));
		let position =
			tx
				.select({ max: sql<number | null>`max(${printListEntry.position})` })
				.from(printListEntry)
				.where(eq(printListEntry.listId, listId))
				.get()?.max ?? 0;
		const skipped: number[] = [];
		const fresh: number[] = [];
		for (const id of entityIds) {
			if (existing.has(id) || fresh.includes(id)) {
				if (!skipped.includes(id)) {
					skipped.push(id);
				}
				continue;
			}
			fresh.push(id);
		}
		if (fresh.length > 0) {
			tx.insert(printListEntry)
				.values(
					fresh.map((entityId) => ({
						listId,
						entityId,
						position: ++position,
						addedAt: now.toISOString(),
					})),
				)
				.run();
			touch(tx, listId, now);
		}
		audit(
			tx,
			actor,
			"print_list.add",
			"print_list",
			listId,
			{ added: fresh.length, skipped: skipped.length },
			now,
		);
		return { added: fresh.length, skipped };
	});
}

export function removeEntries(
	db: Db,
	listId: number,
	entityIds: readonly number[],
	actor: AuditActor,
	now = new Date(),
): number {
	if (entityIds.length === 0) {
		return 0;
	}
	return db.transaction((tx) => {
		requireList(tx, listId);
		const removed = tx
			.delete(printListEntry)
			.where(
				and(
					eq(printListEntry.listId, listId),
					inArray(printListEntry.entityId, [...entityIds]),
				),
			)
			.run().changes;
		if (removed > 0) {
			renumber(tx, listId);
			touch(tx, listId, now);
		}
		audit(tx, actor, "print_list.remove", "print_list", listId, { removed }, now);
		return removed;
	});
}

export function clearPrintList(
	db: Db,
	listId: number,
	actor: AuditActor,
	now = new Date(),
): number {
	return db.transaction((tx) => {
		requireList(tx, listId);
		const removed = tx
			.delete(printListEntry)
			.where(eq(printListEntry.listId, listId))
			.run().changes;
		touch(tx, listId, now);
		audit(tx, actor, "print_list.clear", "print_list", listId, { removed }, now);
		return removed;
	});
}

/** Writes positions 1…n following the current order (after removals). */
function renumber(tx: DbOrTx, listId: number): void {
	orderedEntries(tx, listId).forEach((e, i) => {
		if (e.position !== i + 1) {
			tx.update(printListEntry)
				.set({ position: i + 1 })
				.where(
					and(eq(printListEntry.listId, listId), eq(printListEntry.entityId, e.entityId)),
				)
				.run();
		}
	});
}

/**
 * Applies a new order: the given ids come first in that order, entities not mentioned keep their
 * relative order after them; unknown ids are ignored.
 */
export function reorderEntries(
	db: Db,
	listId: number,
	orderedIds: readonly number[],
	actor: AuditActor,
	now = new Date(),
): number[] {
	return db.transaction((tx) => {
		requireList(tx, listId);
		const current = orderedEntries(tx, listId).map((e) => e.entityId);
		const known = new Set(current);
		const head = orderedIds.filter((id, i) => known.has(id) && orderedIds.indexOf(id) === i);
		const tail = current.filter((id) => !head.includes(id));
		const next = [...head, ...tail];
		next.forEach((entityId, i) => {
			tx.update(printListEntry)
				.set({ position: i + 1 })
				.where(
					and(eq(printListEntry.listId, listId), eq(printListEntry.entityId, entityId)),
				)
				.run();
		});
		touch(tx, listId, now);
		audit(tx, actor, "print_list.reorder", "print_list", listId, undefined, now);
		return next;
	});
}

/** Moves one entity up or down by one place (keyboard-friendly reorder). */
export function moveEntry(
	db: Db,
	listId: number,
	entityId: number,
	direction: "up" | "down",
	actor: AuditActor,
	now = new Date(),
): number[] {
	const current = entityIdsOf(db, listId);
	const index = current.indexOf(entityId);
	if (index === -1) {
		return current;
	}
	const target = direction === "up" ? index - 1 : index + 1;
	if (target < 0 || target >= current.length) {
		return current;
	}
	const next = [...current];
	const moved = next.splice(index, 1);
	next.splice(target, 0, ...moved);
	return reorderEntries(db, listId, next, actor, now);
}

export interface MarkPrintedResult {
	/** Entities marked (patron lists: `card_printed_at` set; item lists: the label flags of `labelKind`). */
	marked: number;
	cleared: boolean;
}

/**
 * "Segna come stampate": stamps the list and, for patron lists, every patron's
 * `card_printed_at` (item lists: the printed flags of `labelKind`, pairs set both);
 * optionally empties the list afterwards.
 */
export function markPrinted(
	db: Db,
	listId: number,
	actor: AuditActor,
	options: { clear?: boolean; now?: Date; labelKind?: LabelKind } = {},
): MarkPrintedResult {
	const now = options.now ?? new Date();
	return db.transaction((tx) => {
		const list = requireList(tx, listId);
		const ids = orderedEntries(tx, listId).map((e) => e.entityId);
		const marked =
			list.kind === "patrons"
				? markCardsPrinted(tx, ids, now)
				: markLabelsPrinted(tx, options.labelKind ?? "pair", ids, now);
		tx.update(printList)
			.set({ lastPrintedAt: now.toISOString(), updatedAt: now.toISOString() })
			.where(eq(printList.id, listId))
			.run();
		if (options.clear) {
			tx.delete(printListEntry).where(eq(printListEntry.listId, listId)).run();
		}
		audit(
			tx,
			actor,
			"print_list.mark_printed",
			"print_list",
			listId,
			{
				count: ids.length,
				marked,
				cleared: Boolean(options.clear),
				labelKind: list.kind === "items" ? (options.labelKind ?? "pair") : undefined,
			},
			now,
		);
		return { marked, cleared: Boolean(options.clear) };
	});
}
