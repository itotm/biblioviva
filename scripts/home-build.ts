// SPDX-License-Identifier: GPL-3.0-or-later
// The home page of biblioviva.org (PLAN.md 9.7, §3.23, ADR-039): `bun run home:build` turns the
// two pages of `home/` (`it.html`, `en.html`, the same markup in each language) into plain files
// in `home/dist/` — `/` in Italian, `/en/` in English — and the same files in `home/biblioviva-home.zip`,
// uploaded by hand to a static host (Cloudflare Pages, direct upload). The
// pages carry macros: `[[icon:name]]` an inline Lucide icon (one sprite per page), `[[words:…]]`
// the sentence that lights up word by word, `[[shot:name|title|area|view]]` a computer screen shown
// by the documentation's picture `site/.shots/<lang>/<name>.webp` (made by `bun run docs:shots`; the
// Italian one when the language has none), drawn as `[[wfd:area|view|title]]` when the picture is
// missing, `[[wfp:…]]` a drawn phone screen, `[[lang]]` the language switch, `[[shelfmini]]` four spines with their bands, `[[site:docs]]…[[/site]]`
// a piece kept only while that site is online (`ONLINE`; `[[site:!docs]]` a piece kept only while
// it is not), and `{{home}}`, `{{other}}`, `{{docs}}`, `{{setup}}`, `{{demo}}`, `{{repo}}` the
// addresses of the site. The Italian page sends a visitor whose browser
// prefers another language to `/en/`, unless they chose a language with a switch of biblioviva.org
// (the cookie `bv_lang`, ADR-047).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { webFonts } from "./web-fonts.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "home");
const LUCIDE = join(ROOT, "node_modules/@lucide/svelte/dist/icons");
const SHOTS = join(ROOT, "site/.shots");
/** The size of the documentation's computer pictures (`docs:shots`, window "computer"). */
const SHOT_SIZE = { width: 1280, height: 800 } as const;

export const LANGS = ["it", "en"] as const;
export type HomeLang = (typeof LANGS)[number];

/** Where each language lives on the site, and the other language's page. */
const PATHS: Record<HomeLang, string> = { it: "/", en: "/en/" };
export const ADDRESSES = {
	site: "https://biblioviva.org",
	docs: "https://docs.biblioviva.org",
	demo: "https://demo.biblioviva.org",
	repo: "https://github.com/itotm/biblioviva",
} as const;

/** The sites that are online: the links to the others are left out of the pages. */
export const ONLINE: Record<"docs" | "repo", boolean> = { docs: true, repo: true };

// The language the visitor chose with a switch of biblioviva.org (the home page, the documentation, the
// public demo), kept in the cookie `bv_lang` they share (ADR-047); without it the browser's first
// language between Italian and English decides, any other language reads English. Crawlers stay on
// the Italian page.
const PICK_LANG = `<script>
(() => {
	const chosen = /(?:^|; )bv_lang=([^;]*)/.exec(document.cookie)?.[1] ?? null;
	if (chosen === null && /bot|crawl|spider|slurp/i.test(navigator.userAgent)) {
		return;
	}
	const first = (navigator.languages ?? [navigator.language])
		.map((l) => l.slice(0, 2).toLowerCase())
		.find((l) => l === "it" || l === "en");
	if ((chosen ?? (first === "it" ? "it" : "en")) === "en") {
		location.replace("en/");
	}
})();
</script>`;

// The GitHub mark (Octicons, MIT): Lucide has no brand logos.
const GITHUB = `<symbol id="i-github" viewBox="0 0 16 16"><path fill="currentColor" stroke="none" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></symbol>`;

/** The `<symbol>` of a Lucide icon, read from the package the app uses. */
function iconSymbol(name: string): string {
	if (name === "github") {
		return GITHUB;
	}
	let file = join(LUCIDE, `${name}.svelte`);
	if (!existsSync(file)) {
		const alias = /from ["']\.\/([^"']+)\.svelte["']/.exec(
			readFileSync(join(LUCIDE, `${name}.js`), "utf8"),
		);
		if (!alias) {
			throw new Error(`icon ${name} not found`);
		}
		file = join(LUCIDE, `${alias[1] ?? ""}.svelte`);
	}
	const json = /__iconData = (\{.*?\});\n/s.exec(readFileSync(file, "utf8"));
	if (!json) {
		throw new Error(`icon ${name}: no data`);
	}
	const data = JSON.parse(json[1] ?? "{}") as { node: [string, Record<string, string>][] };
	const children = data.node
		.map(([tag, attrs]) => {
			const a = Object.entries(attrs)
				.filter(([k]) => k !== "key")
				.map(([k, v]) => `${k}="${v}"`)
				.join(" ");
			return `<${tag} ${a}/>`;
		})
		.join("");
	return `<symbol id="i-${name}" viewBox="0 0 24 24">${children}</symbol>`;
}

/** The icons of a page as `<use>` of one sprite, written once at the top of the body. */
function icons(html: string): { html: string; sprite: string } {
	const used = new Set<string>();
	const out = html.replace(/\[\[icon:([a-z0-9-]+)\]\]/g, (_m, name: string) => {
		used.add(name);
		return `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
	});
	const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${[...used].map(iconSymbol).join("")}</svg>`;
	return { html: out, sprite };
}

// ---------------------------------------------------------------- the documentation's pictures

/** The pictures of the documentation the pages use: where they are, the ones read so far (by their
 * path in `home/dist/`) and the names of the ones that were asked for and are not there. */
export interface ShotLibrary {
	dir: string;
	used: Map<string, Uint8Array>;
	missing: Set<string>;
}

export function shotLibrary(dir: string = SHOTS): ShotLibrary {
	return { dir, used: new Map(), missing: new Set() };
}

/** The picture of a screen for a language, as its path in the site: the language's own picture, or
 * the Italian one; `null` when there is none. The file is read once and goes into the site. */
function shotPath(library: ShotLibrary, lang: HomeLang, name: string): string | null {
	for (const l of lang === "it" ? ["it"] : [lang, "it"]) {
		const path = `shots/${l}/${name}.webp`;
		if (library.used.has(path)) {
			return path;
		}
		const file = join(library.dir, l, `${name}.webp`);
		if (existsSync(file)) {
			library.used.set(path, new Uint8Array(readFileSync(file)));
			return path;
		}
	}
	return null;
}

// ---------------------------------------------------------------- drawn screens

const lines = (n: number, cls = ""): string =>
	Array.from(
		{ length: n },
		(_, i) =>
			`<span class="wf-line ${cls}" style="--w:${String([92, 74, 85, 60, 78, 68][i % 6])}%"></span>`,
	).join("");

function wfDesktopBody(view: string): string {
	switch (view) {
		case "dash":
			return `<div class="wf-tiles">${["circ", "cat", "pat", "rep"].map((a) => `<div class="wf-tile" style="--a:var(--c-${a})"><span class="wf-dot"></span><b></b><span class="wf-line" style="--w:60%"></span></div>`).join("")}</div><div class="wf-cols"><div class="wf-card">${lines(4)}</div><div class="wf-card">${lines(3)}<span class="wf-chip ok"></span></div></div>`;
		case "grid":
			return `<div class="wf-scan"><span class="wf-line" style="--w:55%"></span></div><div class="wf-pills"><span></span><span></span><span></span></div><div class="wf-card wf-table">${Array.from({ length: 6 }, () => `<div class="wf-row">${lines(4)}</div>`).join("")}</div>`;
		case "form":
			return `<div class="wf-cols wf-cols-form"><div class="wf-card">${Array.from({ length: 5 }, () => `<div class="wf-field"><span class="wf-line" style="--w:30%"></span><span class="wf-input"></span></div>`).join("")}</div><div class="wf-card wf-cover"><span></span></div></div>`;
		default:
			return `<div class="wf-card">${lines(6)}</div>`;
	}
}

function wfDesktop(area: string, view: string, title: string): string {
	return `<div class="wf wf-desktop" style="--area:var(--c-${area})"><div class="wf-chrome"><i></i><i></i><i></i><span class="wf-url">biblioviva.scuola.ts.net</span></div><div class="wf-app"><div class="wf-side">${Array.from({ length: 7 }, (_, i) => `<span class="${i === 0 ? "on" : ""}"></span>`).join("")}</div><div class="wf-main"><div class="wf-top"><span class="wf-back"></span><span class="wf-title">${title}</span><span class="wf-search"></span></div><div class="wf-body">${wfDesktopBody(view)}</div></div></div></div>`;
}

/** A computer screen: the browser's frame around the documentation's picture. */
function shotScreen(area: string, src: string, title: string): string {
	const alt = title.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
	return `<div class="wf wf-desktop wf-shot" style="--area:var(--c-${area})"><div class="wf-chrome"><i></i><i></i><i></i><span class="wf-url">biblioviva.scuola.ts.net</span></div><img src="${src}" width="${String(SHOT_SIZE.width)}" height="${String(SHOT_SIZE.height)}" alt="${alt}" loading="lazy" decoding="async"></div>`;
}

function wfPhone(area: string, view: string, title: string): string {
	const desk =
		view === "desk"
			? `<div class="wf-scan"><span class="wf-scan-ico"></span><span class="wf-line" style="--w:50%"></span></div><div class="wf-msg ok"><span></span>${lines(2)}</div>`
			: "";
	return `<div class="wf wf-phone" style="--area:var(--c-${area})"><div class="wf-notch"></div><div class="wf-top"><span class="wf-back"></span><span class="wf-title">${title}</span></div><div class="wf-body">${desk}<div class="wf-card">${lines(view === "grid" ? 6 : 4)}</div><div class="wf-card">${lines(3)}</div></div><div class="wf-bottom"><span class="on"></span><span></span><span></span><span></span></div></div>`;
}

const SHELF: [colour: string, mark: string, icon: string, height: number][] = [
	["#4c66d3", "B<br>4<br>DEL", "book-heart", 230],
	["#009874", "590<br>ROS", "compass", 260],
	["#a3215a", "G<br>ROD", "sparkles", 210],
	["#948600", "920<br>LEV", "map", 280],
];

/** The pieces of the sites that are not online taken out (and, for `[[site:!name]]`, the pieces of
 * the sites that are), the innermost first (they nest). */
function onlineOnly(body: string): string {
	const innermost = /\[\[site:(!?)(\w+)\]\]((?:(?!\[\[site:)[\s\S])*?)\[\[\/site\]\]/g;
	let out = body;
	for (let before = ""; before !== out;) {
		before = out;
		out = out.replace(innermost, (_x, not: string, site: string, piece: string) => {
			if (!(site in ONLINE)) {
				throw new Error(`unknown site [[site:${site}]]`);
			}
			return ONLINE[site as keyof typeof ONLINE] !== (not === "!") ? piece : "";
		});
	}
	return out;
}

/** The language switch of the header, the same as the documentation's: the globe, then each language. */
function langSwitch(lang: HomeLang): string {
	const links = LANGS.map((l) =>
		l === lang
			? `<a href="${PATHS[l]}" aria-current="true">${l.toUpperCase()}</a>`
			: `<a href="${PATHS[l]}" hreflang="${l}" lang="${l}">${l.toUpperCase()}</a>`,
	).join("");
	return `<div class="lang" role="group" aria-label="${lang === "it" ? "Lingua" : "Language"}">[[icon:globe]]${links}</div>`;
}

function macros(body: string, lang: HomeLang, library: ShotLibrary): string {
	const up = lang === "it" ? "" : "../";
	return onlineOnly(body)
		.replace("[[lang]]", () => langSwitch(lang))
		.replace("[[shelfmini]]", () =>
			SHELF.map(
				([c, t, i, h]) =>
					`<div class="spine" style="--bc:${c};--h:${String(h)}px;--w:58px"><div class="band">[[icon:${i}]]${t}</div></div>`,
			).join(""),
		)
		.replace(/\[\[words:([^\]]+)\]\]/g, (_x, text: string) => {
			const words = text.split(" ");
			return `<span class="words" style="--wn:${String(words.length)}">${words.map((w, i) => `<span style="--i:${String(i)}">${w}</span>`).join(" ")}</span>`;
		})
		.replace(/\[\[shot:([^\]]+)\]\]/g, (_x, spec: string) => {
			const [name = "", title = "", area = "circ", view = "dash"] = spec.split("|");
			const path = shotPath(library, lang, name);
			if (path === null) {
				library.missing.add(name);
				return wfDesktop(area, view, title);
			}
			return shotScreen(area, up + path, title);
		})
		.replace(/\[\[wfd:([^\]]+)\]\]/g, (_x, spec: string) => {
			const [area = "circ", view = "dash", title = ""] = spec.split("|");
			return wfDesktop(area, view, title);
		})
		.replace(/\[\[wfp:([^\]]+)\]\]/g, (_x, spec: string) => {
			const [area = "circ", view = "dash", title = ""] = spec.split("|");
			return wfPhone(area, view, title);
		});
}

// ---------------------------------------------------------------- pages

interface Meta {
	title: string;
	description: string;
}

/** The finished page of one language: head, sprite, body, the script of the scroll effects. */
export function homePage(lang: HomeLang, library: ShotLibrary = shotLibrary()): string {
	const src = readFileSync(join(SOURCE, `${lang}.html`), "utf8");
	const m = /^<!--meta (\{.*?\}) -->\n/s.exec(src);
	if (!m) {
		throw new Error(`home/${lang}.html: no meta line`);
	}
	const meta = JSON.parse(m[1] ?? "{}") as Meta;
	const other: HomeLang = lang === "it" ? "en" : "it";
	const up = lang === "it" ? "" : "../";
	const addresses: Record<string, string> = {
		home: PATHS[lang],
		other: PATHS[other],
		docs: `${ADDRESSES.docs}/${lang}/`,
		// the installation guide as files in the repository, for while the documentation is not online
		setup: `${ADDRESSES.repo}/blob/main/docs/${lang}/setup/README.md`,
		demo: ADDRESSES.demo,
		repo: ADDRESSES.repo,
	};
	const body = macros(src.slice(m[0].length), lang, library).replace(
		/\{\{(\w+)\}\}/g,
		(_x, key: string) => {
			const value = addresses[key];
			if (value === undefined) {
				throw new Error(`home/${lang}.html: unknown address {{${key}}}`);
			}
			return value;
		},
	);
	const alternates = LANGS.map(
		(l) => `<link rel="alternate" hreflang="${l}" href="${ADDRESSES.site}${PATHS[l]}">`,
	).join("\n");
	const skip = lang === "it" ? "Vai al contenuto" : "Skip to content";
	const page = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${lang === "it" ? `\n${PICK_LANG}` : ""}
<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
<link rel="canonical" href="${ADDRESSES.site}${PATHS[lang]}">
${alternates}
<link rel="icon" href="${up}logo.webp" type="image/webp">
<link rel="stylesheet" href="${up}fonts/fonts.css">
<link rel="stylesheet" href="${up}base.css">
<link rel="stylesheet" href="${up}home.css">
</head>
<body class="layout-home">
<!--SPRITE-->
<a class="skip" href="#main">${skip}</a>
${body.replaceAll('src="logo.webp"', `src="${up}logo.webp"`)}
<script>
${readFileSync(join(SOURCE, "home.js"), "utf8").trim()}
</script>
</body>
</html>
`;
	const { html, sprite } = icons(page);
	return html.replace("<!--SPRITE-->", sprite);
}

/** Every file of the site, by its path in `home/dist/`. */
export function buildHome(library: ShotLibrary = shotLibrary()): Map<string, string | Uint8Array> {
	const files = new Map<string, string | Uint8Array>();
	files.set("index.html", homePage("it", library));
	files.set("en/index.html", homePage("en", library));
	for (const asset of ["base.css", "home.css"]) {
		files.set(asset, readFileSync(join(SOURCE, asset), "utf8"));
	}
	files.set("logo.webp", new Uint8Array(readFileSync(join(SOURCE, "logo.webp"))));
	for (const [path, bytes] of webFonts()) {
		files.set(path, bytes);
	}
	for (const [path, picture] of library.used) {
		files.set(path, picture);
	}
	return files;
}

if (import.meta.main) {
	const out = join(SOURCE, "dist");
	rmSync(out, { recursive: true, force: true });
	const library = shotLibrary();
	const files = buildHome(library);
	for (const name of library.missing) {
		console.warn(
			`home: no picture for ${name} in site/.shots/ (run \`bun run docs:shots\`): the screen is drawn`,
		);
	}
	const zip: Record<string, Uint8Array> = {};
	for (const [path, content] of files) {
		const target = join(out, path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, content);
		zip[path] = typeof content === "string" ? new TextEncoder().encode(content) : content;
	}
	writeFileSync(join(SOURCE, "biblioviva-home.zip"), zipSync(zip, { level: 9 }));
	console.log(`home: ${String(files.size)} files in home/dist/ and home/biblioviva-home.zip`);
}
