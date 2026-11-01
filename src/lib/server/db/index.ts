// SPDX-License-Identifier: GPL-3.0-or-later
// Process-wide database handle: opened on first use with the active profile, migrated once.
import { getConfig } from "#lib/server/config/index.js";
import { env } from "#lib/server/env.js";
import { openDatabase, resolveTuning, type Db } from "./client.js";
import { runMigrations } from "./migrate.js";

export type { Db } from "./client.js";
export * as schema from "./schema.js";

let current: Db | undefined;

export function getDb(): Db {
	if (!current) {
		const db = openDatabase(env().DATABASE_PATH, resolveTuning(getConfig().performance));
		runMigrations(db);
		current = db;
	}
	return current;
}

export function closeDb(): void {
	current?.$client.close();
	current = undefined;
}
