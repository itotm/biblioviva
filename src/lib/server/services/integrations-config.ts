// SPDX-License-Identifier: GPL-3.0-or-later
// Integrations from the admin UI (PLAN.md step 11.8): the Z39.50 targets with a connection test
// that runs one real query through yaz-client (answered offline with `METADATA_PROVIDER=mock`),
// and the order and flags of the cover providers. Saved with `saveConfigKeys` as whole keys.
import { join } from "node:path";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Env } from "#lib/server/env.js";
import { runYaz, Z3950Error, type Z3950ErrorCode } from "#lib/server/z3950/driver.js";
import type { Z3950Target } from "#lib/server/z3950/targets.js";

export type TargetTest =
	| { ok: true; hits: number; elapsedMs: number; mock: boolean }
	| { ok: false; code: Z3950ErrorCode; message: string };

/** A title search every library catalogue answers: the test only needs an answer. */
const TEST_QUERY = { kind: "search" as const, title: "promessi sposi" };

export async function testZ3950Target(
	target: Z3950Target,
	config: AppConfig,
	environment: Pick<Env, "METADATA_PROVIDER" | "YAZ_CLIENT" | "DATA_DIR">,
): Promise<TargetTest> {
	if (environment.METADATA_PROVIDER === "mock") {
		return { ok: true, hits: 1, elapsedMs: 0, mock: true };
	}
	try {
		const result = await runYaz(target, TEST_QUERY, {
			command: environment.YAZ_CLIENT,
			tmpDir: join(environment.DATA_DIR, "tmp"),
			timeoutMs: config.z3950.timeoutMs,
			max: 1,
		});
		return { ok: true, hits: result.hits, elapsedMs: result.elapsedMs, mock: false };
	} catch (e) {
		if (e instanceof Z3950Error) {
			return { ok: false, code: e.code, message: e.message };
		}
		throw e;
	}
}
