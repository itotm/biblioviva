// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run db:seed [--reset]` — fills DATABASE_PATH with synthetic demo data (never real people)
// and gives about half of the patrons a demo photo under DATA_DIR (the configured photo settings).
import { existsSync, rmSync } from "node:fs";
import { getConfig } from "#lib/server/config/index.js";
import { closeDb, getDb } from "#lib/server/db/index.js";
import { mirrorConfigTables } from "#lib/server/db/config-mirror.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { seedOptionsFromConfig } from "#lib/server/db/seed-config.js";
import { seedPatronPhotos } from "#lib/server/db/seed-photos.js";
import { env } from "#lib/server/env.js";

const path = env().DATABASE_PATH;
if (process.argv.includes("--reset") && existsSync(path)) {
	for (const suffix of ["", "-wal", "-shm"]) {
		rmSync(path + suffix, { force: true });
	}
	console.log(`Removed ${path}`);
}
const db = getDb();
mirrorConfigTables(db, getConfig());
try {
	const config = getConfig();
	// the demo school follows the configuration: its classes, levels and formats (step 12.8)
	const summary = seedDatabase(db, seedOptionsFromConfig(config));
	const photos = await seedPatronPhotos(db, env().DATA_DIR, getConfig().photos);
	console.log(`Seeded ${path}:`, { ...summary, photos });
} catch (e) {
	// `--if-empty`: a database that already has patrons is left alone (test setups run this repeatedly)
	if (process.argv.includes("--if-empty") && (e as Error).message.includes("already contains")) {
		console.log(`Skipped: ${path} already contains patrons`);
	} else {
		throw e;
	}
} finally {
	closeDb();
}
