// SPDX-License-Identifier: GPL-3.0-or-later
// Runtime environment (secrets and paths live here, never in config.json; PLAN.md §3.6).
// Shared by the SvelteKit server (through src/env.ts) and the CLI scripts.
import * as v from "valibot";
import { CONNECTION_IDLE_TIMEOUT_S } from "#lib/shared/performance.js";

const intFrom = (
	fallback: number,
): v.SchemaWithPipe<
	readonly [
		v.OptionalSchema<v.StringSchema<undefined>, string>,
		v.TransformAction<string, number>,
		v.IntegerAction<number, undefined>,
		v.MinValueAction<number, 0, undefined>,
	]
> =>
	v.pipe(
		v.optional(v.string(), String(fallback)),
		v.transform((s) => Number(s)),
		v.integer(),
		v.minValue(0),
	);

export const envSchema = v.object({
	CONFIG_DIR: v.optional(v.string(), "local/config"),
	DATA_DIR: v.optional(v.string(), "local/data"),
	/**
	 * The backups (step 9.35): a volume of its own, so a volume removed or damaged with the
	 * database does not take its backups with it.
	 */
	BACKUP_DIR: v.optional(v.string(), "local/backups"),
	DATABASE_PATH: v.optional(v.string()),
	PORT: intFrom(3000),
	HOST: v.optional(v.string(), "0.0.0.0"),
	/** The basic local-network mode (step 8.8): plain-http port for the network, without Tailscale */
	LAN_PORT: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => Number(s)),
			v.integer(),
			v.minValue(1),
			v.maxValue(65_535),
		),
	),
	BODY_SIZE_LIMIT: v.optional(v.string(), "32M"),
	/**
	 * Seconds a connection may stay silent (step 9.32): read by adapter-bun for the server and by
	 * the basic local-network front; 0 never closes one, 255 at most.
	 */
	CONNECTION_IDLE_TIMEOUT: v.pipe(
		v.optional(v.string(), String(CONNECTION_IDLE_TIMEOUT_S)),
		v.transform((s) => Number(s)),
		v.integer(),
		v.minValue(0),
		v.maxValue(255),
	),
	LOG_LEVEL: v.optional(v.picklist(["debug", "info", "warn", "error"]), "info"),
	TZ: v.optional(v.string()),
	/** Development/test switches */
	DEV_UI: v.optional(v.string()),
	ALLOW_LANG_OVERRIDE: v.optional(v.string()),
	DEMO: v.optional(v.string()),
	/**
	 * The public demo (step 9.17, Q118, Q119): `1` rebuilds the demo at every start, blocks what
	 * would spoil it for the other visitors and exits at `DEMO_RESET_AT` (Docker starts it again).
	 */
	DEMO_PUBLIC: v.optional(v.string()),
	/** The daily reset of the public demo, `HH:MM` in `library.timezone`. */
	DEMO_RESET_AT: v.optional(v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/)), "04:00"),
	/** New staff notes a client address may write per day in the public demo. */
	DEMO_NOTES_PER_DAY: intFrom(5),
	METADATA_PROVIDER: v.optional(v.picklist(["mock", "real"]), "real"),
	/** Path of the yaz-client executable (ADR-001) */
	YAZ_CLIENT: v.optional(v.string(), "yaz-client"),
	/**
	 * Where the language packs of the release are read from (step 9.39): the folder of the GitHub
	 * release that matches the version by default; the tests point it at a server of their own.
	 */
	LANGUAGE_PACKS_BASE_URL: v.optional(v.pipe(v.string(), v.url())),
	/** Google Books API key (optional; the provider is off by default, step 9.1: never in config) */
	GOOGLE_BOOKS_API_KEY: v.optional(v.string()),
});

export type Env = Omit<v.InferOutput<typeof envSchema>, "DATABASE_PATH"> & {
	DATABASE_PATH: string;
};

let cached: Env | undefined;

/** Parsed process environment (memoised). */
export function env(): Env {
	if (!cached) {
		const parsed = v.parse(envSchema, process.env);
		cached = {
			...parsed,
			DATABASE_PATH: parsed.DATABASE_PATH ?? `${parsed.DATA_DIR}/db/biblioviva.db`,
			// the public demo never calls out: it must not become a public proxy to OPAC SBN
			// or the cover providers (9.17)
			METADATA_PROVIDER: parsed.DEMO_PUBLIC === "1" ? "mock" : parsed.METADATA_PROVIDER,
		};
	}
	return cached;
}

/** Test helper: forget the memoised values after changing `process.env`. */
export function resetEnvCache(): void {
	cached = undefined;
}
