// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { closeDb, getDb } from "#lib/server/db/index.js";
import { resetEnvCache } from "#lib/server/env.js";
import { serverContext } from "./context.js";

let dir: string;
const saved = {
	DATA_DIR: process.env.DATA_DIR,
	CONFIG_DIR: process.env.CONFIG_DIR,
	DATABASE_PATH: process.env.DATABASE_PATH,
};

function restore(name: keyof typeof saved): void {
	const value = saved[name];
	if (value === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = value;
	}
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-context-"));
	process.env.DATA_DIR = join(dir, "data");
	process.env.CONFIG_DIR = join(dir, "config");
	delete process.env.DATABASE_PATH;
	resetEnvCache();
	resetConfigCache();
});

afterEach(() => {
	closeDb();
	rmSync(dir, { recursive: true, force: true });
	restore("DATA_DIR");
	restore("CONFIG_DIR");
	restore("DATABASE_PATH");
	resetEnvCache();
	resetConfigCache();
});

describe("server context", () => {
	it("hands over the process-wide database, the configuration and the two volumes", () => {
		const ctx = serverContext();
		expect(ctx.db).toBe(getDb());
		expect(ctx.config).toBe(getConfig());
		expect(ctx.configDir).toBe(join(dir, "config"));
		expect(ctx.dataDir).toBe(join(dir, "data"));
	});
});
