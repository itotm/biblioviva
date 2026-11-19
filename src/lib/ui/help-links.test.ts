// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS } from "#lib/shared/theme-palette.js";
import { PROBLEM_FINDINGS } from "#lib/shared/install-check.js";
import { CHECKLIST_HELP, CHECKLIST_TEST_HELP } from "./help-checklist.js";
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
import { HELP_SPOTS, importSpot } from "./help-spots.js";
import { allHelpTargets } from "./help-targets.js";

const APP_ROUTES = join("src", "routes", "(app)");
const CONFIG_SECTIONS_PAGE_FOR_TEST = "admin/screens/configuration/";

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
	if (head === "help") {
		return join(root, "help", `${parts.at(-1)}.md`);
	}
	if (head === "install") {
		return join(root, "setup", `${parts.at(-1)}.md`);
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

/** Every target of the tables: the sections of the settings, the installation check and the small help icons. */
function allTargets(): [string, HelpTarget][] {
	const check = [
		...Object.entries(CHECKLIST_HELP).map(([k, t]): [string, HelpTarget] => [`check ${k}`, t]),
		...Object.entries(CHECKLIST_TEST_HELP).map(([k, t]): [string, HelpTarget] => [
			`check test ${k}`,
			t,
		]),
	];
	const screens = Object.entries(SCREEN_HELP).flatMap(([route, entry]) =>
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
	const spots = Object.entries(HELP_SPOTS).map(([key, target]): [string, HelpTarget] => [
		`spot ${key}`,
		target,
	]);
	return [...screens, ...check, ...spots];
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

	it("explain every finding of the installation check that is not green", () => {
		expect(Object.keys(CHECKLIST_HELP).sort()).toEqual([...PROBLEM_FINDINGS].sort());
	});

	it("name the sections of every setting", () => {
		const keys = readFileSync("docs/en/admin/screens/configuration.md", "utf8");
		expect(keys).toContain("### Library and school");
		expect(Object.keys(CONFIG_SECTION_ANCHORS)).toHaveLength(18);
	});

	it("list every target for the check of the documentation", () => {
		const targets = allHelpTargets();
		// the entries of the table, the sections of the settings once each, the page of every area, the
		// small help icons and the links of the installation check
		const spotsAndChecks = [
			...Object.values(HELP_SPOTS),
			...Object.values(CHECKLIST_HELP),
			...Object.values(CHECKLIST_TEST_HELP),
		].filter((t) => t.page === CONFIG_SECTIONS_PAGE_FOR_TEST).length;
		expect(targets.filter((t) => t.page === CONFIG_SECTIONS_PAGE_FOR_TEST)).toHaveLength(
			Object.keys(CONFIG_SECTION_ANCHORS).length + 2 + spotsAndChecks,
		);
		for (const spot of Object.values(HELP_SPOTS)) {
			expect(targets).toContainEqual(spot);
		}
		for (const page of Object.values(HELP_PAGES)) {
			expect(targets).toContainEqual({ page });
		}
		expect(targets).toContainEqual({ page: "manual/checkin/" });
		expect(targets).toContainEqual({
			page: "admin/screens/configuration/",
			anchor: { it: "prestiti", en: "loans" },
		});
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

	it("open the section of a trickier part of a page, in the documentation's language", () => {
		const it = docsBase("it");
		const en = docsBase("en");
		expect(helpHref(it, HELP_SPOTS.fastAddCode)).toBe(
			"https://docs.biblioviva.org/it/manual/new-book/#passo-codice",
		);
		expect(helpHref(en, HELP_SPOTS.fastAddCode)).toBe(
			"https://docs.biblioviva.org/en/manual/new-book/#code-step",
		);
		expect(helpHref(it, HELP_SPOTS.coverCapture)).toBe(
			"https://docs.biblioviva.org/it/guide/add-a-cover/#fotografare-o-caricare-la-copertina",
		);
	});

	it("have a spot for every step of every import", () => {
		for (const kind of ["catalog", "students", "teachers", "loans"] as const) {
			for (const step of ["upload", "mapping", "preview", "done"] as const) {
				expect(HELP_SPOTS[importSpot(kind, step)].page).toMatch(/^admin\/guides\/import-/);
			}
		}
	});

	it("give every spot a section of its page", () => {
		const bare = Object.entries(HELP_SPOTS)
			.filter(([, target]) => !("anchor" in target))
			.map(([key]) => key);
		expect(bare).toEqual([]);
	});
});
