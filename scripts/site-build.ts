// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-non-null-assertion -- regex groups and lookups that the patterns and the discovery guarantee */
// The documentation site (PLAN.md §3.23): `bun run site:build` turns the Markdown of `docs/` into plain
// static files in `site/dist/`, in the look of `site/assets/style.css`. Each language has its folder,
// `docs/<lang>/`, with the sections: Manuale (`manual/`), Amministrazione (`admin/`), Installazione (`setup/`:
// pages and, for each path, one page per step) and Aiuto (`help/`); Tecnica is the English documents of
// docs/. Markdown goes through `Bun.markdown.html`;
// a thin layer adds figures, notes (GitHub alerts), variant blocks, the boxes of the guides and the links.
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as pagefind from "pagefind";
import { webFonts } from "./web-fonts.ts";

const ROOT = join(import.meta.dir, "..");
const DOCS = join(ROOT, "docs");
const SITE = join(ROOT, "site");
const DIST = join(SITE, "dist");
const SHOTS = join(SITE, ".shots");
const LUCIDE = join(ROOT, "node_modules", "@lucide", "svelte", "dist", "icons");
const REPO = "https://github.com/itotm/biblioviva";

// ---------------------------------------------------------------- types and texts

type Lang = "it" | "en";
type SectionKey = "manual" | "admin" | "install" | "tech" | "help";
type Kind = "guide" | "screen" | "index" | "page" | "path" | "step" | "tech" | "generated";

interface Page {
	lang: Lang;
	section: SectionKey;
	kind: Kind;
	src: string;
	url: string;
	title: string;
	// Installation: the path a step page belongs to, and its place in it.
	path?: string;
	step?: { n: number; total: number; src: string };
}

interface PathStep {
	n: number;
	src: string;
	slug: string;
	url: string;
}
interface InstallPath {
	slug: string;
	lang: Lang;
	src: string;
	url: string;
	steps: PathStep[];
	keep: string[];
}

interface Rendered {
	title: string;
	lead: string;
	body: string;
	toc: { id: string; text: string }[];
}

interface Ctx {
	lang: Lang;
	src: string;
	path?: InstallPath;
	fig: number;
}

const LANGS: Lang[] = ["it", "en"];
const SECTIONS: SectionKey[] = ["manual", "admin", "install", "help", "tech"];
const COLORS: Record<SectionKey, string> = {
	manual: "var(--s-use)",
	admin: "var(--s-admin)",
	install: "var(--s-install)",
	tech: "var(--s-tech)",
	help: "var(--s-help)",
};
const SECTION_ICONS: Record<SectionKey, string> = {
	manual: "book-open",
	admin: "settings",
	install: "rocket",
	tech: "terminal",
	help: "life-buoy",
};
const SECTION_PATH: Record<SectionKey, string> = {
	manual: "manual",
	admin: "admin",
	install: "install",
	tech: "tech",
	help: "help",
};

// The technical documents of docs/: the same English page under both languages.
const TECH_DOCS: [slug: string, file: string][] = [
	["deploy", "deploy.md"],
	["config-reference", "config-reference.md"],
	["templates-authoring", "templates-authoring.md"],
	["reports-authoring", "reports-authoring.md"],
	["security", "security.md"],
	["performance", "performance.md"],
	["import", "import/README.md"],
];

const TEXT: Record<Lang, Record<string, string>> = {
	it: {
		docs: "Documentazione",
		homeTitle: "Documentazione di BiblioViva",
		manual: "Manuale",
		admin: "Amministrazione",
		install: "Installazione",
		tech: "Tecnica",
		help: "Aiuto",
		onThisPage: "In questa pagina",
		sectionMenu: "Menu della sezione",
		skip: "Vai al contenuto",
		index: "Indice A–Z",
		search: "Cerca",
		searchTitle: "Cerca nella documentazione",
		close: "Chiudi",
		site: "Sito di BiblioViva",
		figure: "Figura",
		note: "Nota",
		important: "Importante",
		warning: "Attenzione",
		missingPicture: "Immagine in preparazione",
		step: "Passo",
		of: "di",
		prev: "Indietro",
		next: "Avanti",
		backToPath: "Torna al percorso",
		pathDone: "Percorso completato",
		overview: "Panoramica",
		guides: "Guide",
		screens: "Schermate",
		choose: "Scegliere",
		paths: "Percorsi",
		after: "Dopo l'installazione",
		other: "Altre pagine",
		pathKicker: "Percorso di installazione",
		guideKicker: "Guida passo passo",
		screenKicker: "Schermata",
		techKicker: "Documentazione tecnica",
		correct: "Proponi una correzione a questa pagina",
		footer: "Software libero GPL-3.0-or-later · Sviluppato con l'aiuto di LLM",
		github: "Codice sorgente su GitHub",
		language: "Lingua",
		sections: "Sezioni",
		goTo: "Vai a",
		homeLead:
			"La documentazione è organizzata per attività. Le guide sono pensate per essere semplici anche per chi usa poco il computer e sono illustrate con le schermate del programma.",
		allPages: "Tutte le pagine della documentazione, in ordine alfabetico.",
		techLead: "Documentazione per chi conosce Docker, Linux e JSON, in inglese.",
		notFound: "Pagina non trovata",
		notFoundLead: "L'indirizzo non corrisponde a nessuna pagina della documentazione.",
		path: "Percorso",
		descManual: "L'uso quotidiano: banco prestiti, catalogo, utenti e stampe.",
		descAdmin: "Account, regole di prestito, classi, backup e attività di fine anno.",
		descInstall:
			"Un percorso guidato, passo per passo, con una verifica alla fine di ogni passo.",
		descTech:
			"Per chi conosce Docker e Linux: distribuzione, configurazione, template e report.",
		descHelp: "Problemi comuni, glossario e come chiedere aiuto.",
	},
	en: {
		docs: "Documentation",
		homeTitle: "BiblioViva documentation",
		manual: "Manual",
		admin: "Administration",
		install: "Installation",
		tech: "Technical",
		help: "Help",
		onThisPage: "On this page",
		sectionMenu: "Section menu",
		skip: "Skip to content",
		index: "A–Z index",
		search: "Search",
		searchTitle: "Search the documentation",
		close: "Close",
		site: "BiblioViva website",
		figure: "Figure",
		note: "Note",
		important: "Important",
		warning: "Warning",
		missingPicture: "Picture to come",
		step: "Step",
		of: "of",
		prev: "Previous",
		next: "Next",
		backToPath: "Back to the path",
		pathDone: "Path completed",
		overview: "Overview",
		guides: "Guides",
		screens: "Screens",
		choose: "Choosing",
		paths: "Paths",
		after: "After the installation",
		other: "Other pages",
		pathKicker: "Installation path",
		guideKicker: "Step-by-step guide",
		screenKicker: "Screen",
		techKicker: "Technical documentation",
		correct: "Suggest a correction to this page",
		footer: "Free software GPL-3.0-or-later · Developed with the help of an LLM",
		github: "Source code on GitHub",
		language: "Language",
		sections: "Sections",
		goTo: "Go to",
		homeLead:
			"The documentation is organised by task. The guides are meant to be simple for people who seldom use a computer too, and are illustrated with the program's screens.",
		allPages: "All the pages of the documentation, in alphabetical order.",
		techLead: "Documentation for people who know Docker, Linux and JSON.",
		notFound: "Page not found",
		notFoundLead: "The address does not match any page of the documentation.",
		path: "Path",
		descManual: "Daily use: the circulation desk, the catalogue, patrons and printing.",
		descAdmin: "Accounts, loan rules, classes, backups and the work at the end of the year.",
		descInstall: "A guided path, step by step, with a check at the end of every step.",
		descTech:
			"For people who know Docker and Linux: deployment, configuration, templates and reports.",
		descHelp: "Common problems, the glossary and how to ask for help.",
	},
};

// Pages shown on the documentation home under each section (the url without the language).
const FEATURED: Record<SectionKey, string[]> = {
	manual: [
		"guide/lend-a-book",
		"guide/return-a-book",
		"guide/catalog-a-new-book",
		"guide/print-book-labels",
	],
	admin: [
		"admin/first-steps",
		"admin/guides/set-loan-rules",
		"admin/guides/import-students",
		"admin/guides/make-a-backup",
	],
	install: [
		"install/choose-computer",
		"install/choose-network",
		"install/material",
		"install/update",
	],
	tech: ["tech/deploy", "tech/config-reference", "tech/templates-authoring", "tech/security"],
	help: ["help/problems", "help/glossary", "help/ask-for-help"],
};

// Installation: the order of the pages that are not paths.
const INSTALL_CHOOSE = ["choose-computer", "choose-network", "material"];
const INSTALL_AFTER = ["update", "move", "restore", "lan-to-tailscale", "uninstall"];

// Headings of the pages that become boxes, by lower-case text.
const H_STEPS = new Set(["procedura", "procedure", "passi", "steps"]);
const H_RESULT = new Set(["risultato", "result"]);
const H_CHECK = new Set([
	"occorrente",
	"requirements",
	"verifica prima di proseguire",
	"check before going on",
]);
const H_PROBLEMS = new Set(["possibili problemi", "possible problems"]);
const H_RELATED = new Set(["pagine correlate", "related pages"]);

// ---------------------------------------------------------------- helpers

const warnings: string[] = [];
const missingFigures = new Set<string>();

function warn(message: string): void {
	warnings.push(message);
}

function esc(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function unesc(text: string): string {
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&amp;/g, "&");
}

function plain(html: string): string {
	return unesc(html.replace(/<[^>]+>/g, ""))
		.replace(/\s+/g, " ")
		.trim();
}

function t(lang: Lang, key: string): string {
	return TEXT[lang][key] ?? key;
}

function listMd(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort();
}

function h1Of(file: string): string {
	const m = /^# (.+)$/m.exec(readFileSync(file, "utf8"));
	return m ? m[1]!.trim() : file;
}

// The anchor GitHub makes from a heading: lower case, punctuation dropped, spaces to hyphens.
function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M} _-]/gu, "")
		.replace(/ /g, "-");
}

function writePage(url: string, html: string): void {
	const file = join(DIST, url, "index.html");
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, html);
}

// ---------------------------------------------------------------- icons (as in the mock: one sprite per page)

const GITHUB = `<symbol id="i-github" viewBox="0 0 16 16"><path fill="currentColor" stroke="none" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></symbol>`;

const symbolCache = new Map<string, string>();

function iconSymbol(name: string): string {
	const cached = symbolCache.get(name);
	if (cached !== undefined) {
		return cached;
	}
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
		file = join(LUCIDE, `${alias[1]}.svelte`);
	}
	const json = /__iconData = (\{.*?\});\n/s.exec(readFileSync(file, "utf8"));
	if (!json) {
		throw new Error(`icon ${name}: no data`);
	}
	const data = JSON.parse(json[1]!) as { node: [string, Record<string, string>][] };
	const children = data.node
		.map(([tag, attrs]) => {
			const a = Object.entries(attrs)
				.filter(([k]) => k !== "key")
				.map(([k, v]) => `${k}="${v}"`)
				.join(" ");
			return `<${tag} ${a}/>`;
		})
		.join("");
	const symbol = `<symbol id="i-${name}" viewBox="0 0 24 24">${children}</symbol>`;
	symbolCache.set(name, symbol);
	return symbol;
}

// `[[icon:name]]` placeholders become inline SVG references; the sprite of the page is added after <body>.
function withIcons(html: string): string {
	const used = new Set<string>();
	const out = html.replace(/\[\[icon:([a-z0-9-]+)\]\]/g, (_m, name: string) => {
		used.add(name);
		return `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
	});
	const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${[...used].map(iconSymbol).join("")}</svg>`;
	return out.replace("<!--SPRITE-->", sprite);
}

// ---------------------------------------------------------------- discovery

const pages: Page[] = [];
const fileUrl = new Map<string, string>(); // "lang:abs path" -> url (pages that have one source file)
const stepUrls = new Map<string, { path: string; url: string }[]>(); // "lang:abs step" -> pages of the step
const installPaths: InstallPath[] = [];
const urlSet = new Set<string>();

function addPage(page: Page, registerSource = true): void {
	pages.push(page);
	urlSet.add(page.url);
	if (registerSource) {
		fileUrl.set(`${page.lang}:${page.src}`, page.url);
	}
}

function discover(): void {
	for (const lang of LANGS) {
		const base = (section: string): string => join(DOCS, lang, section);
		const manual = base("manual");
		if (existsSync(manual)) {
			addPage({
				lang,
				section: "manual",
				kind: "index",
				src: join(manual, "README.md"),
				url: `/${lang}/manual/`,
				title: h1Of(join(manual, "README.md")),
			});
			for (const f of listMd(join(manual, "guides"))) {
				const src = join(manual, "guides", f);
				addPage({
					lang,
					section: "manual",
					kind: "guide",
					src,
					url: `/${lang}/guide/${f.slice(0, -3)}/`,
					title: h1Of(src),
				});
			}
			for (const f of listMd(join(manual, "screens"))) {
				const src = join(manual, "screens", f);
				addPage({
					lang,
					section: "manual",
					kind: "screen",
					src,
					url: `/${lang}/manual/${f.slice(0, -3)}/`,
					title: h1Of(src),
				});
			}
		}
		const admin = base("admin");
		if (existsSync(admin)) {
			addPage({
				lang,
				section: "admin",
				kind: "index",
				src: join(admin, "README.md"),
				url: `/${lang}/admin/`,
				title: h1Of(join(admin, "README.md")),
			});
			for (const f of listMd(admin).filter((x) => x !== "README.md")) {
				const src = join(admin, f);
				addPage({
					lang,
					section: "admin",
					kind: "page",
					src,
					url: `/${lang}/admin/${f.slice(0, -3)}/`,
					title: h1Of(src),
				});
			}
			for (const sub of ["guides", "screens"]) {
				for (const f of listMd(join(admin, sub))) {
					const src = join(admin, sub, f);
					addPage({
						lang,
						section: "admin",
						kind: sub === "guides" ? "guide" : "screen",
						src,
						url: `/${lang}/admin/${sub}/${f.slice(0, -3)}/`,
						title: h1Of(src),
					});
				}
			}
		}
		const help = base("help");
		if (existsSync(help)) {
			for (const f of listMd(help)) {
				const src = join(help, f);
				const url =
					f === "README.md" ? `/${lang}/help/` : `/${lang}/help/${f.slice(0, -3)}/`;
				addPage({
					lang,
					section: "help",
					kind: f === "README.md" ? "index" : "page",
					src,
					url,
					title: h1Of(src),
				});
			}
		}
		const setup = base("setup");
		if (existsSync(setup)) {
			for (const f of listMd(setup)) {
				const src = join(setup, f);
				const url =
					f === "README.md" ? `/${lang}/install/` : `/${lang}/install/${f.slice(0, -3)}/`;
				addPage({
					lang,
					section: "install",
					kind: f === "README.md" ? "index" : "page",
					src,
					url,
					title: h1Of(src),
				});
			}
			for (const f of listMd(join(setup, "paths"))) {
				const src = join(setup, "paths", f);
				const slugName = f.slice(0, -3);
				const url = `/${lang}/install/${slugName}/`;
				const path: InstallPath = {
					slug: slugName,
					lang,
					src,
					url,
					steps: [],
					keep: slugName.split("-"),
				};
				const text = readFileSync(src, "utf8");
				let n = 0;
				for (const m of text.matchAll(/^\d+\.\s+\[[^\]]+\]\(([^)]+\.md)\)/gm)) {
					const stepSrc = resolve(dirname(src), m[1]!);
					if (!existsSync(stepSrc)) {
						warn(`${relative(ROOT, src)}: step ${m[1]} does not exist`);
						continue;
					}
					n += 1;
					const stepSlug = stepSrc.slice(stepSrc.lastIndexOf("/") + 1, -3);
					const stepUrl = `${url}${n}-${stepSlug}/`;
					path.steps.push({ n, src: stepSrc, slug: stepSlug, url: stepUrl });
					const key = `${lang}:${stepSrc}`;
					stepUrls.set(key, [
						...(stepUrls.get(key) ?? []),
						{ path: slugName, url: stepUrl },
					]);
				}
				installPaths.push(path);
				addPage({ lang, section: "install", kind: "path", src, url, title: h1Of(src) });
				for (const step of path.steps) {
					addPage(
						{
							lang,
							section: "install",
							kind: "step",
							src: step.src,
							url: step.url,
							title: h1Of(step.src),
							path: slugName,
							step: { n: step.n, total: path.steps.length, src: step.src },
						},
						false,
					);
				}
			}
		}
		// Technical documents: the same English page in both languages.
		for (const [name, file] of TECH_DOCS) {
			const src = join(DOCS, file);
			if (!existsSync(src)) {
				warn(`technical document ${file} does not exist`);
				continue;
			}
			addPage({
				lang,
				section: "tech",
				kind: "tech",
				src,
				url: `/${lang}/tech/${name}/`,
				title: h1Of(src),
			});
		}
		addPage(
			{
				lang,
				section: "tech",
				kind: "generated",
				src: "",
				url: `/${lang}/tech/`,
				title: t(lang, "tech"),
			},
			false,
		);
	}
}

function pageByUrl(url: string): Page | undefined {
	return pages.find((p) => p.url === url);
}

// ---------------------------------------------------------------- links

function repoUrl(abs: string): string {
	const rel = relative(ROOT, abs);
	const kind = existsSync(abs) && statSync(abs).isDirectory() ? "tree" : "blob";
	return `${REPO}/${kind}/main/${rel}`;
}

function resolveLink(href: string, ctx: Ctx): string {
	if (/^(https?:|mailto:|tel:|\/\/)/.test(href)) {
		return href;
	}
	if (href.startsWith("#")) {
		return href;
	}
	const [file = "", anchor] = unesc(href).split("#");
	const suffix = anchor ? `#${anchor}` : "";
	let target = resolve(dirname(ctx.src), file);
	if (
		!file.endsWith(".md") &&
		existsSync(target) &&
		statSync(target).isDirectory() &&
		existsSync(join(target, "README.md"))
	) {
		target = join(target, "README.md");
	}
	const direct = fileUrl.get(`${ctx.lang}:${target}`);
	if (direct) {
		return direct + suffix;
	}
	const steps = stepUrls.get(`${ctx.lang}:${target}`);
	if (steps && steps.length > 0) {
		const own = ctx.path ? steps.find((s) => s.path === ctx.path!.slug) : undefined;
		return (own ?? steps[0]!).url + suffix;
	}
	// A page of another language folder that does not exist: the Italian one.
	if (ctx.lang !== "it") {
		const itTarget = target.replace(`${join(DOCS, ctx.lang)}/`, `${join(DOCS, "it")}/`);
		const itUrl = fileUrl.get(`it:${itTarget}`);
		if (itUrl) {
			return itUrl + suffix;
		}
		const itSteps = stepUrls.get(`it:${itTarget}`);
		if (itSteps && itSteps.length > 0) {
			return itSteps[0]!.url + suffix;
		}
	}
	if (existsSync(target)) {
		return repoUrl(target) + suffix;
	}
	warn(`${relative(ROOT, ctx.src)}: broken link ${href}`);
	return repoUrl(target) + suffix;
}

// ---------------------------------------------------------------- Markdown

// Variant blocks: on an installation step keep only the variants of the path and drop the label line.
function applyVariants(src: string, keep: string[]): string {
	return src.replace(
		/^<!--\s*variant:\s*([\w-]+)\s*-->\n([\s\S]*?)^<!--\s*\/variant\s*-->[ \t]*\n?/gm,
		(_m, name: string, body: string) => {
			if (!keep.includes(name)) {
				return "\n";
			}
			return `\n${body.replace(/^\s*\*\*[^\n]*\*\*[ \t]*\n+/, "")}\n`;
		},
	);
}

function figureHtml(name: string, caption: string, ctx: Ctx): string {
	ctx.fig += 1;
	const n = ctx.fig;
	// a screen of BiblioViva and a mock of another program alike: taken by `docs:shots` (ADR-046)
	let src: string | null = null;
	for (const lang of ctx.lang === "it" ? ["it"] : [ctx.lang, "it"]) {
		if (existsSync(join(SHOTS, lang, `${name}.webp`))) {
			src = `/shots/${lang}/${name}.webp`;
			break;
		}
	}
	const label = esc(caption);
	let frame: string;
	if (src) {
		frame = `<div class="fig-frames"><div class="fig-desktop"><img src="${src}" alt="${label}" loading="lazy"></div></div>`;
	} else {
		missingFigures.add(name);
		frame = `<div class="fig-frames"><div class="ph" role="img" data-pagefind-ignore aria-label="${label}"><div class="ph-chrome"><i></i><i></i><i></i></div><div class="ph-body"><span class="ph-lines"></span>[[icon:image]]<b>${esc(t(ctx.lang, "missingPicture"))}</b><code>${esc(name)}</code></div></div></div>`;
	}
	return `<figure class="fig" id="fig-${n}">${frame}<figcaption><span class="fig-n">${t(ctx.lang, "figure")} ${n}.</span> ${label}</figcaption></figure>`;
}

const ALERTS: Record<string, { cls: string; icon: string; key: string }> = {
	NOTE: { cls: "", icon: "info", key: "note" },
	IMPORTANT: { cls: " warn", icon: "circle-alert", key: "important" },
	WARNING: { cls: " bad", icon: "triangle-alert", key: "warning" },
};

function takeBalanced(html: string, open: string, close: string, from: number): number {
	// Index just after the close tag that balances the open tag found at `from`.
	let depth = 0;
	const re = new RegExp(`${open}|${close}`, "g");
	re.lastIndex = from;
	for (let m = re.exec(html); m; m = re.exec(html)) {
		depth += m[0].startsWith("</") ? -1 : 1;
		if (depth === 0) {
			return m.index + m[0].length;
		}
	}
	return -1;
}

// Top-level ordered lists of a section become the numbered steps of the mock.
function stepLists(html: string): string {
	let depth = 0;
	return html.replace(
		/<(\/?)(ol|ul)\b([^>]*)>/g,
		(m, close: string, tag: string, attrs: string) => {
			if (close) {
				depth -= 1;
				return m;
			}
			depth += 1;
			if (tag === "ol" && depth === 1) {
				const start = /start="(\d+)"/.exec(attrs);
				const style = start ? ` style="counter-reset: st ${Number(start[1]) - 1}"` : "";
				return `<ol class="steps"${style}>`;
			}
			return m;
		},
	);
}

function cardIcon(url: string): string {
	if (url.includes("/guide/")) {
		return "route";
	}
	if (url.includes("/manual/")) {
		return "layers";
	}
	if (url.includes("/admin/")) {
		return "settings";
	}
	if (url.includes("/install/")) {
		return "rocket";
	}
	if (url.includes("/tech/")) {
		return "terminal";
	}
	if (url.includes("/help/")) {
		return "life-buoy";
	}
	return "file-text";
}

function transformSections(html: string): string {
	const parts = html.split(/(?=<h2 )/);
	if (html.startsWith("<h2 ")) {
		// A split on a zero-width match gives no empty first part.
		parts.unshift("");
	}
	return parts
		.map((part, i) => {
			if (i === 0) {
				return part;
			}
			const m = /^<h2 id="([^"]*)">([\s\S]*?)<\/h2>\n?([\s\S]*)$/.exec(part);
			if (!m) {
				return part;
			}
			const [, id = "", headingHtml = "", content = ""] = m;
			const key = plain(headingHtml).toLowerCase();
			const head = `<h2 id="${id}">${headingHtml}</h2>\n`;
			const balanced =
				(content.match(/<div\b/g) ?? []).length ===
				(content.match(/<\/div>/g) ?? []).length;
			if (H_STEPS.has(key)) {
				return head + stepLists(content);
			}
			if (!balanced) {
				return part;
			}
			if (H_RESULT.has(key)) {
				return `${head}<div class="done">[[icon:circle-check]]<div class="done-body">${content}</div></div>\n`;
			}
			if (H_CHECK.has(key) && !/<h3\b/.test(content)) {
				const icon =
					key.startsWith("occor") || key.startsWith("requ")
						? "clipboard-check"
						: "list-checks";
				return `<div class="check"><p id="${id}">[[icon:${icon}]] ${headingHtml}</p>\n${content}</div>\n`;
			}
			if (H_PROBLEMS.has(key) && /<h3\b/.test(content)) {
				const pieces = content.split(/(?=<h3 )/);
				const intro = pieces[0]!.startsWith("<h3 ") ? "" : pieces.shift()!;
				const items = pieces
					.map((piece) => {
						const h = /^<h3 id="([^"]*)">([\s\S]*?)<\/h3>\n?([\s\S]*)$/.exec(piece);
						if (!h) {
							return piece;
						}
						return `<details id="${h[1]}"><summary>[[icon:triangle-alert]] ${h[2]}[[icon:chevron-down]]</summary><div>${h[3]}</div></details>`;
					})
					.join("\n");
				return `${head}${intro}<div class="trouble">${items}</div>\n`;
			}
			if (H_RELATED.has(key)) {
				const items = [...content.matchAll(/<li><a href="([^"]+)">([\s\S]*?)<\/a><\/li>/g)];
				const lis = (content.match(/<li>/g) ?? []).length;
				if (items.length > 0 && items.length === lis) {
					const cards = items
						.map(
							(it) =>
								`<a class="card" href="${it[1]}"><div class="ico">[[icon:${cardIcon(it[1]!)}]]</div><b>${it[2]}</b></a>`,
						)
						.join("");
					return `${head}<div class="cards">${cards}</div>\n`;
				}
			}
			return part;
		})
		.join("");
}

function markdown(src: string, ctx: Ctx): Rendered {
	let text = src;
	if (ctx.path) {
		text = applyVariants(text, ctx.path.keep);
	}
	let html = Bun.markdown.html(text, { headings: { ids: true }, autolinks: true });

	// Anchors as GitHub makes them (they work as they are in links written for GitHub).
	const seen = new Map<string, number>();
	html = html.replace(
		/<h([1-6]) id="[^"]*">([\s\S]*?)<\/h\1>/g,
		(_m, level: string, inner: string) => {
			const base = slug(plain(inner));
			const count = seen.get(base) ?? 0;
			seen.set(base, count + 1);
			const id = count === 0 ? base : `${base}-${count}`;
			return `<h${level} id="${id}">${inner}</h${level}>`;
		},
	);

	// Figures and screenshots.
	html = html.replace(
		/(?:<p>\s*)?<!--\s*(figure|screenshot):\s*([^|]*?)\s*(?:\|\s*([\s\S]*?))?\s*-->(?:\s*<\/p>)?/g,
		(_m, _kind: string, name: string, caption: string | undefined) =>
			figureHtml(name.trim(), (caption ?? name).trim(), ctx),
	);

	// Notes (GitHub alerts).
	html = html.replace(
		/<blockquote>\s*<p>\[!(NOTE|IMPORTANT|WARNING)\]\s*([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/g,
		(_m, kind: string, first: string, rest: string) => {
			const a = ALERTS[kind]!;
			const label = t(ctx.lang, a.key);
			const firstPara = first.trim() === "" ? "" : `<p><b>${label}.</b> ${first.trim()}</p>`;
			const labelOnly = first.trim() === "" ? `<p><b>${label}.</b></p>` : "";
			return `<div class="note${a.cls}">[[icon:${a.icon}]]<div class="note-body">${labelOnly}${firstPara}${rest.trim()}</div></div>`;
		},
	);

	// Variant blocks left on normal pages: every variant visible with its label.
	html = html.replace(
		/<!--\s*variant:\s*([\w-]+)\s*-->/g,
		(_m, name: string) => `<div class="variant" data-variant="${name}">`,
	);
	html = html.replace(/<!--\s*\/variant\s*-->/g, "</div>");

	// Links.
	html = html.replace(/<a href="([^"]*)"/g, (_m, href: string) => {
		const out = resolveLink(href, ctx);
		const external = /^https?:/.test(out) && !out.startsWith("https://biblioviva.org");
		return `<a href="${esc(unesc(out))}"${external ? ' rel="external"' : ""}`;
	});

	// Tables scroll on their own on a narrow screen.
	html = html
		.replace(/<table>/g, '<div class="tw"><table>')
		.replace(/<\/table>/g, "</table></div>");

	// Title, lead and contents.
	let title = "";
	let lead = "";
	const h1 = /<h1 id="[^"]*">([\s\S]*?)<\/h1>\n?/.exec(html);
	if (h1) {
		title = plain(h1[1]!);
		html = html.replace(h1[0], "");
		const p = /^\s*<p>([\s\S]*?)<\/p>\n?/.exec(html);
		if (p) {
			lead = p[1]!;
			html = html.slice(p[0].length);
		}
	}
	const toc = [...html.matchAll(/<h2 id="([^"]*)">([\s\S]*?)<\/h2>/g)].map((m) => ({
		id: m[1]!,
		text: plain(m[2]!),
	}));
	html = transformSections(html);
	return { title, lead, body: html, toc };
}

// ---------------------------------------------------------------- navigation

interface NavItem {
	label: string;
	url: string;
	sub?: string;
}
interface NavGroup {
	title: string;
	icon: string;
	items: NavItem[];
	steps?: { current: number };
}

function pagesOf(lang: Lang, section: SectionKey): Page[] {
	return pages.filter((p) => p.lang === lang && p.section === section && p.kind !== "step");
}

// Links of a README in order, with the H2 and H3 headings they sit under.
function readmeLinks(src: string): { h2: string; h3: string; file: string }[] {
	const out: { h2: string; h3: string; file: string }[] = [];
	let h2 = "";
	let h3 = "";
	let line3 = "";
	for (const line of readFileSync(src, "utf8").split("\n")) {
		const a = /^## (.+)/.exec(line);
		if (a) {
			h2 = a[1]!.trim();
			h3 = "";
			line3 = "";
			continue;
		}
		const b = /^### (.+)/.exec(line);
		if (b) {
			h3 = b[1]!.trim();
			line3 = "";
			continue;
		}
		if (line.startsWith("- ")) {
			// "- Banco prestiti: [Prestiti](…), …" opens a labelled run of links, like an H3.
			const label = /^- ([^[\]]+):\s*\[/.exec(line);
			line3 = label ? label[1]!.trim() : "";
		}
		if (/^(- |\s+)\S/.test(line)) {
			for (const l of line.matchAll(/\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)) {
				out.push({ h2, h3: line3 || h3, file: resolve(dirname(src), l[1]!) });
			}
		}
	}
	return out;
}

const navCache = new Map<string, NavGroup[]>();

function readmeGroups(lang: Lang, section: SectionKey, icons: Record<string, string>): NavGroup[] {
	const all = pagesOf(lang, section);
	const index = all.find((p) => p.kind === "index");
	if (!index) {
		return [];
	}
	const used = new Set<string>([index.src]);
	const groups: NavGroup[] = [
		{
			title: t(lang, "overview"),
			icon: "compass",
			items: [{ label: index.title, url: index.url }],
		},
	];
	const byTitle = new Map<string, NavGroup>();
	for (const link of readmeLinks(index.src)) {
		const page = all.find((p) => p.src === link.file);
		if (!page || used.has(page.src)) {
			continue;
		}
		used.add(page.src);
		const title = link.h2 || t(lang, "other");
		let group = byTitle.get(title);
		if (!group) {
			group = { title, icon: icons[title] ?? "list", items: [] };
			byTitle.set(title, group);
			groups.push(group);
		}
		group.items.push({ label: page.title, url: page.url, sub: link.h3 || undefined });
	}
	const rest = all.filter((p) => !used.has(p.src));
	if (rest.length > 0) {
		for (const p of rest) {
			warn(`${relative(ROOT, p.src)}: not listed in the README of its section`);
		}
		groups.push({
			title: t(lang, "other"),
			icon: "list",
			items: rest.map((p) => ({ label: p.title, url: p.url })),
		});
	}
	return groups;
}

function navGroups(lang: Lang, section: SectionKey): NavGroup[] {
	const cacheKey = `${lang}:${section}`;
	const cached = navCache.get(cacheKey);
	if (cached) {
		return cached;
	}
	let groups: NavGroup[];
	if (section === "manual" || section === "admin") {
		groups = readmeGroups(lang, section, {
			Guide: "route",
			Guides: "route",
			Schermate: "layers",
			Screens: "layers",
			"Primi passi": "clipboard-check",
			"First steps": "clipboard-check",
		});
	} else if (section === "help") {
		const all = pagesOf(lang, "help");
		const index = all.find((p) => p.kind === "index");
		const order = index ? readmeLinks(index.src).map((l) => l.file) : [];
		const rest = all
			.filter((p) => p.kind !== "index")
			.sort(
				(a, b) => ((order.indexOf(a.src) + 99) % 99) - ((order.indexOf(b.src) + 99) % 99),
			);
		groups = [
			{
				title: t(lang, "help"),
				icon: "life-buoy",
				items: [...(index ? [index] : []), ...rest].map((p) => ({
					label: p.title,
					url: p.url,
				})),
			},
		];
	} else if (section === "tech") {
		groups = [
			{
				title: t(lang, "tech"),
				icon: "terminal",
				items: pagesOf(lang, "tech").map((p) => ({
					label: p.kind === "generated" ? t(lang, "overview") : p.title,
					url: p.url,
				})),
			},
		];
		groups[0]!.items.sort(
			(a, b) => Number(b.url.endsWith("/tech/")) - Number(a.url.endsWith("/tech/")),
		);
	} else {
		const all = pagesOf(lang, "install");
		const byName = (name: string): Page | undefined =>
			all.find((p) => p.kind === "page" && p.url.endsWith(`/install/${name}/`));
		const item = (p: Page): NavItem => ({ label: p.title, url: p.url });
		const index = all.find((p) => p.kind === "index");
		const choose = [
			...(index ? [index] : []),
			...INSTALL_CHOOSE.map(byName).filter((p): p is Page => !!p),
		];
		const after = [...INSTALL_AFTER.map(byName).filter((p): p is Page => !!p)];
		for (const p of all.filter(
			(x) =>
				x.kind === "page" &&
				!INSTALL_CHOOSE.includes(x.url.split("/")[3]!) &&
				!after.includes(x),
		)) {
			after.push(p);
		}
		groups = [
			{ title: t(lang, "choose"), icon: "compass", items: choose.map(item) },
			{
				title: t(lang, "paths"),
				icon: "route",
				items: all.filter((p) => p.kind === "path").map(item),
			},
			{ title: t(lang, "after"), icon: "wrench", items: after.map(item) },
		];
	}
	navCache.set(cacheKey, groups);
	return groups;
}

function sidebar(page: Page): string {
	let groups = navGroups(page.lang, page.section);
	if (page.section === "install" && page.path) {
		const path = installPaths.find((p) => p.lang === page.lang && p.slug === page.path)!;
		const pathPage = pageByUrl(path.url)!;
		const now = page.kind === "step" ? page.step!.n : 0;
		const stepGroup: NavGroup = {
			title: pathPage.title,
			icon: "route",
			items: path.steps.map((s) => ({ label: h1Of(s.src), url: s.url })),
			steps: { current: now },
		};
		groups = [groups[0]!, stepGroup, ...groups.slice(1)];
	}
	return groups
		.map((g) => {
			let list: string;
			if (g.steps) {
				const items = g.items
					.map((it, n) => {
						const state =
							n + 1 < g.steps!.current
								? "sn-done"
								: n + 1 === g.steps!.current
									? "sn-now"
									: "";
						const mark = state === "sn-done" ? "[[icon:check]]" : String(n + 1);
						return `<li class="${state}"><span class="sn-dot">${mark}</span><a href="${it.url}"${n + 1 === g.steps!.current ? ' aria-current="step"' : ""}>${esc(it.label)}</a></li>`;
					})
					.join("");
				list = `<ol class="stepnav">${items}</ol>`;
			} else {
				let sub = "";
				const items = g.items
					.map((it) => {
						let head = "";
						if (it.sub && it.sub !== sub) {
							sub = it.sub;
							head = `<li class="side-sub">${esc(sub)}</li>`;
						}
						return `${head}<li><a href="${it.url}"${it.url === page.url ? ' aria-current="page"' : ""}>${esc(it.label)}</a></li>`;
					})
					.join("");
				list = `<ul>${items}</ul>`;
			}
			return `<div class="side-group"><p class="side-title">[[icon:${g.icon}]] ${esc(g.title)}</p>${list}</div>`;
		})
		.join("");
}

// ---------------------------------------------------------------- layout

function altUrl(page: Page, to: Lang): string {
	const alt = page.url.replace(/^\/[a-z]{2}\//, `/${to}/`);
	return urlSet.has(alt) ? alt : `/${to}/`;
}

function sectionsOf(lang: Lang): SectionKey[] {
	return SECTIONS.filter((s) =>
		pages.some((p) => p.lang === lang && p.section === s && p.kind !== "generated"),
	);
}

function sectionHome(lang: Lang, section: SectionKey): string {
	return `/${lang}/${SECTION_PATH[section]}/`;
}

function header(lang: Lang, section: SectionKey | null, switchTo: (to: Lang) => string): string {
	const tabs = sectionsOf(lang)
		.map(
			(s) =>
				`<a href="${sectionHome(lang, s)}" style="--sec:${COLORS[s]}"${s === section ? ' aria-current="true"' : ""}>[[icon:${SECTION_ICONS[s]}]]<span>${t(lang, s)}</span></a>`,
		)
		.join("");
	const langs = LANGS.map((l) =>
		l === lang
			? `<a href="${switchTo(l)}" aria-current="true">${l.toUpperCase()}</a>`
			: `<a href="${switchTo(l)}" hreflang="${l}">${l.toUpperCase()}</a>`,
	).join("");
	return `<header class="dh"><div class="dh-row"><a class="dh-brand" href="/${lang}/"><img src="/assets/logo.webp" alt="" width="32" height="32"><span>BiblioViva <em>${t(lang, "docs")}</em></span></a><nav class="dh-tabs" aria-label="${t(lang, "sections")}">${tabs}</nav><div class="dh-tools"><a class="dh-search" href="/${lang}/index/" data-search>[[icon:search]]<span>${t(lang, "search")}</span><kbd>Ctrl K</kbd></a><div class="lang" role="group" aria-label="${t(lang, "language")}">[[icon:globe]]${langs}</div><a class="dh-icon" href="${homeSite(lang)}" rel="external" title="${t(lang, "site")}" aria-label="${t(lang, "site")}">[[icon:house]]</a><a class="dh-icon" href="${REPO}" rel="external" title="${t(lang, "github")}" aria-label="GitHub">[[icon:github]]</a></div></div></header>`;
}

/** The home page of biblioviva.org in the page's language. */
function homeSite(lang: Lang): string {
	return lang === "it" ? "https://biblioviva.org/" : `https://biblioviva.org/${lang}/`;
}

function footer(lang: Lang, src: string | null): string {
	const edit = src
		? `<a href="${REPO}/edit/main/${relative(ROOT, src)}" rel="external">[[icon:github]] ${t(lang, "correct")}</a>`
		: "";
	return `<footer class="df"><p><a href="${homeSite(lang)}" rel="external">biblioviva.org</a> · ${t(lang, "docs")}${edit ? ` · ${edit}` : ""}</p><p>${t(lang, "footer")}</p></footer>`;
}

function shell(lang: Lang, title: string, description: string, body: string): string {
	return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/assets/logo.webp" type="image/webp">
<link rel="stylesheet" href="/assets/fonts/fonts.css">
<link rel="stylesheet" href="/assets/style.css">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body class="layout-docs">
<!--SPRITE-->
<a class="skip" href="#main">${t(lang, "skip")}</a>
${body}
<dialog class="ds" aria-label="${t(lang, "searchTitle")}"><div class="ds-box"><div class="ds-ui"></div><button type="button" class="ds-close" aria-label="${t(lang, "close")}">[[icon:x]]</button></div><p class="ds-foot"><a href="/${lang}/index/">[[icon:list]] ${t(lang, "index")}</a></p></dialog>
<script src="/assets/search.js" defer></script>
<script src="/assets/lang.js" defer></script>
</body>
</html>
`;
}

function kicker(page: Page): { icon: string; text: string } {
	const lang = page.lang;
	switch (page.kind) {
		case "guide":
			return { icon: "route", text: t(lang, "guideKicker") };
		case "screen":
			return { icon: "layers", text: t(lang, "screenKicker") };
		case "path":
			return { icon: "route", text: t(lang, "pathKicker") };
		case "step":
			return {
				icon: "rocket",
				text: `${t(lang, "step")} ${page.step!.n} ${t(lang, "of")} ${page.step!.total}`,
			};
		case "tech":
		case "generated":
			return { icon: "terminal", text: t(lang, "techKicker") };
		case "index":
		case "page":
			return { icon: SECTION_ICONS[page.section], text: t(lang, page.section) };
	}
}

/** Whether the search indexes the page: a step shared by several installation paths, once (its first path). */
function searchable(page: Page): boolean {
	return page.kind !== "step" || stepUrls.get(`${page.lang}:${page.src}`)?.[0]?.url === page.url;
}

function crumbs(page: Page): string {
	const lang = page.lang;
	const parts: string[] = [`<a href="/${lang}/">${t(lang, "docs")}</a>`];
	const home = sectionHome(lang, page.section);
	if (page.url === home) {
		parts.push(`<span>${t(lang, page.section)}</span>`);
	} else {
		parts.push(`<a href="${home}">${t(lang, page.section)}</a>`);
		if (page.kind === "step") {
			const path = installPaths.find((p) => p.lang === lang && p.slug === page.path)!;
			parts.push(`<a href="${path.url}">${esc(pageByUrl(path.url)!.title)}</a>`);
		}
		parts.push(`<span>${esc(page.title)}</span>`);
	}
	return `<nav class="crumbs" data-pagefind-ignore aria-label="${t(lang, "path")}">${parts.join("[[icon:chevron-right]]")}</nav>`;
}

interface View {
	page: Page;
	rendered: Rendered;
	extra?: string;
	before?: string;
	after?: string;
}

function docsPage(view: View): string {
	const { page, rendered } = view;
	const lang = page.lang;
	const toc =
		rendered.toc.length > 0
			? `<p class="toc-title">${t(lang, "onThisPage")}</p><ul>${rendered.toc.map((e) => `<li><a href="#${e.id}">${esc(e.text)}</a></li>`).join("")}</ul>`
			: "";
	const k = kicker(page);
	const side = sidebar(page);
	const contentLang = page.kind === "tech" ? ' lang="en"' : "";
	const head = `<div class="page-head"><span class="kicker">[[icon:${k.icon}]] ${esc(k.text)}</span><h1>${esc(page.title)}</h1>${rendered.lead ? `<p class="lead">${rendered.lead}</p>` : ""}${view.extra ?? ""}</div>`;
	const body = `${header(lang, page.section, (to) => altUrl(page, to))}<div class="docs" style="--sec:${COLORS[page.section]}"><aside class="side"><details class="side-mobile"><summary>[[icon:list-checks]] ${t(lang, "sectionMenu")}</summary><nav>${side}</nav></details><nav class="side-desktop" aria-label="${t(lang, "sectionMenu")}">${side}</nav></aside><main class="content" id="main"${contentLang}${searchable(page) ? " data-pagefind-body" : ""}>${crumbs(page)}${view.before ?? ""}${head}${rendered.body}${view.after ?? ""}</main><aside class="toc">${toc}</aside></div>${footer(lang, page.src || null)}`;
	return withIcons(
		shell(lang, `${page.title} — BiblioViva`, plain(rendered.lead).slice(0, 200), body),
	);
}

function plainPage(
	lang: Lang,
	title: string,
	lead: string,
	inner: string,
	switchTo: (to: Lang) => string,
	section: SectionKey | null = null,
): string {
	const body = `${header(lang, section, switchTo)}<main class="plain" id="main"><div class="page-head" style="--sec:var(--primary)"><span class="kicker">[[icon:book-open]] ${t(lang, "docs")}</span><h1>${esc(title)}</h1><p class="lead" style="margin:0">${esc(lead)}</p></div>${inner}</main>${footer(lang, null)}`;
	return withIcons(shell(lang, `${title} — BiblioViva`, lead, body));
}

// ---------------------------------------------------------------- pages

const renderedCache = new Map<string, Rendered>();

function renderPage(page: Page): Rendered {
	const cacheKey = `${page.lang}:${page.url}`;
	const cached = renderedCache.get(cacheKey);
	if (cached) {
		return cached;
	}
	const ctx: Ctx = { lang: page.lang, src: page.src, fig: 0 };
	if (page.kind === "step" || page.kind === "path") {
		ctx.path = installPaths.find(
			(p) => p.lang === page.lang && p.slug === (page.path ?? page.url.split("/")[3]),
		)!;
	}
	const rendered = markdown(readFileSync(page.src, "utf8"), ctx);
	renderedCache.set(cacheKey, rendered);
	return rendered;
}

function track(page: Page, path: InstallPath): string {
	const items = path.steps
		.map((s) => {
			const state = s.n < page.step!.n ? "done-step" : s.n === page.step!.n ? "now" : "";
			return `<li class="${state}"><a href="${s.url}"${state === "now" ? ' aria-current="step"' : ""}><span>${s.n} · ${esc(h1Of(s.src))}</span></a></li>`;
		})
		.join("");
	return `<ol class="track" aria-label="${t(page.lang, "path")}">${items}</ol>`;
}

function pager(page: Page, path: InstallPath): string {
	const lang = page.lang;
	const n = page.step!.n;
	const prev = path.steps[n - 2];
	const next = path.steps[n];
	const left = prev
		? `<a href="${prev.url}"><small>[[icon:arrow-left]] ${t(lang, "prev")} · ${t(lang, "step")} ${prev.n}</small>${esc(h1Of(prev.src))}</a>`
		: `<a href="${path.url}"><small>[[icon:arrow-left]] ${t(lang, "prev")}</small>${esc(pageByUrl(path.url)!.title)}</a>`;
	const right = next
		? `<a href="${next.url}"><small>${t(lang, "next")} · ${t(lang, "step")} ${next.n} [[icon:arrow-right]]</small>${esc(h1Of(next.src))}</a>`
		: `<a href="${path.url}"><small>${t(lang, "pathDone")} [[icon:circle-check]]</small>${t(lang, "backToPath")}</a>`;
	return `<nav class="pager">${left}${right}</nav>`;
}

function buildRegular(page: Page): void {
	const rendered = renderPage(page);
	let extra = "";
	if (page.kind === "guide") {
		// The opening list of a guide (time, account, what is needed) becomes a box.
		const m = /^\s*<ul>/.exec(rendered.body);
		if (m) {
			const end = takeBalanced(rendered.body, "<ul\\b[^>]*>", "</ul>", 0);
			if (end > 0) {
				extra = `<div class="intro-list">${rendered.body.slice(0, end).trim()}</div>`;
				rendered.body = rendered.body.slice(end);
			}
		}
	}
	if (page.kind === "path") {
		// The list of steps: a link to each step page with its opening sentence.
		const path = installPaths.find(
			(p) => p.lang === page.lang && p.slug === page.url.split("/")[3],
		)!;
		rendered.body = rendered.body.replace(
			/<li><a href="([^"]+)">([\s\S]*?)<\/a><\/li>/g,
			(m, href: string) => {
				const step = path.steps.find((s) => s.url === href);
				if (!step) {
					return m;
				}
				const stepPage = pages.find((p) => p.lang === page.lang && p.url === step.url)!;
				const lead = renderPage(stepPage).lead;
				return `<li><b><a href="${href}">${esc(stepPage.title)}</a></b>${lead ? `<p>${lead}</p>` : ""}</li>`;
			},
		);
	}
	writePage(page.url, docsPage({ page, rendered, extra }));
}

function buildStep(page: Page): void {
	const path = installPaths.find((p) => p.lang === page.lang && p.slug === page.path)!;
	const rendered = renderPage(page);
	const facts = `<ul class="facts"><li>[[icon:route]] ${esc(pageByUrl(path.url)!.title)}</li></ul>`;
	writePage(
		page.url,
		docsPage({
			page,
			rendered,
			before: track(page, path),
			extra: facts,
			after: pager(page, path),
		}),
	);
}

function buildTechIndex(lang: Lang): void {
	const page = pageByUrl(`/${lang}/tech/`)!;
	const cards = pagesOf(lang, "tech")
		.filter((p) => p.kind === "tech")
		.map((p) => {
			const lead = plain(renderPage(p).lead);
			return `<a class="card" href="${p.url}"><div class="ico">[[icon:file-text]]</div><b>${esc(p.title)}</b><span>${esc(lead.length > 180 ? `${lead.slice(0, 177)}…` : lead)}</span><small><code>${esc(relative(DOCS, p.src))}</code></small></a>`;
		})
		.join("");
	const rendered: Rendered = {
		title: page.title,
		lead: esc(t(lang, "techLead")),
		body: `<div class="cards">${cards}</div>`,
		toc: [],
	};
	writePage(page.url, docsPage({ page, rendered }));
}

function buildHome(lang: Lang): void {
	const roles = sectionsOf(lang)
		.map((s) => {
			const featured = FEATURED[s]
				.map((u) => pageByUrl(`/${lang}/${u}/`))
				.filter((p): p is Page => !!p)
				.map((p) => `<li>[[icon:check]] ${esc(p.title)}</li>`)
				.join("");
			const key = `desc${s[0]!.toUpperCase()}${s.slice(1)}`;
			const name = t(lang, s);
			return `<a class="role" href="${sectionHome(lang, s)}" style="--a:${COLORS[s]}"><div class="ico">[[icon:${SECTION_ICONS[s]}]]</div><b>${name}</b><span>${esc(t(lang, key))}</span><ul>${featured}</ul><span class="go">${t(lang, "goTo")} ${name} [[icon:arrow-right]]</span></a>`;
		})
		.join("");
	const html = plainPage(
		lang,
		t(lang, "homeTitle"),
		t(lang, "homeLead"),
		`<div class="roles">${roles}</div>`,
		(to) => `/${to}/`,
	);
	writePage(`/${lang}/`, html);
}

function buildAz(lang: Lang): void {
	const entries = pages
		.filter((p) => p.lang === lang && p.kind !== "step" && p.kind !== "generated")
		.sort((a, b) => a.title.localeCompare(b.title, lang));
	const groups = new Map<string, Page[]>();
	for (const p of entries) {
		const letter =
			p.title
				.normalize("NFD")
				.replace(/[^\p{L}]/gu, "")[0]
				?.toUpperCase() ?? "#";
		groups.set(letter, [...(groups.get(letter) ?? []), p]);
	}
	const inner = [...groups]
		.map(
			([letter, list]) =>
				`<h2 id="${letter.toLowerCase()}">${letter}</h2><ul class="az">${list.map((p) => `<li><a href="${p.url}">${esc(p.title)}</a> <small style="--a:${COLORS[p.section]}">${t(lang, p.section)}</small></li>`).join("")}</ul>`,
		)
		.join("");
	writePage(
		`/${lang}/index/`,
		plainPage(lang, t(lang, "index"), t(lang, "allPages"), inner, (to) => `/${to}/index/`),
	);
}

/** The search index of every language (Pagefind, Q134): one per `<html lang>`, read by `assets/search.js`. */
async function buildSearch(): Promise<void> {
	const { index } = await pagefind.createIndex({});
	if (!index) {
		throw new Error("Pagefind did not start");
	}
	await index.addDirectory({ path: DIST });
	await index.writeFiles({ outputPath: join(DIST, "pagefind") });
	await pagefind.close();
}

/** The root of the site: the language of the cookie `bv_lang` shared on biblioviva.org (ADR-047), else
 * the browser's first language among the documentation's, else English; Italian without JavaScript. */
const ROOT_PAGE = `<!doctype html>
<meta charset="utf-8">
<title>BiblioViva</title>
<script>
(() => {
	const langs = ${JSON.stringify(LANGS)};
	const chosen = /(?:^|; )bv_lang=([^;]*)/.exec(document.cookie)?.[1];
	const browser = (navigator.languages ?? [navigator.language])
		.map((l) => l.slice(0, 2).toLowerCase())
		.find((l) => langs.includes(l));
	location.replace(\`/\${[chosen, browser].find((l) => langs.includes(l)) ?? "en"}/\`);
})();
</script>
<noscript><meta http-equiv="refresh" content="0; url=/it/"></noscript>
<a href="/it/">BiblioViva</a>
`;

function buildAssets(): void {
	cpSync(join(SITE, "assets"), join(DIST, "assets"), { recursive: true });
	for (const [path, bytes] of webFonts("assets/fonts/")) {
		mkdirSync(dirname(join(DIST, path)), { recursive: true });
		writeFileSync(join(DIST, path), bytes);
	}
	if (existsSync(SHOTS)) {
		cpSync(SHOTS, join(DIST, "shots"), { recursive: true });
	}
	writeFileSync(join(DIST, "index.html"), ROOT_PAGE);
	const nf = plainPage("it", t("it", "notFound"), t("it", "notFoundLead"), "", (to) => `/${to}/`);
	writeFileSync(join(DIST, "404.html"), nf);
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
	rmSync(DIST, { recursive: true, force: true });
	mkdirSync(DIST, { recursive: true });
	discover();
	// Steps before paths, so that a path page can quote the opening sentence of each step.
	for (const page of pages.filter((p) => p.kind === "step")) {
		buildStep(page);
	}
	for (const page of pages) {
		if (page.kind === "step") {
			continue;
		}
		if (page.kind === "generated") {
			buildTechIndex(page.lang);
		} else {
			buildRegular(page);
		}
	}
	for (const lang of LANGS) {
		buildHome(lang);
		buildAz(lang);
	}
	buildAssets();
	await buildSearch();

	const count = pages.length + LANGS.length * 2;
	console.log(`site: ${count} pages in ${relative(ROOT, DIST)}/`);
	if (missingFigures.size > 0) {
		console.log(`site: ${missingFigures.size} pictures missing (placeholders shown)`);
	}
	if (warnings.length > 0) {
		console.log(`site: ${warnings.length} warnings`);
		for (const w of warnings.slice(0, 25)) {
			console.log(`  ${w}`);
		}
		if (warnings.length > 25) {
			console.log(`  … and ${warnings.length - 25} more`);
		}
	}
}

await main();
