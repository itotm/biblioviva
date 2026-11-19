// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { applyFtsMigration, ftsMatch, rebuildFts } from "./fts.js";
import { biblio } from "./schema.js";

type TestDb = ReturnType<typeof createTestDb>;

function add(
	db: TestDb,
	title: string,
	author: string,
	extra: { originalTitle?: string } = {},
): number {
	const [row] = db
		.insert(biblio)
		.values({ title, author, publisher: "s.n.", kind: "fiction", ...extra })
		.returning({ id: biblio.id })
		.all();
	return row!.id;
}

/** The ids the catalogue search finds for a text, as the service builds its query. */
function find(db: TestDb, text: string): number[] {
	const match = ftsMatch(text);
	if (match === null) {
		return [];
	}
	return db.$client
		.query<{ rowid: number }, [string]>(
			"SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH ?1 ORDER BY rowid",
		)
		.all(match)
		.map((r) => r.rowid);
}

describe("the folded catalogue index", () => {
	it("finds Arabic, Hebrew and Latin words whatever their marks and variants", () => {
		const db = createTestDb();
		const arabic = add(db, "كِتَابُ الأَطْفَالِ", "أَحْمَد، إبراهيم");
		const hebrew = add(db, "שָׁלוֹם עֲלֵיכֶם", "עמוס עוז");
		const latin = add(db, "Le avventure di José", "Núñez, Ana", {
			originalTitle: "Les aventures",
		});
		const persian = add(db, "کتاب فارسی", "مدرسة");
		expect(find(db, "كتاب")).toEqual([arabic, persian]);
		expect(find(db, "كِتَابُ")).toEqual([arabic, persian]);
		expect(find(db, "احمد")).toEqual([arabic]);
		expect(find(db, "أحمد")).toEqual([arabic]);
		expect(find(db, "ابراهيم")).toEqual([arabic]);
		expect(find(db, "الاطفال")).toEqual([arabic]);
		expect(find(db, "كتا")).toEqual([arabic, persian]);
		expect(find(db, "فارسي")).toEqual([persian]);
		expect(find(db, "مدرسه")).toEqual([persian]);
		expect(find(db, "שלום")).toEqual([hebrew]);
		expect(find(db, "שָׁלוֹם עליכם")).toEqual([hebrew]);
		expect(find(db, "עמוס")).toEqual([hebrew]);
		expect(find(db, "jose")).toEqual([latin]);
		expect(find(db, "JOSÉ")).toEqual([latin]);
		expect(find(db, "nunez ana")).toEqual([latin]);
		expect(find(db, "avvent*")).toEqual([latin]);
		expect(find(db, "aventures")).toEqual([latin]);
	});

	it("follows an update, a delete and a rebuild with the same folded text", () => {
		const db = createTestDb();
		const id = add(db, "كِتَابُ", "Rossi, Mario");
		expect(find(db, "كتاب")).toEqual([id]);
		db.update(biblio).set({ title: "شَجَرَةٌ" }).where(eq(biblio.id, id)).run();
		expect(find(db, "كتاب")).toEqual([]);
		expect(find(db, "شجره")).toEqual([id]);
		expect(find(db, "شجرة")).toEqual([id]);
		rebuildFts(db.$client);
		expect(find(db, "شجرة")).toEqual([id]);
		expect(find(db, "rossi")).toEqual([id]);
		db.delete(biblio).where(eq(biblio.id, id)).run();
		expect(find(db, "شجرة")).toEqual([]);
	});

	it("rebuilds an index whose triggers index the text as stored", () => {
		const db = createTestDb();
		const sqlite = db.$client;
		const id = add(db, "كِتَابُ الأَطْفَالِ", "Rossi, Mario");
		// the definition of an older database: same table, triggers without the fold
		for (const trigger of ["biblio_fts_ai", "biblio_fts_ad", "biblio_fts_au"]) {
			sqlite.run(`DROP TRIGGER ${trigger}`);
		}
		sqlite.run("INSERT INTO biblio_fts(biblio_fts) VALUES ('rebuild')");
		expect(find(db, "كتاب")).toEqual([]);
		sqlite.run(`CREATE TRIGGER biblio_fts_ai AFTER INSERT ON biblio BEGIN
			INSERT INTO biblio_fts(rowid, title) VALUES (new.id, new.title);
		END`);
		applyFtsMigration(sqlite);
		expect(find(db, "كتاب")).toEqual([id]);
		expect(find(db, "rossi")).toEqual([id]);
		expect(add(db, "كِتَابٌ آخَر", "Bianchi")).toBeGreaterThan(id);
		expect(find(db, "كتاب")).toHaveLength(2);
	});

	it("leaves a current index as it is", () => {
		const db = createTestDb();
		const id = add(db, "Il barone rampante", "Calvino, Italo");
		// an index that would be rebuilt loses this marker row
		db.$client.run("INSERT INTO biblio_fts(rowid, title) VALUES (9999, 'marker')");
		applyFtsMigration(db.$client);
		const marker = db.$client
			.query("SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH 'marker'")
			.all();
		expect(marker).toHaveLength(1);
		expect(find(db, "barone")).toEqual([id]);
	});

	it("is refused on a connection that did not register the fold", async () => {
		const { Database } = await import("bun:sqlite");
		const db = createTestDb();
		add(db, "Un libro", "Rossi, Mario");
		const path = `${process.env.TMPDIR ?? "/tmp"}/bv-fold-${process.pid}.db`;
		db.$client.run("VACUUM INTO ?", [path]);
		const plain = new Database(path);
		try {
			expect(() => plain.run("UPDATE biblio SET title = 'Altro'")).toThrow(/bv_fold/);
		} finally {
			plain.close();
			await (await import("node:fs/promises")).rm(path, { force: true });
		}
	});
});
