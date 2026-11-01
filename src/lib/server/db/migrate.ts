// SPDX-License-Identifier: GPL-3.0-or-later
// Applies the Drizzle migrations (drizzle/) and the FTS5 migration at startup.
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { resolve } from "node:path";
import type { Db } from "./client.js";
import { applyFtsMigration, assertFts5 } from "./fts.js";

/** The `drizzle/` folder shipped next to the app (cwd-relative; `MIGRATIONS_DIR` overrides it). */
export const MIGRATIONS_FOLDER = process.env.MIGRATIONS_DIR ?? resolve("drizzle");

export function runMigrations(db: Db, migrationsFolder = MIGRATIONS_FOLDER): void {
	const sqlite = db.$client;
	assertFts5(sqlite);
	// bun:sqlite may raise SQLITE_LOCKED on DDL touching FTS5 tables while cached statements exist.
	sqlite.run("PRAGMA foreign_keys = OFF");
	migrate(db, { migrationsFolder });
	applyFtsMigration(sqlite);
	sqlite.run("PRAGMA foreign_keys = ON");
}
