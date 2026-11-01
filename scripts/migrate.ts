// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run db:migrate` — applies pending migrations to DATABASE_PATH (also done at app startup).
import { closeDb, getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";

getDb();
console.log(`Database ${env().DATABASE_PATH} is up to date`);
closeDb();
