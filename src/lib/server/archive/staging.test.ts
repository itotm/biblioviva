// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { discardStaged, newStaging, stagedDir } from "./staging.js";

/** The tokens staged in an area. */
function stagedTokens(dataDir: string, area: string): string[] {
	const root = join(dataDir, "tmp", area);
	return existsSync(root) ? readdirSync(root) : [];
}

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

describe("staging folders", () => {
	it("keeps the recent ones of an area or none, finds and drops a token", () => {
		const dataDir = mkdtempSync(join(tmpdir(), "bv-staging-"));
		dirs.push(dataDir);
		const first = newStaging(dataDir, "a");
		expect(first.dir).toBe(join(dataDir, "tmp", "a", first.token));
		expect(stagedDir(dataDir, "a", first.token)).toBe(first.dir);
		expect(stagedDir(dataDir, "a", "../b")).toBeNull();
		expect(stagedDir(dataDir, "a", "0".repeat(32))).toBeNull();
		// kept for a day
		const second = newStaging(dataDir, "a", { keepMs: 86_400_000 });
		expect(stagedTokens(dataDir, "a").sort()).toEqual([first.token, second.token].sort());
		const old = new Date(Date.now() - 2 * 86_400_000);
		utimesSync(first.dir, old, old);
		const third = newStaging(dataDir, "a", { keepMs: 86_400_000 });
		expect(existsSync(first.dir)).toBe(false);
		// one at a time
		const only = newStaging(dataDir, "a");
		expect(stagedTokens(dataDir, "a")).toEqual([only.token]);
		expect(existsSync(third.dir)).toBe(false);
		discardStaged(dataDir, "a", only.token);
		expect(stagedTokens(dataDir, "a")).toEqual([]);
		expect(stagedTokens(dataDir, "none")).toEqual([]);
	});
});
