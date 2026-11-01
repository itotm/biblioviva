// SPDX-License-Identifier: GPL-3.0-or-later
// The staging folders of the archives being checked before they are applied (§3.22): a
// configuration archive (`config-import`) and a backup or export to restore (`restore`), each in
// DATA_DIR/tmp/<area>/<token>/ until it is applied or discarded. The token is the folder's name,
// 32 hex characters, so it never leads out of the area. A new staging clears the older ones of its
// area: all of them, or those older than `keepMs`.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const TOKEN = /^[a-f0-9]{32}$/;

const areaDir = (dataDir: string, area: string): string => join(dataDir, "tmp", area);

/** A new, empty staging folder of the area. */
export function newStaging(
	dataDir: string,
	area: string,
	options: { keepMs?: number; now?: number } = {},
): { token: string; dir: string } {
	const root = areaDir(dataDir, area);
	const now = options.now ?? Date.now();
	for (const name of existsSync(root) ? readdirSync(root) : []) {
		const path = join(root, name);
		if (options.keepMs === undefined || now - statSync(path).mtimeMs > options.keepMs) {
			rmSync(path, { recursive: true, force: true });
		}
	}
	const token = crypto.randomUUID().replaceAll("-", "");
	const dir = join(root, token);
	mkdirSync(dir, { recursive: true });
	return { token, dir };
}

/** The staging folder of a token, or null when it is unknown, malformed or gone. */
export function stagedDir(dataDir: string, area: string, token: string): string | null {
	if (!TOKEN.test(token)) {
		return null;
	}
	const dir = join(areaDir(dataDir, area), token);
	return existsSync(dir) ? dir : null;
}

/** Drops the staging folder of a token (applied, or not wanted). */
export function discardStaged(dataDir: string, area: string, token: string): void {
	const dir = stagedDir(dataDir, area, token);
	if (dir) {
		rmSync(dir, { recursive: true, force: true });
	}
}
