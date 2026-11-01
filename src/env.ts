// SPDX-License-Identifier: GPL-3.0-or-later
// SvelteKit 3 environment declaration: the same variables as #lib/server/env.ts, so the app
// refuses to start with a bad value (§3.3, §3.6). None is public: nothing reaches the browser.
import { defineEnvVars } from "@sveltejs/kit/env";
import * as v from "valibot";
import { envSchema } from "#lib/server/env.js";

const optionalString = v.optional(v.string());

export const variables = defineEnvVars({
	CONFIG_DIR: {
		schema: envSchema.entries.CONFIG_DIR,
		description: "Configuration volume (/config)",
	},
	DATA_DIR: { schema: envSchema.entries.DATA_DIR, description: "Data volume (/data)" },
	BACKUP_DIR: {
		schema: envSchema.entries.BACKUP_DIR,
		description: "Backups volume (/backups)",
	},
	DATABASE_PATH: {
		schema: optionalString,
		description: "SQLite file (default DATA_DIR/db/biblioviva.db)",
	},
	PORT: { schema: envSchema.entries.PORT },
	HOST: { schema: envSchema.entries.HOST },
	LAN_PORT: {
		schema: envSchema.entries.LAN_PORT,
		description: "Basic local-network mode: plain-http port for the network, without Tailscale",
	},
	BODY_SIZE_LIMIT: { schema: envSchema.entries.BODY_SIZE_LIMIT },
	CONNECTION_IDLE_TIMEOUT: {
		schema: envSchema.entries.CONNECTION_IDLE_TIMEOUT,
		description: "Seconds a connection may stay silent before it is closed (at most 255)",
	},
	LOG_LEVEL: { schema: envSchema.entries.LOG_LEVEL },
	TZ: { schema: optionalString, description: "Mirrors library.timezone" },
	DEV_UI: {
		schema: optionalString,
		description: "Set to 1 to expose /dev/ui in a production build (tests)",
	},
	ALLOW_LANG_OVERRIDE: {
		schema: optionalString,
		description: "Set to 1 to honour ?lang= (tests)",
	},
	DEMO: {
		schema: optionalString,
		description: "Set to 1 to pre-tick demo data in the first-run wizard",
	},
	DEMO_PUBLIC: {
		schema: optionalString,
		description:
			"Set to 1 for the public demo: rebuilt at every start, guarded, reset daily (docs/demo.md)",
	},
	DEMO_RESET_AT: {
		schema: envSchema.entries.DEMO_RESET_AT,
		description: "Daily reset of the public demo, HH:MM in library.timezone",
	},
	DEMO_NOTES_PER_DAY: {
		schema: envSchema.entries.DEMO_NOTES_PER_DAY,
		description: "Staff notes one client address may write per day in the public demo",
	},
	METADATA_PROVIDER: { schema: envSchema.entries.METADATA_PROVIDER },
	YAZ_CLIENT: { schema: envSchema.entries.YAZ_CLIENT },
	LANGUAGE_PACKS_BASE_URL: {
		schema: envSchema.entries.LANGUAGE_PACKS_BASE_URL,
		description:
			"Folder the language packs of the release are downloaded from (default: the GitHub release of this version; tests)",
	},
	GOOGLE_BOOKS_API_KEY: {
		schema: envSchema.entries.GOOGLE_BOOKS_API_KEY,
		description: "Google Books API key, for the Google Books metadata and cover providers",
		secret: true,
	},
});
