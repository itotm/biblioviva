// SPDX-License-Identifier: GPL-3.0-or-later
// Stocktaking campaigns (PLAN.md step 9.8): every copy on the shelves is scanned, over several
// days and from several devices; nothing is marked lost while scanning. A scan is recorded once per
// copy and campaign (scanning again says so); a copy marked lost that turns up is available again
// ("found"); a copy on loan is recorded but never missing; with a shelf context (`B 4`, `590`) a
// copy whose call number belongs elsewhere is flagged as misplaced. Closing the campaign marks the
// copies never seen as lost, in one transaction, and keeps a summary; a campaign closed in the last
// seven days can be reopened, which puts those copies back as they were.
import { collatorFor } from "#lib/shared/collation.js";
import { ServiceError } from "#lib/server/errors.js";
import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, inventory, inventoryScan, item, loan } from "#lib/server/db/schema.js";
import { splitCallNumber } from "#lib/shared/classification.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { recogniseScan } from "#lib/shared/scan.js";
import { demoChoice, demoText } from "#lib/server/demo/content.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import { audit, type AuditActor } from "./audit.js";

export const REOPEN_DAYS = 7;
/** The statuses of a copy expected on the shelves (lost and withdrawn ones are not). */
const EXPECTED_STATUSES = ["available", "damaged", "in_repair"] as const;

/** The longest notes of a campaign. */
export const INVENTORY_NOTES_MAX = 500;

export class InventoryError extends ServiceError {
	constructor(
		override readonly code:
			"alreadyOpen" | "notOpen" | "notFound" | "tooLate" | "badName" | "badNotes",
		readonly detail = "",
	) {
		super(code, `inventory: ${code}${detail ? ` (${detail})` : ""}`);
		this.name = "InventoryError";
	}
}

export interface InventoryRow {
	id: number;
	name: string;
	status: "open" | "closed";
	startedAt: string;
	closedAt: string | null;
	notes: string | null;
	summary: InventorySummary | null;
}

export interface InventorySummary {
	expected: number;
	seen: number;
	/** Copies marked lost at the close. */
	lost: number;
	found: number;
	onLoan: number;
	misplaced: number;
	/** The copies the close marked lost with the status each had (for a reopen). */
	lostItems: { id: number; from: string }[];
}

function row(r: typeof inventory.$inferSelect): InventoryRow {
	return {
		id: r.id,
		name: r.name,
		status: r.status as InventoryRow["status"],
		startedAt: r.startedAt,
		closedAt: r.closedAt,
		notes: r.notes,
		summary: (r.summary as InventorySummary | null) ?? null,
	};
}

/** The campaign in progress, if any. */
export function currentInventory(db: DbOrTx): InventoryRow | null {
	const r = db.select().from(inventory).where(eq(inventory.status, "open")).get();
	return r ? row(r) : null;
}

/** Every campaign, newest first. */
export function listInventories(db: DbOrTx): InventoryRow[] {
	return db
		.select()
		.from(inventory)
		.orderBy(sql`${inventory.startedAt} DESC`)
		.all()
		.map(row);
}

/** A campaign closed at `closedAt` can be reopened for `REOPEN_DAYS` days. */
function withinReopenWindow(closedAt: string, now: Date): boolean {
	return now.getTime() - new Date(closedAt).getTime() <= REOPEN_DAYS * 86_400_000;
}

/**
 * The closed campaigns, newest first, each with whether it can be reopened now: none is in
 * progress and it was closed in the last `REOPEN_DAYS` days.
 */
export function closedInventories(
	db: DbOrTx,
	now = new Date(),
): (InventoryRow & { canReopen: boolean })[] {
	const nothingOpen = currentInventory(db) === null;
	return listInventories(db)
		.filter((c) => c.status === "closed")
		.map((c) => ({
			...c,
			canReopen: nothingOpen && c.closedAt !== null && withinReopenWindow(c.closedAt, now),
		}));
}

export function openInventory(
	db: Db,
	input: { name: string; notes?: string },
	actor: AuditActor,
	now = new Date(),
): InventoryRow {
	const sentName = input.name.trim();
	if (!sentName || sentName.length > 120) {
		throw new InventoryError("badName");
	}
	// the public demo stores its example name and notes (Q121)
	const name = demoText("inventory", sentName, null, now);
	const notes = demoText("comment", input.notes?.trim() ?? "", null, now);
	if (notes.length > INVENTORY_NOTES_MAX) {
		throw new InventoryError("badNotes");
	}
	return db.transaction((tx) => {
		if (currentInventory(tx)) {
			throw new InventoryError("alreadyOpen");
		}
		const created = tx
			.insert(inventory)
			.values({
				name,
				notes: notes || null,
				startedAt: now.toISOString(),
				startedBy: actor.id,
			})
			.returning()
			.get();
		audit(tx, actor, "inventory.open", "inventory", created.id, { name }, now);
		return row(created);
	});
}

export type ScanOutcome =
	| { kind: "unknown"; code: string }
	| {
			kind: "seen" | "again" | "misplaced" | "found" | "onLoan" | "withdrawn";
			itemId: number;
			barcode: string;
			title: string;
			callNumber: string;
			/** `again`: when the copy was scanned the first time. */
			firstAt?: string;
	  };

const words = (s: string): string[] => s.trim().toLowerCase().split(/\s+/).filter(Boolean);

/** The shelf being worked on covers the head of the call number: `B` covers `B 4`, `B 4` covers `B 4`. */
export function onShelf(head: string, context: string): boolean {
	const h = words(head);
	return words(context).every((w, i) => h[i] === w);
}

/** Records one scan of the open campaign. */
export function recordScan(
	db: Db,
	inventoryId: number,
	raw: string,
	shelf: string | null,
	codes: CodeTable,
	actor: AuditActor,
	now = new Date(),
): ScanOutcome {
	const { code, result: r } = recogniseScan(raw, codes);
	const value = r.kind === "invalid" ? code : r.value;
	return db.transaction((tx): ScanOutcome => {
		const campaign = tx.select().from(inventory).where(eq(inventory.id, inventoryId)).get();
		if (campaign?.status !== "open") {
			throw new InventoryError("notOpen");
		}
		const copy = tx
			.select({ i: item, title: biblio.title })
			.from(item)
			.innerJoin(biblio, eq(biblio.id, item.biblioId))
			.where(eq(item.barcode, value))
			.get();
		if (!copy) {
			return { kind: "unknown", code: value };
		}
		const base = {
			itemId: copy.i.id,
			barcode: copy.i.barcode,
			title: copy.title,
			callNumber: copy.i.callNumber ?? "",
		};
		const earlier = tx
			.select({ at: inventoryScan.scannedAt })
			.from(inventoryScan)
			.where(
				and(
					eq(inventoryScan.inventoryId, inventoryId),
					eq(inventoryScan.itemId, copy.i.id),
				),
			)
			.get();
		if (earlier) {
			return { kind: "again", ...base, firstAt: earlier.at };
		}
		// the public demo keeps only a shelf of the catalogue (Q121)
		const context = demoChoice(
			shelf?.trim() || null,
			isDemoPublic() ? [...shelfHeads(tx)] : [],
		);
		const head = splitCallNumber(copy.i.callNumber ?? "").head;
		const misplaced = context !== null && !onShelf(head, context);
		tx.insert(inventoryScan)
			.values({
				inventoryId,
				itemId: copy.i.id,
				scannedAt: now.toISOString(),
				scannedBy: actor.id,
				shelf: context,
				misplaced: misplaced ? 1 : 0,
				found: copy.i.status === "lost" ? 1 : 0,
			})
			.run();
		if (copy.i.status === "lost") {
			tx.update(item)
				.set({ status: "available", updatedAt: now.toISOString() })
				.where(eq(item.id, copy.i.id))
				.run();
			audit(
				tx,
				actor,
				"item.status",
				"item",
				copy.i.id,
				{
					from: "lost",
					to: "available",
					reason: `inventario ${campaign.name}`,
					found: true,
				},
				now,
			);
			return { kind: "found", ...base };
		}
		if (copy.i.status === "withdrawn") {
			return { kind: "withdrawn", ...base };
		}
		const onLoan = tx
			.select({ id: loan.id })
			.from(loan)
			.where(and(eq(loan.itemId, copy.i.id), isNull(loan.returnedAt)))
			.get();
		if (onLoan) {
			return { kind: "onLoan", ...base };
		}
		return { kind: misplaced ? "misplaced" : "seen", ...base };
	});
}

/** The copies expected on the shelves: not lost or withdrawn, not on loan, not kept apart. */
function expectedItems(db: DbOrTx): { id: number; callNumber: string; itemType: string }[] {
	return db
		.select({ id: item.id, callNumber: item.callNumber, itemType: item.itemType })
		.from(item)
		.where(
			and(
				inArray(item.status, [...EXPECTED_STATUSES]),
				eq(item.notForLoan, 0),
				sql`NOT EXISTS (SELECT 1 FROM ${loan} WHERE ${loan.itemId} = ${item.id} AND ${loan.returnedAt} IS NULL)`,
			),
		)
		.all()
		.map((r) => ({ id: r.id, callNumber: r.callNumber ?? "", itemType: r.itemType }));
}

function scansOf(
	db: DbOrTx,
	inventoryId: number,
): Map<number, { misplaced: boolean; found: boolean }> {
	return new Map(
		db
			.select({
				itemId: inventoryScan.itemId,
				misplaced: inventoryScan.misplaced,
				found: inventoryScan.found,
			})
			.from(inventoryScan)
			.where(eq(inventoryScan.inventoryId, inventoryId))
			.all()
			.map((s) => [s.itemId, { misplaced: s.misplaced === 1, found: s.found === 1 }]),
	);
}

export interface ShelfProgress {
	/** The classification head of the call number (`B 4`, `590`), empty when there is none. */
	shelf: string;
	expected: number;
	seen: number;
}

/** The counts of a campaign, for its summary and the dashboard. */
export interface InventoryCounts {
	expected: number;
	seen: number;
	/** Copies scanned in all (on loan, found and misplaced ones included). */
	scanned: number;
	misplaced: number;
	found: number;
}

export interface InventoryProgress extends InventoryCounts {
	shelves: ShelfProgress[];
}

function tally(
	db: DbOrTx,
	inventoryId: number,
): { counts: InventoryCounts; shelves: ShelfProgress[] } {
	const scans = scansOf(db, inventoryId);
	const byShelf = new Map<string, ShelfProgress>();
	let seen = 0;
	const expected = expectedItems(db);
	for (const e of expected) {
		const shelf = splitCallNumber(e.callNumber).head;
		const p = byShelf.get(shelf) ?? { shelf, expected: 0, seen: 0 };
		p.expected++;
		if (scans.has(e.id)) {
			p.seen++;
			seen++;
		}
		byShelf.set(shelf, p);
	}
	return {
		counts: {
			expected: expected.length,
			seen,
			scanned: scans.size,
			misplaced: [...scans.values()].filter((s) => s.misplaced).length,
			found: [...scans.values()].filter((s) => s.found).length,
		},
		shelves: [...byShelf.values()],
	};
}

export function inventoryCounts(db: DbOrTx, inventoryId: number): InventoryCounts {
	return tally(db, inventoryId).counts;
}

/** The counts and each shelf, the shelves in the installation's language (`locale`). */
export function inventoryProgress(
	db: DbOrTx,
	inventoryId: number,
	locale: string,
): InventoryProgress {
	const { counts, shelves } = tally(db, inventoryId);
	const order = collatorFor(locale);
	return { ...counts, shelves: shelves.sort((a, b) => order.compare(a.shelf, b.shelf)) };
}

export interface MissingItem {
	itemId: number;
	biblioId: number;
	barcode: string;
	title: string;
	author: string;
	callNumber: string;
	shelf: string;
	itemType: string;
	status: string;
}

/** The expected copies not scanned yet, by call number; filtered by shelf and item type. */
export function missingItems(
	db: DbOrTx,
	inventoryId: number,
	filters: { shelf?: string | null; itemType?: string | null } = {},
): MissingItem[] {
	const scanned = [...scansOf(db, inventoryId).keys()];
	const expected = new Set(expectedItems(db).map((e) => e.id));
	const rows = db
		.select({
			itemId: item.id,
			biblioId: biblio.id,
			barcode: item.barcode,
			title: biblio.title,
			author: biblio.author,
			callNumber: item.callNumber,
			itemType: item.itemType,
			status: item.status,
		})
		.from(item)
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(scanned.length > 0 ? notInArray(item.id, scanned) : undefined)
		.orderBy(asc(item.callNumber), asc(item.barcode))
		.all();
	return rows
		.filter((r) => expected.has(r.itemId))
		.map((r) => ({
			...r,
			callNumber: r.callNumber ?? "",
			shelf: splitCallNumber(r.callNumber ?? "").head,
		}))
		.filter(
			(r) =>
				(filters.shelf === undefined ||
					filters.shelf === null ||
					r.shelf === filters.shelf) &&
				(!filters.itemType || r.itemType === filters.itemType),
		);
}

/**
 * Closes the open campaign: every copy still missing is marked lost (reason "inventario <name>"),
 * in one transaction with the summary.
 */
export function closeInventory(
	db: Db,
	inventoryId: number,
	actor: AuditActor,
	now = new Date(),
): InventorySummary {
	return db.transaction((tx) => {
		const campaign = tx.select().from(inventory).where(eq(inventory.id, inventoryId)).get();
		if (campaign?.status !== "open") {
			throw new InventoryError("notOpen");
		}
		const progress = inventoryCounts(tx, inventoryId);
		const missing = missingItems(tx, inventoryId);
		const stamp = now.toISOString();
		for (const m of missing) {
			tx.update(item)
				.set({ status: "lost", updatedAt: stamp })
				.where(eq(item.id, m.itemId))
				.run();
		}
		if (missing.length > 0) {
			audit(
				tx,
				actor,
				"item.status",
				"inventory",
				inventoryId,
				{ to: "lost", reason: `inventario ${campaign.name}`, items: missing.length },
				now,
			);
		}
		const onLoan =
			tx
				.select({ n: sql<number>`count(*)` })
				.from(loan)
				.where(isNull(loan.returnedAt))
				.get()?.n ?? 0;
		const summary: InventorySummary = {
			expected: progress.expected,
			seen: progress.seen,
			lost: missing.length,
			found: progress.found,
			onLoan,
			misplaced: progress.misplaced,
			lostItems: missing.map((m) => ({ id: m.itemId, from: m.status })),
		};
		tx.update(inventory)
			.set({ status: "closed", closedAt: stamp, closedBy: actor.id, summary: { ...summary } })
			.where(eq(inventory.id, inventoryId))
			.run();
		audit(
			tx,
			actor,
			"inventory.close",
			"inventory",
			inventoryId,
			{ expected: summary.expected, seen: summary.seen, lost: summary.lost },
			now,
		);
		return summary;
	});
}

/** Reopens a campaign closed in the last seven days; the copies its close marked lost come back. */
export function reopenInventory(
	db: Db,
	inventoryId: number,
	actor: AuditActor,
	now = new Date(),
): InventoryRow {
	return db.transaction((tx) => {
		const campaign = tx.select().from(inventory).where(eq(inventory.id, inventoryId)).get();
		if (!campaign) {
			throw new InventoryError("notFound");
		}
		if (campaign.status !== "closed" || !campaign.closedAt) {
			throw new InventoryError("notOpen");
		}
		if (!withinReopenWindow(campaign.closedAt, now)) {
			throw new InventoryError("tooLate");
		}
		if (currentInventory(tx)) {
			throw new InventoryError("alreadyOpen");
		}
		const summary = campaign.summary as InventorySummary | null;
		const stamp = now.toISOString();
		for (const l of summary?.lostItems ?? []) {
			tx.update(item)
				.set({ status: l.from, updatedAt: stamp })
				.where(and(eq(item.id, l.id), eq(item.status, "lost")))
				.run();
		}
		const reopened = tx
			.update(inventory)
			.set({ status: "open", closedAt: null, closedBy: null, summary: null })
			.where(eq(inventory.id, inventoryId))
			.returning()
			.get();
		if (!reopened) {
			throw new InventoryError("notFound");
		}
		audit(tx, actor, "inventory.reopen", "inventory", inventoryId, {}, now);
		return row(reopened);
	});
}

function shelfHeads(db: DbOrTx): Set<string> {
	return new Set(
		db
			.select({ c: item.callNumber })
			.from(item)
			.all()
			.map((r) => splitCallNumber(r.c ?? "").head)
			.filter(Boolean),
	);
}

/** The shelves (classification heads) of the collection, for the shelf context chip. */
export function shelvesOf(db: DbOrTx, locale: string): string[] {
	return [...shelfHeads(db)].sort(collatorFor(locale).compare);
}
