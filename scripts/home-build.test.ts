// SPDX-License-Identifier: GPL-3.0-or-later
// The home page of biblioviva.org (scripts/home-build.ts): both languages built, the English page
// the same markup as the Italian one, every macro and address resolved, only links to the sites
// that are online, the Italian page sending other languages to the English one.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { ADDRESSES, buildHome, homePage, ONLINE, shotLibrary } from "./home-build.js";

/** The page's elements and their classes, in order: the markup without the words. */
function skeleton(html: string): string[] {
	return [...html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*?(?:class="([^"]*)")?[^>]*>/g)].map(
		(m) => `${m[1] ?? ""}.${m[2] ?? ""}`,
	);
}

/** A folder of pictures laid out like `site/.shots/` (`<lang>/<area>/<name>.webp`), with the pictures
 * the Italian page asks for (when `names` is given, only those; nothing for an empty list). */
function shotsFolder(langs: string[], names?: string[]): string {
	const dir = mkdtempSync(join(tmpdir(), "bv-home-shots-"));
	const wanted =
		names ??
		[
			...readFileSync(new URL("../home/it.html", import.meta.url), "utf8").matchAll(
				/\[\[shot:([^|\]]+)\|/g,
			),
		].map((m) => m[1] ?? "");
	for (const lang of langs) {
		for (const name of wanted) {
			const file = join(dir, lang, `${name}.webp`);
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, `picture ${lang} ${name}`);
		}
	}
	return dir;
}

describe("home page", () => {
	const bare = (): ReturnType<typeof shotLibrary> => shotLibrary(shotsFolder([], []));
	const it_ = homePage("it", bare());
	const en = homePage("en", bare());

	it("builds both languages, with every macro and address resolved", () => {
		for (const page of [it_, en]) {
			expect(page).not.toMatch(/\[\[|\{\{|\}\}/);
			for (const [, icon] of page.matchAll(/<use href="#(i-[a-z0-9-]+)"/g)) {
				expect(page).toContain(`<symbol id="${icon ?? ""}"`);
			}
		}
		expect(it_).toContain('<html lang="it">');
		expect(en).toContain('<html lang="en">');
		expect([...buildHome(bare()).keys()].sort()).toEqual([
			"base.css",
			"en/index.html",
			"fonts/fonts.css",
			"fonts/inter-latin-ext-wght-italic.woff2",
			"fonts/inter-latin-ext-wght-normal.woff2",
			"fonts/inter-latin-wght-italic.woff2",
			"fonts/inter-latin-wght-normal.woff2",
			"fonts/jetbrains-mono-latin-ext-wght-normal.woff2",
			"fonts/jetbrains-mono-latin-wght-normal.woff2",
			"home.css",
			"index.html",
			"logo.webp",
		]);
	});

	it("keeps the English page a mirror of the Italian one", () => {
		const body = (page: string): string => page.slice(page.indexOf("<body"));
		expect(skeleton(body(en))).toEqual(skeleton(body(it_)));
		expect(it_).toContain(
			'<div class="lang" role="group" aria-label="Lingua"><svg class="i" aria-hidden="true"><use href="#i-globe"/></svg><a href="/" aria-current="true">IT</a><a href="/en/" hreflang="en" lang="en">EN</a></div>',
		);
		expect(en).toContain(
			'<a href="/" hreflang="it" lang="it">IT</a><a href="/en/" aria-current="true">EN</a>',
		);
	});

	it("links only to the site, the demo and the sites that are online", () => {
		const hosts = ["biblioviva\\.org", "demo\\.biblioviva\\.org"];
		if (ONLINE.docs) {
			hosts.push("docs\\.biblioviva\\.org");
		}
		if (ONLINE.repo) {
			hosts.push("github\\.com\\/itotm\\/biblioviva");
		}
		const allowed = new RegExp(
			`^(#[\\w-]+|\\/|\\/en\\/|(\\.\\.\\/)?(base|home|fonts\\/fonts)\\.css|(\\.\\.\\/)?logo\\.webp|https:\\/\\/(${hosts.join("|")})\\b.*)$`,
		);
		for (const page of [it_, en]) {
			for (const [, href] of page.matchAll(/href="([^"]*)"/g)) {
				expect(href).toMatch(allowed);
			}
			expect(page).toContain(`href="${ADDRESSES.demo}"`);
			if (ONLINE.docs) {
				expect(page).toContain(
					`href="${ADDRESSES.docs}/${page === en ? "en" : "it"}/install/"`,
				);
			}
		}
	});

	it("sends the Italian page to the English one by the cookie of biblioviva.org or the browser's language", () => {
		const script = /<head>[\s\S]*?<script>([\s\S]*?)<\/script>/.exec(it_)?.[1] ?? "";
		expect(en).not.toContain(script);
		const go = (
			languages: string[],
			stored: string | null,
			userAgent = "Mozilla/5.0",
		): string | null => {
			let target: string | null = null;
			runInNewContext(script, {
				document: { cookie: stored === null ? "other=1" : `other=1; bv_lang=${stored}` },
				navigator: { languages, language: languages[0], userAgent },
				location: { replace: (to: string) => (target = to) },
			});
			return target;
		};
		expect(go(["it-IT", "en-US"], null)).toBeNull();
		expect(go(["de-DE", "it"], null)).toBeNull();
		expect(go(["en-GB", "it"], null)).toBe("en/");
		expect(go(["de-DE"], null)).toBe("en/");
		expect(go(["en-US"], "it")).toBeNull();
		expect(go(["it-IT"], "en")).toBe("en/");
		expect(go(["en-US"], null, "Mozilla/5.0 (compatible; Googlebot/2.1)")).toBeNull();
	});
});

describe("screens from the documentation's pictures", () => {
	const shot = /<div class="wf wf-desktop wf-shot"[^>]*>.*?<img ([^>]*)>/gs;
	const images = (html: string): string[] => [...html.matchAll(shot)].map((m) => m[1] ?? "");

	it("shows the picture in the browser frame and copies it to the site", () => {
		const library = shotLibrary(shotsFolder(["it"]));
		const page = homePage("it", library);
		const found = images(page);
		expect(found).toHaveLength(4);
		expect(found[0]).toBe(
			'src="shots/it/catalog/new-book-form.webp" width="1280" height="800" alt="Nuovo libro" loading="lazy" decoding="async"',
		);
		expect(page).toContain("wf-url");
		expect(library.missing.size).toBe(0);
		const files = buildHome(library);
		expect(files.get("shots/it/catalog/new-book-form.webp")).toEqual(
			new TextEncoder().encode("picture it catalog/new-book-form"),
		);
		expect([...files.keys()].filter((k) => k.startsWith("shots/"))).toHaveLength(4);
	});

	it("takes the English page's picture in English, or else the Italian one", () => {
		const only = shotLibrary(shotsFolder(["it"]));
		const fallback = images(homePage("en", only))[0];
		expect(fallback).toContain('src="../shots/it/catalog/new-book-form.webp"');
		expect(fallback).toContain('alt="New book"');
		const both = shotLibrary(shotsFolder(["it", "en"]));
		expect(images(homePage("en", both))[0]).toContain(
			'src="../shots/en/catalog/new-book-form.webp"',
		);
		expect(images(homePage("it", both))[0]).toContain(
			'src="shots/it/catalog/new-book-form.webp"',
		);
	});

	it("draws the screen when the picture is missing, and says which", () => {
		const library = shotLibrary(shotsFolder(["it"], ["catalog/new-book-form"]));
		const page = homePage("it", library);
		expect(images(page)).toHaveLength(1);
		expect(page).toContain('<div class="wf wf-desktop" style="--area:var(--c-pat)">');
		expect([...library.missing].sort()).toEqual([
			"catalog/inventory-empty",
			"census/start",
			"reports/library",
		]);
		expect([...buildHome(library).keys()].filter((k) => k.startsWith("shots/"))).toEqual([
			"shots/it/catalog/new-book-form.webp",
		]);
	});

	it("keeps both pages mirrors with and without the pictures", () => {
		const body = (page: string): string => page.slice(page.indexOf("<body"));
		for (const names of [undefined, []]) {
			const library = shotLibrary(shotsFolder(["it"], names));
			expect(skeleton(body(homePage("en", library)))).toEqual(
				skeleton(body(homePage("it", library))),
			);
		}
	});
});

describe("link to the installation guide under the four steps", () => {
	const guide = (lang: "it" | "en"): string[] => {
		const section = /<section class="h-sec alt" id="installa">[\s\S]*?<\/section>/.exec(
			homePage(lang),
		)?.[0];
		return [...(section ?? "").matchAll(/<a [^>]*>/g)].map((m) => m[0]);
	};
	const withSites = (docs: boolean, repo: boolean, run: () => void): void => {
		const before = { ...ONLINE };
		Object.assign(ONLINE, { docs, repo });
		try {
			run();
		} finally {
			Object.assign(ONLINE, before);
		}
	};

	it("points to the installation section of the documentation while it is online", () => {
		for (const repo of [false, true]) {
			withSites(true, repo, () => {
				for (const lang of ["it", "en"] as const) {
					expect(guide(lang)).toEqual([
						`<a class="pill pill-blue" href="${ADDRESSES.docs}/${lang}/install/">`,
					]);
				}
			});
		}
	});

	it("points to the guide in the repository while only the repository is online", () => {
		withSites(false, true, () => {
			for (const lang of ["it", "en"] as const) {
				expect(guide(lang)).toEqual([
					`<a class="pill pill-blue" href="${ADDRESSES.repo}/blob/main/docs/${lang}/setup/README.md" rel="external">`,
				]);
			}
		});
	});

	it("shows no link while neither site is online", () => {
		withSites(false, false, () => {
			expect(guide("it")).toEqual([]);
			expect(guide("en")).toEqual([]);
		});
	});

	it("keeps the two languages mirrors in every state", () => {
		for (const [docs, repo] of [
			[true, false],
			[false, true],
			[true, true],
			[false, false],
		] as const) {
			withSites(docs, repo, () => {
				const body = (page: string): string => page.slice(page.indexOf("<body"));
				expect(skeleton(body(homePage("en")))).toEqual(skeleton(body(homePage("it"))));
			});
		}
	});
});
