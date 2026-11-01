// SPDX-License-Identifier: GPL-3.0-or-later
// docs/navigation.md (PLAN.md step 9.11) stays in sync with the routes: every page and every print
// page is in its route index, and the index names no route that no longer exists.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url).pathname;
const ROUTES = join(ROOT, "src/routes");

function files(dir: string, name: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		return statSync(path).isDirectory() ? files(path, name) : entry === name ? [path] : [];
	});
}

/** `src/routes/(app)/catalog/[id]/+page.svelte` → `/catalog/[id]` (groups left out). */
function routeOf(file: string): string {
	const segments = relative(ROUTES, file)
		.split("/")
		.slice(0, -1)
		.filter((s) => !/^\(.+\)$/.test(s));
	return `/${segments.join("/")}`;
}

describe("navigation map", () => {
	const pages = files(ROUTES, "+page.svelte").map(routeOf);
	const prints = files(join(ROUTES, "(print)"), "+server.ts").map(routeOf);
	const documented = [
		...readFileSync(join(ROOT, "docs/navigation.md"), "utf8").matchAll(/^\| `([^`]+)` \|/gm),
	].map((m) => m[1] ?? "");

	it("finds the routes and the index", () => {
		expect(pages.length).toBeGreaterThan(30);
		expect(prints.length).toBeGreaterThan(5);
		expect(new Set(documented).size).toBe(documented.length);
	});

	it("lists every page and print page", () => {
		expect([...pages, ...prints].filter((r) => !documented.includes(r))).toEqual([]);
	});

	it("names no route that does not exist", () => {
		expect(documented.filter((r) => !pages.includes(r) && !prints.includes(r))).toEqual([]);
	});
});
