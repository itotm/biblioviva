// SPDX-License-Identifier: GPL-3.0-or-later
// In-memory database for unit tests, with the real schema (Drizzle migrations + FTS5).
import { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";
import { openDatabase, type Db, type DbOrTx } from "#lib/server/db/client.js";
import { runMigrations } from "#lib/server/db/migrate.js";

export function createTestSqlite(): Database {
	const db = new Database(":memory:");
	db.run("PRAGMA foreign_keys = ON");
	db.run("PRAGMA journal_mode = MEMORY");
	return db;
}

/** True when the linked SQLite has the FTS5 extension (required by the catalog search). */
export function hasFts5(db: Database): boolean {
	try {
		db.run("CREATE VIRTUAL TABLE __fts_probe USING fts5(x)");
		db.run("DROP TABLE __fts_probe");
		return true;
	} catch {
		return false;
	}
}

/** A fresh, migrated, empty in-memory database. */
export function createTestDb(): Db {
	const db = openDatabase(":memory:");
	runMigrations(db);
	return db;
}

/** The last value a named counter gave (0: never used). */
export function sequenceValue(db: DbOrTx, name: string): number {
	const row = db.get<{ value: number }>(sql`SELECT value FROM sequence WHERE name = ${name}`);
	return row?.value ?? 0;
}
