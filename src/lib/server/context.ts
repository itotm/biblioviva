// SPDX-License-Identifier: GPL-3.0-or-later
// What a request hands the services that read the configuration or the volumes beside the
// database: one object, built once per remote function or route, instead of the database, the
// configuration and the folders passed one by one. A service that needs only part of it takes a
// `Pick<ServerContext, …>`, so its tests build only that part.
import type { AppConfig } from "#lib/server/config/schema.js";
import { getConfig } from "#lib/server/config/index.js";
import type { Db } from "#lib/server/db/client.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";

/** The database, the configuration and the two volumes of a request. */
export interface ServerContext {
	db: Db;
	config: AppConfig;
	configDir: string;
	dataDir: string;
}

/** The context of the current request: the open database, the loaded configuration, the volumes. */
export function serverContext(): ServerContext {
	const { CONFIG_DIR, DATA_DIR } = env();
	return { db: getDb(), config: getConfig(), configDir: CONFIG_DIR, dataDir: DATA_DIR };
}
