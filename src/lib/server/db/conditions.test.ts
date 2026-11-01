// SPDX-License-Identifier: GPL-3.0-or-later
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { inCollection, lendableStatusesSql, openLoansOfPatronSql } from "./conditions.js";
import { biblio, item, loan, patron } from "./schema.js";

describe("shared SQL conditions", () => {
	it("keep the copies of the collection, the lendable ones and count a patron's open loans", () => {
		const db = createTestDb();
		const book = db
			.insert(biblio)
			.values({ title: "Pinocchio", author: "Collodi, Carlo", publisher: "Giunti" })
			.returning({ id: biblio.id })
			.get().id;
		const copy = (barcode: string, status: string): number =>
			db
				.insert(item)
				.values({ biblioId: book, barcode, status })
				.returning({ id: item.id })
				.get().id;
		const ids = {
			available: copy("A1", "available"),
			damaged: copy("A2", "damaged"),
			repair: copy("A3", "in_repair"),
			lost: copy("A4", "lost"),
			withdrawn: copy("A5", "withdrawn"),
		};
		const kept = db.select({ id: item.id }).from(item).where(inCollection()).all();
		expect(kept.map((r) => r.id)).toEqual([ids.available, ids.damaged, ids.repair]);
		const lendable = db
			.select({ id: item.id })
			.from(item)
			.where(sql`${item.status} in ${lendableStatusesSql}`)
			.all();
		expect(lendable.map((r) => r.id)).toEqual([ids.available, ids.damaged]);

		const reader = db
			.insert(patron)
			.values({ firstName: "Anna", lastName: "Rossi", patronType: "teacher" })
			.returning({ id: patron.id })
			.get().id;
		for (const [itemId, returnedAt] of [
			[ids.available, null],
			[ids.damaged, "2026-10-01T10:00:00Z"],
		] as const) {
			db.insert(loan)
				.values({
					itemId,
					patronId: reader,
					dueDate: "2026-11-01",
					patronTypeSnapshot: "teacher",
					schoolYear: "2026/2027",
					returnedAt,
				})
				.run();
		}
		const open = db
			.select({ n: openLoansOfPatronSql })
			.from(patron)
			.where(and(eq(patron.id, reader)))
			.get()?.n;
		expect(open).toBe(1);
	});
});
