// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS } from "#lib/shared/theme-palette.js";
import {
	CONFIG_SECTION_ANCHORS,
	DOCS_LANGUAGES,
	docsBase,
	HELP_PAGES,
	helpHref,
	helpTarget,
	SCREEN_HELP,
	type HelpTarget,
} from "./help-links.js";

const APP_ROUTES = join("src", "routes", "(app)");

/** The route id of every page of the app (`/(app)`, `/(app)/patrons/[id]/edit`…). */
function appPageRoutes(): string[] {
	return readdirSync(APP_ROUTES, { recursive: true, encoding: "utf8" })
		.filter((f) => f.endsWith("+page.svelte"))
		.map((f) => {
			const dir = relative(".", join(APP_ROUTES, f, ".."))
				.split(sep)
				.slice(2)
				.join("/");
			return `/${dir}`;
		})
		.sort();
}

/** The Markdown file of a documentation page (the folders of `scripts/site-build.ts`). */
function sourceOf(lang: string, page: string): string {
	const parts = page.replace(/\/$/, "").split("/");
	const root = join("docs", lang);
	const [head = "", name = ""] = parts;
	if (head === "manual") {
		return join(root, "manual", "screens", `${name}.md`);
	}
	if (head === "guide") {
		return join(root, "manual", "guides", `${name}.md`);
	}
	if (head === "admin") {
		return parts.length === 1
			? join(root, "admin", "README.md")
			: join(root, "admin", ...parts.slice(1, -1), `${parts.at(-1)}.md`);
	}
	return join(root, page, "README.md");
}

/** The anchors the site makes from the headings: GitHub's, numbered when repeated. */
function anchorsOf(markdown: string): Set<string> {
	const seen = new Map<string, number>();
	const out = new Set<string>();
	for (const [, text = ""] of markdown.matchAll(/^#{1,6} +(.+?) *#*$/gm)) {
		const base = text
			.replace(/`/g, "")
			.replace(/\*\*/g, "")
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\p{M} _-]/gu, "")
			.replace(/ /g, "-");
		const n = seen.get(base) ?? 0;
		seen.set(base, n + 1);
		out.add(n === 0 ? base : `${base}-${n}`);
	}
	return out;
}

/** Every target of the table, the sections of the settings included. */
function allTargets(): [string, HelpTarget][] {
	return Object.entries(SCREEN_HELP).flatMap(([route, entry]) =>
		typeof entry === "function"
			? [
					...Object.keys(CONFIG_SECTION_ANCHORS).map((key): [string, HelpTarget] => [
						`${route} ${key}`,
						entry({ section: key }),
					]),
					[`${route} (unknown)`, entry({ section: "nothing" })] as [string, HelpTarget],
				]
			: [[route, entry] as [string, HelpTarget]],
	);
}

describe("help links", () => {
	it("open the documentation in the installation's language, English for the others", () => {
		expect(docsBase("it")).toBe("https://docs.biblioviva.org/it/");
		expect(docsBase("en")).toBe("https://docs.biblioviva.org/en/");
		expect(docsBase("de")).toBe("https://docs.biblioviva.org/en/");
		expect(docsBase("it-CH")).toBe("https://docs.biblioviva.org/it/");
	});

	it("have a page for every area and for the dashboard", () => {
		for (const area of AREAS) {
			expect(HELP_PAGES[area]).toMatch(/^[a-z-]+\/([a-z-]+\/)?$/);
		}
	});

	it("open the page of the screen in sight, at its section, in the documentation's language", () => {
		const it = docsBase("it");
		const en = docsBase("en");
		const de = docsBase("de");
		const checkin = helpTarget("/(app)/circulation/checkin", {}, "circulation");
		expect(helpHref(it, checkin)).toBe("https://docs.biblioviva.org/it/manual/checkin/");
		const newBook = helpTarget("/(app)/cataloging/new", {}, "catalog");
		expect(helpHref(it, newBook)).toBe("https://docs.biblioviva.org/it/manual/new-book/");
		const edit = helpTarget("/(app)/patrons/[id]/edit", { id: "7" }, "patrons");
		expect(helpHref(it, edit)).toBe(
			"https://docs.biblioviva.org/it/manual/patron-record/#modifica-utente",
		);
		expect(helpHref(en, edit)).toBe(
			"https://docs.biblioviva.org/en/manual/patron-record/#edit-patron",
		);
		expect(helpHref(de, edit)).toBe(
			"https://docs.biblioviva.org/en/manual/patron-record/#edit-patron",
		);
		const loans = helpTarget(
			"/(app)/admin/config/[section]",
			{ section: "circulation" },
			"admin",
		);
		expect(helpHref(it, loans)).toBe(
			"https://docs.biblioviva.org/it/admin/screens/configuration/#prestiti",
		);
	});

	it("fall back to the page of the area for a page without an entry", () => {
		const base = docsBase("it");
		expect(helpHref(base, helpTarget("/(app)/somewhere", {}, "circulation"))).toBe(
			"https://docs.biblioviva.org/it/manual/checkout/",
		);
		expect(helpHref(base, helpTarget(null, {}, null))).toBe(
			"https://docs.biblioviva.org/it/manual/dashboard/",
		);
	});

	it("have an entry for every page of the app", () => {
		const routes = appPageRoutes();
		expect(routes).toContain("/(app)");
		expect(routes).toContain("/(app)/circulation/checkin");
		const missing = routes.filter((r) => !(r in SCREEN_HELP));
		expect(missing).toEqual([]);
		const stale = Object.keys(SCREEN_HELP).filter((r) => !routes.includes(r));
		expect(stale).toEqual([]);
	});

	it("name the sections of every setting", () => {
		const keys = readFileSync("docs/en/admin/screens/configuration.md", "utf8");
		expect(keys).toContain("### Library and school");
		expect(Object.keys(CONFIG_SECTION_ANCHORS)).toHaveLength(18);
	});

	it("point at pages and headings that exist in every language of the documentation", () => {
		const broken: string[] = [];
		for (const [route, target] of allTargets()) {
			for (const lang of DOCS_LANGUAGES) {
				const file = sourceOf(lang, target.page);
				if (!existsSync(file)) {
					broken.push(`${route}: ${file} is missing`);
					continue;
				}
				const anchor = target.anchor?.[lang];
				if (anchor && !anchorsOf(readFileSync(file, "utf8")).has(anchor)) {
					broken.push(`${route}: no heading #${anchor} in ${file}`);
				}
			}
		}
		for (const page of Object.values(HELP_PAGES)) {
			for (const lang of DOCS_LANGUAGES) {
				if (!existsSync(sourceOf(lang, page))) {
					broken.push(`area page ${page}: ${sourceOf(lang, page)} is missing`);
				}
			}
		}
		expect(broken).toEqual([]);
	});
});
