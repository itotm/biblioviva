// SPDX-License-Identifier: GPL-3.0-or-later
// The administration dictionaries load only on the pages that use them (step 9.2): no page outside
// those routes may use their keys, or it would show the raw key.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { NAMESPACE_ROUTES } from "./index.js";

const ROUTES = new URL("../../routes/", import.meta.url).pathname;

function pages(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		return statSync(path).isDirectory() ? pages(path) : entry.endsWith(".svelte") ? [path] : [];
	});
}

/** The URL of a route file, without its groups: `(app)/patrons/[id]/+page.svelte` → `/patrons/1`. */
function urlOf(file: string): string {
	const parts = relative(ROUTES, file)
		.split("/")
		.slice(0, -1)
		.filter((p) => !/^\(.*\)$/.test(p))
		.map((p) => (/^\[.*\]$/.test(p) ? "1" : p));
	return `/${parts.join("/")}`;
}

describe("dictionaries by route", () => {
	for (const [namespace, routes] of Object.entries(NAMESPACE_ROUTES)) {
		it(`${namespace} keys are used only where they load`, () => {
			const outside = pages(ROUTES)
				.filter((f) => !(routes ?? []).some((r) => r.test(urlOf(f))))
				.filter((f) =>
					new RegExp(`t\\(["'\`]${namespace}\\.`).test(readFileSync(f, "utf8")),
				)
				.map((f) => relative(ROUTES, f));
			expect(outside).toEqual([]);
		});
	}
});
