// SPDX-License-Identifier: GPL-3.0-or-later
// Opens the SQLite database with the pragmas of the active hardware profile (PLAN.md §3.14).
import { Database } from "bun:sqlite";
import { drizzle, type SQLiteBunDatabase } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { resolvePerformance, type PerformanceSettings } from "#lib/shared/performance.js";

export type Db = SQLiteBunDatabase & { $client: Database };
/** A database handle or a transaction handle: what services accept for their queries. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface SqliteTuning {
	cacheMb: number;
	mmapMb: number;
	walAutocheckpointPages: number;
}

/** The SQLite settings in force: the profile's, the explicit `performance.*` keys over them. */
export function resolveTuning(performance: PerformanceSettings | undefined): SqliteTuning {
	const values = resolvePerformance(performance);
	return {
		cacheMb: values.sqliteCacheMb,
		mmapMb: values.sqliteMmapMb,
		walAutocheckpointPages: values.walAutocheckpointPages,
	};
}

export function applyPragmas(
	sqlite: Database,
	tuning: SqliteTuning,
	options: { wal?: boolean } = {},
): void {
	if (options.wal !== false) {
		sqlite.run("PRAGMA journal_mode = WAL");
	}
	sqlite.run("PRAGMA foreign_keys = ON");
	sqlite.run("PRAGMA busy_timeout = 5000");
	sqlite.run("PRAGMA synchronous = NORMAL");
	sqlite.run(`PRAGMA cache_size = -${tuning.cacheMb * 1024}`); // negative = KiB
	sqlite.run(`PRAGMA mmap_size = ${tuning.mmapMb * 1024 * 1024}`);
	sqlite.run(`PRAGMA wal_autocheckpoint = ${tuning.walAutocheckpointPages}`);
	sqlite.run("PRAGMA temp_store = MEMORY");
}

/** Opens (creating the folder if needed) and tunes a database file; `:memory:` for tests. */
export function openDatabase(
	path: string,
	tuning: SqliteTuning = resolveTuning({ profile: "small" }),
): Db {
	if (path !== ":memory:") {
		mkdirSync(dirname(path), { recursive: true });
	}
	const sqlite = new Database(path, { create: true, strict: true });
	applyPragmas(sqlite, tuning, { wal: path !== ":memory:" });
	return drizzle({ client: sqlite });
}
