// SPDX-License-Identifier: GPL-3.0-or-later
// Static check (PLAN.md step 1.4): every remote function calls `requireUser(...)` as its first
// statement (or `requireAnyUser([...])`), except the explicit allowlist of unauthenticated functions.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL(".", import.meta.url).pathname;
const ALLOW_UNAUTHENTICATED = new Set(["auth.remote.ts:login", "auth.remote.ts:logout"]);
/** Functions of the first-run wizard: guarded by `requireSetupMode()` instead (404 once completed). */
const ALLOW_SETUP_MODE = new Set([
	"setup.remote.ts:completeSetup",
	"first-run-restore.remote.ts:checkRestoreArchive",
	"first-run-restore.remote.ts:applyRestoreArchive",
	"first-run-restore.remote.ts:discardRestoreArchive",
]);

function remoteFunctions(file: string): { name: string; body: string }[] {
	const source = readFileSync(join(ROOT, file), "utf8");
	const out: { name: string; body: string }[] = [];
	const re = /export const (\w+) = (query|command|form|prerender)\(/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(source))) {
		// body = text up to the next export or end of file
		const rest = source.slice(m.index + m[0].length);
		const next = rest.search(/\nexport const /);
		out.push({ name: m[1] ?? "", body: next === -1 ? rest : rest.slice(0, next) });
	}
	return out;
}

describe("remote functions are guarded", () => {
	const files = readdirSync(ROOT).filter((f) => f.endsWith(".remote.ts"));

	it("finds at least the auth module", () => {
		expect(files).toContain("auth.remote.ts");
	});

	it.each(files)("%s: every handler calls requireUser first or is allowlisted", (file) => {
		const functions = remoteFunctions(file);
		expect(functions.length, `${file} exports no remote function`).toBeGreaterThan(0);
		for (const fn of functions) {
			const key = `${file}:${fn.name}`;
			if (ALLOW_UNAUTHENTICATED.has(key)) {
				continue;
			}
			const guard = ALLOW_SETUP_MODE.has(key)
				? "requireSetupMode("
				: fn.body.includes("requireAnyUser(")
					? "requireAnyUser("
					: "requireUser(";
			expect(fn.body, `${key} must call ${guard}...)`).toContain(guard);
			// the guard must come before any database access
			const guardAt = fn.body.indexOf(guard);
			const dbAt = fn.body.indexOf("getDb(");
			if (dbAt !== -1) {
				expect(guardAt, `${key}: requireUser must precede getDb`).toBeLessThan(dbAt);
			}
		}
	});
});
