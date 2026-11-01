// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "#lib/server/config/index.js";
import { resetEnvCache } from "#lib/server/env.js";
import { closeDb, getDb } from "./index.js";

let dir: string;
const saved = { DATA_DIR: process.env.DATA_DIR, DATABASE_PATH: process.env.DATABASE_PATH };

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-db-"));
	process.env.DATA_DIR = dir;
	delete process.env.DATABASE_PATH;
	resetEnvCache();
	resetConfigCache();
});

afterEach(() => {
	closeDb();
	rmSync(dir, { recursive: true, force: true });
	if (saved.DATA_DIR === undefined) {
		delete process.env.DATA_DIR;
	} else {
		process.env.DATA_DIR = saved.DATA_DIR;
	}
	if (saved.DATABASE_PATH === undefined) {
		delete process.env.DATABASE_PATH;
	} else {
		process.env.DATABASE_PATH = saved.DATABASE_PATH;
	}
	resetEnvCache();
	resetConfigCache();
});

describe("process-wide database", () => {
	it("creates the file under DATA_DIR/db, migrates it and memoises the handle", () => {
		const db = getDb();
		expect(existsSync(join(dir, "db", "biblioviva.db"))).toBe(true);
		expect(getDb()).toBe(db);
		const journal = db.$client.query("PRAGMA journal_mode").get() as { journal_mode: string };
		expect(journal.journal_mode).toBe("wal");
		expect(
			db.$client
				.query("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'biblio_fts'")
				.get(),
		).toEqual({ n: 1 });
		closeDb();
		expect(getDb()).not.toBe(db); // reopened after close
	});
});
