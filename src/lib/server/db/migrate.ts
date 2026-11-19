// SPDX-License-Identifier: GPL-3.0-or-later
// Applies the Drizzle migrations (drizzle/) and the FTS5 migration at startup.
import type { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { resolve } from "node:path";
import { normalizeSearchText } from "#lib/shared/text.js";
import type { Db } from "./client.js";
import { applyFtsMigration, assertFts5 } from "./fts.js";

/** The `drizzle/` folder shipped next to the app (cwd-relative; `MIGRATIONS_DIR` overrides it). */
export const MIGRATIONS_FOLDER = process.env.MIGRATIONS_DIR ?? resolve("drizzle");

/**
 * `patron.search_name` is derived from the names by the search fold (`normalizeSearchText`, the
 * same as the queries'): rows written by another fold are recomputed. A school has at most a
 * thousand patrons. Returns the rows changed.
 */
export function refreshPatronSearchNames(sqlite: Database): number {
	const update = sqlite.query("UPDATE patron SET search_name = ?1 WHERE id = ?2");
	let changed = 0;
	for (const row of sqlite
		.query<{ id: number; last_name: string; first_name: string; search_name: string }, []>(
			"SELECT id, last_name, first_name, search_name FROM patron",
		)
		.all()) {
		const searchName = normalizeSearchText(`${row.last_name} ${row.first_name}`);
		if (searchName !== row.search_name) {
			update.run(searchName, row.id);
			changed++;
		}
	}
	return changed;
}

export function runMigrations(db: Db, migrationsFolder = MIGRATIONS_FOLDER): void {
	const sqlite = db.$client;
	assertFts5(sqlite);
	// bun:sqlite may raise SQLITE_LOCKED on DDL touching FTS5 tables while cached statements exist.
	sqlite.run("PRAGMA foreign_keys = OFF");
	migrate(db, { migrationsFolder });
	applyFtsMigration(sqlite);
	refreshPatronSearchNames(sqlite);
	sqlite.run("PRAGMA foreign_keys = ON");
}
