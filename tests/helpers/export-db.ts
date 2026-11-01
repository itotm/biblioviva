// SPDX-License-Identifier: GPL-3.0-or-later
// A seeded database on a temporary file for the export tests: the report export reads it through
// the read-only report connection on `DATABASE_PATH`, the other tables through the Drizzle handle.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type Db } from "#lib/server/db/client.js";
import { runMigrations } from "#lib/server/db/migrate.js";
import { staffUser } from "#lib/server/db/schema.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { resetEnvCache } from "#lib/server/env.js";
import { closeReportConnection } from "#lib/server/reports/connection.js";

export interface ExportDb {
	db: Db;
	actor: { id: number };
	close: () => void;
}

export function openExportDb(): ExportDb {
	const dir = mkdtempSync(join(tmpdir(), "bv-export-"));
	const path = join(dir, "db.sqlite");
	const db = openDatabase(path);
	runMigrations(db);
	seedDatabase(db, { patrons: 30, teachers: 4, biblios: 20, items: 30, loans: 40 });
	const actor = db
		.insert(staffUser)
		.values({ username: "export-test", passwordHash: "x", roles: ["admin"] })
		.returning({ id: staffUser.id })
		.get();
	const previous = process.env.DATABASE_PATH;
	process.env.DATABASE_PATH = path;
	resetEnvCache();
	closeReportConnection();
	return {
		db,
		actor,
		close: () => {
			closeReportConnection();
			db.$client.close();
			if (previous === undefined) {
				delete process.env.DATABASE_PATH;
			} else {
				process.env.DATABASE_PATH = previous;
			}
			resetEnvCache();
			rmSync(dir, { recursive: true, force: true });
		},
	};
}
