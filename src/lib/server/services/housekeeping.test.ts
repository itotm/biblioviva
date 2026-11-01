// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { metadataCache, session, staffUser } from "#lib/server/db/schema.js";
import { installHousekeeping, purgeTmp, runHousekeeping } from "./housekeeping.js";

const config = parseConfig(exampleRaw()).config;
const NOW = new Date("2026-09-28T10:00:00Z");
const daysAgo = (d: number): Date => new Date(NOW.getTime() - d * 86_400_000);
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
	vi.restoreAllMocks();
});

function tempDir(): string {
	const d = mkdtempSync(join(tmpdir(), "bv-housekeeping-"));
	dirs.push(d);
	return d;
}

function touch(path: string, when: Date, folder = false): void {
	if (folder) {
		mkdirSync(path, { recursive: true });
	} else {
		writeFileSync(path, "x");
	}
	utimesSync(path, when, when);
}

describe("housekeeping", () => {
	it("removes expired sessions, old and outdated lookups, old cover answers, abandoned temp files", () => {
		const db = createTestDb();
		const user = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		db.insert(session)
			.values([
				{ id: "old", userId: user.id, expiresAt: daysAgo(1).toISOString() },
				{ id: "live", userId: user.id, expiresAt: daysAgo(-5).toISOString() },
			])
			.run();
		const row = (
			key: string,
			days: number,
		): { key: string; provider: string; payload: object; fetchedAt: string } => ({
			key,
			provider: "sbn",
			payload: {},
			fetchedAt: daysAgo(days).toISOString(),
		});
		db.insert(metadataCache)
			.values([
				row("v4:sbn:isbn:1", 1), // fresh: kept
				row("v4:sbn:isbn:2", config.metadata.cacheDays + 1), // expired
				row("v3:sbn:isbn:3", 1), // older version of the cache
				row("cover:amazon:4", 2), // "no cover" of this week: kept
				row("cover:amazon:5", 8), // past its week
			])
			.run();
		const dataDir = tempDir();
		mkdirSync(join(dataDir, "tmp", "restore"), { recursive: true });
		touch(join(dataDir, "tmp", "export-a.db"), daysAgo(3));
		touch(join(dataDir, "tmp", "z3950-new"), daysAgo(0), true);
		touch(join(dataDir, "tmp", "restore", "token-old"), daysAgo(5), true);
		touch(join(dataDir, "tmp", "restore", "token-new"), daysAgo(0), true);

		expect(runHousekeeping(db, config, dataDir, NOW)).toEqual({
			sessions: 1,
			metadata: 2,
			covers: 1,
			tmp: 2,
		});
		expect(db.select({ id: session.id }).from(session).all()).toEqual([{ id: "live" }]);
		expect(
			db
				.select({ key: metadataCache.key })
				.from(metadataCache)
				.all()
				.map((r) => r.key)
				.sort(),
		).toEqual(["cover:amazon:4", "v4:sbn:isbn:1"]);
		expect(existsSync(join(dataDir, "tmp", "restore"))).toBe(true);
		expect(existsSync(join(dataDir, "tmp", "restore", "token-new"))).toBe(true);
		expect(existsSync(join(dataDir, "tmp", "z3950-new"))).toBe(true);
		// no tmp folder at all: nothing to do
		expect(purgeTmp(tempDir(), NOW)).toBe(0);
	});

	it("runs at once, logs what it removed and survives a failure", () => {
		const db = createTestDb();
		const log = vi.fn();
		const stop = installHousekeeping(
			() => db,
			() => config,
			tempDir(),
			log,
		);
		stop();
		expect(log).not.toHaveBeenCalled();
		const failing = installHousekeeping(
			() => {
				throw new Error("no database");
			},
			() => config,
			tempDir(),
			log,
		);
		failing();
		expect(log).toHaveBeenCalledWith("housekeeping failed: no database");
	});
});
