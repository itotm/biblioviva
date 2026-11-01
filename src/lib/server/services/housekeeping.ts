// SPDX-License-Identifier: GPL-3.0-or-later
// Housekeeping (9.13, round 16): what piles up and is never needed again is removed at startup
// and once a day — expired sessions, metadata lookups older than `metadata.cacheDays` or written
// by an older version of the cache, "no cover" answers past their week, and leftovers in
// `DATA_DIR/tmp` (a snapshot, a yaz-client folder or a staged restore abandoned for two days).
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { purgeExpiredSessions } from "#lib/server/auth/session.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db } from "#lib/server/db/client.js";
import { purgeCoverNegatives } from "#lib/server/covers/index.js";
import { debugLog } from "#lib/server/log/debug.js";
import { purgeExpiredCache } from "#lib/server/metadata/cache.js";

const DAY_MS = 86_400_000;
/** A temporary file or folder untouched for this long is abandoned. */
export const TMP_MAX_AGE_MS = 2 * DAY_MS;
/** The staging folders under `tmp/` whose entries are checked one by one. */
const STAGING = ["restore", "config-import", "pictograms", "template-draft"];

export interface HousekeepingResult {
	sessions: number;
	metadata: number;
	covers: number;
	tmp: number;
}

/** Removes the abandoned entries of `DATA_DIR/tmp` (and of its staging folders). */
export function purgeTmp(dataDir: string, now = new Date()): number {
	const tmp = join(dataDir, "tmp");
	let removed = 0;
	const sweep = (dir: string, keep: readonly string[]): void => {
		let names: string[];
		try {
			names = readdirSync(dir);
		} catch {
			return;
		}
		for (const name of names) {
			if (keep.includes(name)) {
				sweep(join(dir, name), []);
				continue;
			}
			const path = join(dir, name);
			try {
				if (now.getTime() - statSync(path).mtimeMs > TMP_MAX_AGE_MS) {
					rmSync(path, { recursive: true, force: true });
					removed += 1;
				}
			} catch {
				// gone meanwhile, or not ours to remove: skipped
			}
		}
	};
	sweep(tmp, STAGING);
	return removed;
}

export function runHousekeeping(
	db: Db,
	config: AppConfig,
	dataDir: string,
	now = new Date(),
): HousekeepingResult {
	const result = {
		sessions: purgeExpiredSessions(db, now),
		metadata: purgeExpiredCache(db, config.metadata.cacheDays, now),
		covers: purgeCoverNegatives(db, now),
		tmp: purgeTmp(dataDir, now),
	};
	debugLog("housekeeping", "done", { ...result });
	return result;
}

/** At startup and every day; returns the function that stops it. */
export function installHousekeeping(
	getDb: () => Db,
	getConfig: () => AppConfig,
	dataDir: string,
	log: (msg: string) => void = console.warn,
): () => void {
	const run = (): void => {
		try {
			const r = runHousekeeping(getDb(), getConfig(), dataDir);
			const total = r.sessions + r.metadata + r.covers + r.tmp;
			if (total > 0) {
				log(
					`housekeeping: ${r.sessions} expired sessions, ${r.metadata} old lookups, ${r.covers} old "no cover" answers, ${r.tmp} temporary files removed`,
				);
			}
		} catch (e) {
			log(`housekeeping failed: ${(e as Error).message}`);
		}
	};
	run();
	const timer = setInterval(run, DAY_MS);
	(timer as { unref?: () => void }).unref?.();
	return () => clearInterval(timer);
}
