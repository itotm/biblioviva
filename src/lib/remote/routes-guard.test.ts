// SPDX-License-Identifier: GPL-3.0-or-later
// Static check (PLAN.md step 9.1): every endpoint (`+server.ts`) and every page loader under the
// app, print and admin groups asks for a session or a permission itself, besides the redirect of
// `hooks.server.ts` — so a mistake in the list of public paths never opens one. The health check
// and the web app manifest (name and colours only, step 9.9) are the only public endpoints.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES = new URL("../../routes/", import.meta.url).pathname;
const PUBLIC = new Set(["healthz/+server.ts", "manifest.webmanifest/+server.ts"]);

function files(dir: string, name: RegExp): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		return statSync(path).isDirectory() ? files(path, name) : name.test(entry) ? [path] : [];
	});
}

describe("endpoints and page loaders are guarded", () => {
	const endpoints = files(ROUTES, /^\+server\.ts$/).map((f) => relative(ROUTES, f));

	it("finds the endpoints", () => {
		expect(endpoints.length).toBeGreaterThan(20);
	});

	it.each(endpoints.filter((f) => !PUBLIC.has(f)))("%s asks for a permission", (file) => {
		const source = readFileSync(join(ROUTES, file), "utf8");
		const handlers = [...source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)];
		expect(handlers.length, file).toBeGreaterThan(0);
		for (const h of handlers) {
			const body = source.slice(h.index);
			const guard = body.search(/requirePermission\(|requireAnyPermission\(|requireUser\(/);
			const next = body.slice(1).search(/\nexport const /);
			expect(guard, `${file} ${h[1]}`).toBeGreaterThan(-1);
			if (next !== -1) {
				expect(guard, `${file} ${h[1]}: guard inside the handler`).toBeLessThan(next + 1);
			}
		}
	});

	const loaders = files(ROUTES, /^\+(page|layout)\.server\.ts$/)
		.map((f) => relative(ROUTES, f))
		.filter((f) => f.startsWith("(app)/admin/") || f.startsWith("(print)/"));
	it.each(loaders)("%s asks for a permission", (file) => {
		const source = readFileSync(join(ROUTES, file), "utf8");
		expect(source, file).toMatch(/requirePermission\(|requireUser\(|can\(locals\.user/);
	});
});
