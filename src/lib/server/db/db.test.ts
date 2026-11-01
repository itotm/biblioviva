// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

/** Drizzle wraps SQLite errors; the constraint name is in the cause. */
function expectSqliteError(fn: () => unknown, pattern: RegExp): void {
	try {
		fn();
	} catch (e) {
		const err = e as Error & { cause?: Error };
		expect(`${err.message} ${err.cause?.message ?? ""}`).toMatch(pattern);
		return;
	}
	throw new Error(`expected an error matching ${pattern}`);
}
import { createTestDb, sequenceValue } from "../../../../tests/helpers/db.js";
import { inClass } from "../../../../tests/helpers/school.js";
import { resolveTuning } from "./client.js";
import { applyFtsMigration, FTS_COLUMNS, rebuildFts } from "./fts.js";
import { biblio, item, loan, patron } from "./schema.js";
import { ensureAtLeast, nextValue } from "./sequence.js";

describe("database layer", () => {
	it("migrates a fresh database in under a second and creates every table", () => {
		const started = performance.now();
		const db = createTestDb();
		expect(performance.now() - started).toBeLessThan(1000);
		const tables = db.$client
			.query<{ name: string }, []>(
				"SELECT name FROM sqlite_master WHERE type IN ('table') ORDER BY name",
			)
			.all()
			.map((r) => r.name);
		for (const t of [
			"biblio",
			"item",
			"patron",
			"loan",
			"loan_event",
			"staff_user",
			"session",
			"sequence",
			"metadata_cache",
			"audit_log",
			"import_batch",
			"print_list",
			"print_list_entry",
			"biblio_fts",
		]) {
			expect(tables, t).toContain(t);
		}
		// idempotent: migrating again is a no-op
		expect(() => createTestDb()).not.toThrow();
	});

	it("keeps the FTS5 index in sync through triggers and supports prefix queries without diacritics", () => {
		const db = createTestDb();
		const [row] = db
			.insert(biblio)
			.values({
				title: "Le cosmicomiche",
				author: "Calvino, Italo",
				publisher: "Einaudi",
				kind: "fiction",
				subjects: ["fantascienza"],
			})
			.returning({ id: biblio.id })
			.all();
		const hits = db.$client
			.query<{ rowid: number }, [string]>(
				"SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH ?1",
			)
			.all("cosmic*");
		expect(hits.map((h) => h.rowid)).toEqual([row!.id]);
		expect(
			db.$client
				.query("SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH ?1")
				.all("citta OR fantascienza"),
		).toHaveLength(1);
		db.update(biblio).set({ title: "Città invisibili" }).where(eq(biblio.id, row!.id)).run();
		expect(
			db.$client.query("SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH ?1").all("citta"),
		).toHaveLength(1);
		expect(
			db.$client
				.query("SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH ?1")
				.all("cosmic*"),
		).toHaveLength(0);
		db.delete(biblio).where(eq(biblio.id, row!.id)).run();
		expect(
			db.$client.query("SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH ?1").all("citta"),
		).toHaveLength(0);
		expect(() => rebuildFts(db.$client)).not.toThrow();
	});

	it("finds a record by its original title and rebuilds an index made with other columns", () => {
		const db = createTestDb();
		const [row] = db
			.insert(biblio)
			.values({
				title: "Il piccolo principe",
				originalTitle: "Le petit prince",
				author: "Saint-Exupéry, Antoine de",
				publisher: "Bompiani",
				kind: "fiction",
			})
			.returning({ id: biblio.id })
			.all();
		const match = (q: string): unknown[] =>
			db.$client.query("SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH ?1").all(q);
		expect(match("petit*")).toEqual([{ rowid: row!.id }]);
		// an index of a database made before the original title: dropped, made again, filled
		const sqlite = db.$client;
		for (const trigger of ["biblio_fts_ai", "biblio_fts_ad", "biblio_fts_au"]) {
			sqlite.run(`DROP TRIGGER ${trigger}`);
		}
		sqlite.run("DROP TABLE biblio_fts");
		sqlite.run(
			"CREATE VIRTUAL TABLE biblio_fts USING fts5(title, author, content='biblio', content_rowid='id')",
		);
		applyFtsMigration(sqlite);
		expect(
			sqlite
				.query<{ name: string }, []>("SELECT name FROM pragma_table_info('biblio_fts')")
				.all()
				.map((c) => c.name),
		).toEqual([...FTS_COLUMNS]);
		expect(match("petit*")).toEqual([{ rowid: row!.id }]);
		expect(match("piccolo")).toEqual([{ rowid: row!.id }]);
	});

	it("enforces the CHECK constraints and one open loan per item", () => {
		const db = createTestDb();
		expectSqliteError(
			() =>
				db
					.insert(patron)
					.values({ firstName: "A", lastName: "B", patronType: "alien" })
					.run(),
			/CHECK/,
		);
		const [b] = db
			.insert(biblio)
			.values({ title: "t", author: "a", publisher: "p", kind: "fiction" })
			.returning({ id: biblio.id })
			.all();
		const [i] = db
			.insert(item)
			.values({ biblioId: b!.id, barcode: "2026-0001" })
			.returning({ id: item.id })
			.all();
		const [p] = db
			.insert(patron)
			.values({
				firstName: "Anna",
				lastName: "Rossi",
				patronType: "student",
				...inClass(db, 3, "A"),
			})
			.returning({ id: patron.id })
			.all();
		const values = {
			itemId: i!.id,
			patronId: p!.id,
			dueDate: "2026-10-04",
			patronTypeSnapshot: "student",
			schoolYear: "2026/2027",
		};
		db.insert(loan).values(values).run();
		expectSqliteError(() => db.insert(loan).values(values).run(), /UNIQUE/);
		db.update(loan).set({ returnedAt: "2026-09-20T10:00:00Z" }).run();
		expect(() => db.insert(loan).values(values).run()).not.toThrow();
		// items cannot be deleted while a biblio still references them the other way round: RESTRICT
		expectSqliteError(() => db.delete(biblio).where(eq(biblio.id, b!.id)).run(), /FOREIGN KEY/);
	});

	it("sequences are atomic inside transactions and can be bumped after imports", () => {
		const db = createTestDb();
		expect(nextValue(db, "patron_card")).toBe(1);
		expect(nextValue(db, "patron_card")).toBe(2);
		expect(nextValue(db, "item_2026")).toBe(1);
		// a rolled-back transaction does not consume the number
		expect(() =>
			db.transaction(() => {
				nextValue(db, "patron_card");
				throw new Error("abort");
			}),
		).toThrow("abort");
		expect(sequenceValue(db, "patron_card")).toBe(2);
		ensureAtLeast(db, "patron_card", 1335);
		expect(nextValue(db, "patron_card")).toBe(1336);
		ensureAtLeast(db, "patron_card", 10); // never lowers
		expect(sequenceValue(db, "patron_card")).toBe(1336);
	});

	it("resolves SQLite tuning from the hardware profile with overrides", () => {
		expect(resolveTuning({ profile: "small" })).toEqual({
			cacheMb: 16,
			mmapMb: 0,
			walAutocheckpointPages: 1000,
		});
		expect(resolveTuning({ profile: "micro" }).cacheMb).toBe(8);
		expect(resolveTuning({ profile: "large", sqliteCacheMb: 32 })).toEqual({
			cacheMb: 32,
			mmapMb: 512,
			walAutocheckpointPages: 4000,
		});
		const db = createTestDb();
		expect(
			(db.$client.query("PRAGMA foreign_keys").get() as { foreign_keys: number })
				.foreign_keys,
		).toBe(1);
	});
});
