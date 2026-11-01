// SPDX-License-Identifier: GPL-3.0-or-later
// The read-only connection reports run on (PLAN.md §3.11): opened read-only by SQLite and with
// `query_only`, so even a statement that slipped past the checks cannot write.
import { Database } from "bun:sqlite";
import { env } from "#lib/server/env.js";

let current: Database | undefined;

export function openReportConnection(path: string): Database {
	const db = new Database(path, { readonly: true, strict: true });
	db.run("PRAGMA query_only = 1");
	db.run("PRAGMA busy_timeout = 5000");
	return db;
}

/** The process-wide report connection on `DATABASE_PATH`, opened on first use. */
export function reportConnection(): Database {
	current ??= openReportConnection(env().DATABASE_PATH);
	return current;
}

export function closeReportConnection(): void {
	current?.close();
	current = undefined;
}
