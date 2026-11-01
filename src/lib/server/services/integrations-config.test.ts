// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "#lib/server/config/load.js";
import { z3950Target } from "#lib/server/z3950/targets.js";
import { testZ3950Target } from "./integrations-config.js";

const dataDir = mkdtempSync(join(tmpdir(), "bv-z3950-test-"));

describe("Z39.50 connection test", () => {
	const config = loadConfig("config").config;
	const target = z3950Target(config);

	it("answers offline with the mock provider", async () => {
		expect(
			await testZ3950Target(target, config, {
				METADATA_PROVIDER: "mock",
				YAZ_CLIENT: "yaz-client",
				DATA_DIR: dataDir,
			}),
		).toEqual({ ok: true, hits: 1, elapsedMs: 0, mock: true });
	});

	it("tells when yaz-client cannot run", async () => {
		const result = await testZ3950Target(target, config, {
			METADATA_PROVIDER: "real",
			YAZ_CLIENT: join(dataDir, "no-such-yaz-client"),
			DATA_DIR: dataDir,
		});
		expect(result).toMatchObject({ ok: false, code: "spawn" });
		rmSync(dataDir, { recursive: true, force: true });
	});
});
