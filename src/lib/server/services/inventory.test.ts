// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { PATRON_RULES, classId } from "../../../../tests/helpers/school.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, item, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems, setItemStatus } from "./catalog-items.js";
import { checkoutItem } from "./circulation.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import {
	closeInventory,
	currentInventory,
	INVENTORY_NOTES_MAX,
	InventoryError,
	inventoryCounts,
	inventoryProgress,
	closedInventories,
	listInventories,
	missingItems,
	onShelf,
	openInventory,
	recordScan,
	reopenInventory,
	shelvesOf,
} from "./inventory.js";
import { createPatron } from "./patrons.js";
import { TEST_CODES } from "../../../../tests/helpers/codes.js";
const CODES = TEST_CODES;

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-inventory-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(dir, "ocean");
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

const DAY1 = new Date("2026-10-05T08:00:00Z");
const DAY2 = new Date("2026-10-06T08:00:00Z");

/** Two shelves: fiction B (3 copies) and non-fiction 590 (2 copies). */
function library(): { db: Db; actor: { id: number }; codes: string[]; ids: number[] } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
		.returning({ id: staffUser.id })
		.get();
	const rules = catalogRules(getConfig());
	const book = (
		title: string,
		kind: "fiction" | "nonfiction",
		copies: number,
	): { ids: number[]; barcodes: string[] } => {
		const id = createBiblio(
			db,
			{
				title,
				subtitle: "",
				originalTitle: "",
				responsibility: "",
				author: "Rossi, Anna",
				publisher: "Einaudi",
				publicationPlace: "",
				publicationYear: "",
				isbn: "",
				issn: "",
				ean: "",
				physicalDescription: "",
				series: "",
				seriesNumber: "",
				dewey: "",
				kind,
				genreCode: kind === "fiction" ? "B" : "",
				classCode: kind === "nonfiction" ? "590" : "",
				readingLevel: "",
				subjects: "",
				notes: "",
			},
			actor,
			rules,
		);
		return addItems(
			db,
			id,
			{
				callNumber: "",
				readingLevel: "",
				enumeration: "",
				acquisitionDate: "2020-01-01",
				notes: "",
				notForLoan: false,
			},
			copies,
			actor,
			rules,
			DAY1,
		);
	};
	const a = book("Romanzo", "fiction", 3);
	const b = book("Animali", "nonfiction", 2);
	return { db, actor, codes: [...a.barcodes, ...b.barcodes], ids: [...a.ids, ...b.ids] };
}

describe("inventory", () => {
	it("treats the shelf being worked on as a prefix of the call number head", () => {
		expect(onShelf("B 4", "B")).toBe(true);
		expect(onShelf("B 4", " b  4 ")).toBe(true);
		expect(onShelf("B 4", "B 3")).toBe(false);
		expect(onShelf("B", "B 4")).toBe(false);
		expect(onShelf("590", "59")).toBe(false);
	});

	it("opens one campaign at a time and records each copy once", () => {
		const { db, actor, codes } = library();
		// the notes have a cap, like every note
		expect(() =>
			openInventory(db, { name: "Lunga", notes: "x".repeat(INVENTORY_NOTES_MAX + 1) }, actor),
		).toThrow(expect.objectContaining({ code: "badNotes" }));
		const c = openInventory(db, { name: "Inventario 2026" }, actor, DAY1);
		expect(() => openInventory(db, { name: "Altro" }, actor, DAY1)).toThrow(InventoryError);
		expect(currentInventory(db)?.id).toBe(c.id);
		const [c0, c1] = codes as [string, string];
		expect(recordScan(db, c.id, c0, null, CODES, actor, DAY1)).toMatchObject({
			kind: "seen",
			title: "Romanzo",
		});
		expect(recordScan(db, c.id, c0, null, CODES, actor, DAY2)).toMatchObject({
			kind: "again",
			firstAt: DAY1.toISOString(),
		});
		// a scanner on an Italian layout types ' for -
		expect(recordScan(db, c.id, c1.replace("-", "'"), null, CODES, actor, DAY1).kind).toBe(
			"seen",
		);
		expect(recordScan(db, c.id, "2026-99999", null, CODES, actor, DAY1)).toEqual({
			kind: "unknown",
			code: "2026-99999",
		});
		expect(inventoryCounts(db, c.id)).toMatchObject({ expected: 5, seen: 2, scanned: 2 });
	});

	it("flags misplaced copies, finds lost ones and never counts loans as missing", () => {
		const { db, actor, codes, ids } = library();
		const c = openInventory(db, { name: "Inventario" }, actor, DAY1);
		const [c0, , c2, c3, c4] = codes as [string, string, string, string, string];
		// a fiction copy scanned while working on the 590 shelf
		expect(recordScan(db, c.id, c0, "590", CODES, actor, DAY1).kind).toBe("misplaced");
		expect(recordScan(db, c.id, c3, "590", CODES, actor, DAY1).kind).toBe("seen");
		// a copy marked lost turns up
		setItemStatus(db, ids[4] ?? 0, "lost", "non trovato", actor, DAY1);
		expect(recordScan(db, c.id, c4, null, CODES, actor, DAY1).kind).toBe("found");
		expect(
			db
				.select()
				.from(item)
				.where(eq(item.id, ids[4] ?? 0))
				.get()?.status,
		).toBe("available");
		// a copy on loan
		const p = createPatron(
			db,
			{
				patronType: "student",
				firstName: "Anna",
				lastName: "Bianchi",
				levelCode: "3",
				groupId: String(classId(db, "3", "A")),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			PATRON_RULES,
		);
		checkoutItem(db, getConfig(), { patronId: p, itemId: ids[2] ?? 0 }, actor, DAY1);
		expect(recordScan(db, c.id, c2, null, CODES, actor, DAY1).kind).toBe("onLoan");

		const progress = inventoryProgress(db, c.id, "it");
		expect(progress).toMatchObject({ expected: 4, seen: 3, misplaced: 1, found: 1 });
		expect(progress.shelves.map((s) => [s.shelf, s.expected, s.seen])).toEqual([
			["590", 2, 2],
			["B", 2, 1],
		]);
		expect(missingItems(db, c.id).map((m) => m.itemId)).toEqual([ids[1]]);
		expect(missingItems(db, c.id, { shelf: "590" })).toEqual([]);
		expect(shelvesOf(db, "it")).toEqual(["590", "B"]);
	});

	it("orders the shelves in the installation's language (Ö after Z in Swedish)", () => {
		const { db, ids } = library();
		db.update(item)
			.set({ callNumber: "Ö ROS" })
			.where(eq(item.id, ids[0] ?? 0))
			.run();
		db.update(item)
			.set({ callNumber: "Z ROS" })
			.where(eq(item.id, ids[3] ?? 0))
			.run();
		expect(shelvesOf(db, "sv")).toEqual(["590", "B", "Z", "Ö"]);
		expect(shelvesOf(db, "it")).toEqual(["590", "B", "Ö", "Z"]);
		const c = openInventory(db, { name: "Inventario" }, { id: 1 }, DAY1);
		expect(inventoryProgress(db, c.id, "sv").shelves.map((s) => s.shelf)).toEqual([
			"590",
			"B",
			"Z",
			"Ö",
		]);
	});

	it("closes marking only the never-seen copies lost, and reopens within seven days", () => {
		const { db, actor, codes, ids } = library();
		const c = openInventory(db, { name: "Inventario" }, actor, DAY1);
		for (const code of codes.slice(0, 3)) {
			recordScan(db, c.id, code, null, CODES, actor, DAY1);
		}
		const summary = closeInventory(db, c.id, actor, DAY2);
		expect(summary).toMatchObject({ expected: 5, seen: 3, lost: 2 });
		const statuses = (): string[] =>
			ids.map((id) => db.select().from(item).where(eq(item.id, id)).get()?.status ?? "");
		expect(statuses()).toEqual(["available", "available", "available", "lost", "lost"]);
		expect(currentInventory(db)).toBeNull();
		expect(listInventories(db)[0]?.summary?.lost).toBe(2);
		expect(() => recordScan(db, c.id, codes[3] ?? "", null, CODES, actor, DAY2)).toThrow(
			InventoryError,
		);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "inventory.close")).get()?.details,
		).toMatchObject({ lost: 2 });

		// the history says which campaigns can still be reopened
		expect(closedInventories(db, DAY2).map((x) => x.canReopen)).toEqual([true]);
		expect(closedInventories(db, new Date("2026-10-20T08:00:00Z"))[0]?.canReopen).toBe(false);
		expect(() => reopenInventory(db, c.id, actor, new Date("2026-10-20T08:00:00Z"))).toThrow(
			InventoryError,
		);
		reopenInventory(db, c.id, actor, DAY2);
		expect(statuses()).toEqual([
			"available",
			"available",
			"available",
			"available",
			"available",
		]);
		expect(currentInventory(db)?.id).toBe(c.id);
		expect(inventoryCounts(db, c.id).seen).toBe(3);
		expect(closedInventories(db, DAY2)).toEqual([]);
	});
});
