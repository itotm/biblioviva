// SPDX-License-Identifier: GPL-3.0-or-later
// The "coming soon" page of the documentation site (steps 1.13, 9.7): self-contained, both
// languages, only the home page, the repository and the licence links point outside.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("documentation site", () => {
	it("publishes a self-contained page under the docs.biblioviva.org domain", () => {
		expect(readFileSync("site/CNAME", "utf8").trim()).toBe("docs.biblioviva.org");
		const html = readFileSync("site/index.html", "utf8");
		expect(html).toMatch(/^<!doctype html>/i);
		expect(html).toContain('lang="it"');
		expect(html).toContain('lang="en"');
		expect(html).toContain("Documentation coming soon");
		const external = [...html.matchAll(/(?:href|src)="(https?:[^"]+)"/g)].map(
			(m) => m[1] ?? "",
		);
		expect(external.length).toBeGreaterThan(0);
		expect(
			external.every(
				(u) =>
					u === "https://biblioviva.org" ||
					u.startsWith("https://github.com/itotm/biblioviva") ||
					u.startsWith("https://www.gnu.org/"),
			),
		).toBe(true);
		// no external stylesheet, script or font
		expect(html).not.toMatch(/<link[^>]+href="https?:/);
		expect(html).not.toMatch(/<script/);
	});
});
