// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestSqlite, hasFts5 } from "../../../../tests/helpers/db.js";

describe("bun:sqlite under the unit test runner", () => {
	it("opens an in-memory database with FTS5 and foreign keys", () => {
		const db = createTestSqlite();
		expect(hasFts5(db)).toBe(true);
		expect(
			(db.query("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys,
		).toBe(1);
		db.run("CREATE VIRTUAL TABLE t USING fts5(title)");
		db.run("INSERT INTO t(title) VALUES ('Le cosmicomiche')");
		const row = db.query("SELECT title FROM t WHERE t MATCH 'cosmic*'").get() as {
			title: string;
		};
		expect(row.title).toBe("Le cosmicomiche");
		db.close();
	});
});
