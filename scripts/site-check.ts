// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-non-null-assertion -- regex groups that the patterns guarantee */
// `bun run site:check` (PLAN.md §3.23, steps 9.5, 9.5b, 9.7, 9.46, 9.53): the documentation read as the site
// build reads it, without a browser, without the screenshots and in a second or two. It fails, with a list of
// file, line and problem, on:
//   - a figure marker whose name is not in the shot list (`docs/shots.ts`);
//   - a bold text in the documentation that is not a text of that language's dictionaries (the rule and the
//     short list of exceptions: `scripts/site-check-exceptions.ts`);
//   - the languages not mirroring each other: a page missing, another number or level of headings, another
//     number of numbered steps, other figure markers;
//   - a link between Markdown files to a file or a heading that does not exist;
//   - a "Possibili problemi" box whose anchor is not in the page the build writes (9.46);
//   - a target of the app's help links (`src/lib/ui/help-links.ts`) that is not a page, and a section of it, of
//     the site in every language (9.5b);
//   - a Mermaid diagram that has no drawing (9.53), once `bun run docs:diagrams` has drawn any, or always with
//     `--drawn` (the Pages workflow);
//   - every warning the build itself gives (a section missing from its README, a problems section written
//     as a list, a step that does not exist).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { SHOTS } from "../docs/shots.ts";
import { SOURCES } from "../src/lib/server/reports/builder/catalogue.ts";
import { DOCS_LANGUAGES } from "../src/lib/ui/help-links.ts";
import { allHelpTargets } from "../src/lib/ui/help-targets.ts";
import { diagramHash, mermaidBlocks } from "./diagrams.ts";
import { slug } from "./docs-markup.ts";
import { BOLD_EXCEPTIONS } from "./site-check-exceptions.ts";
import {
	checkBoldLabels,
	checkFigureNames,
	checkLinks,
	checkParity,
	headingAnchors,
	labelMatcher,
	problemAnchors,
	type DocFile,
	type LinkTarget,
	type Problem,
} from "./site-check-lib.ts";
import {
	DOCS,
	discover,
	featuresSrc,
	LANGS,
	navGroups,
	pages,
	renderPage,
	ROOT,
	SECTIONS,
	warnings,
} from "./site-build.ts";

const DIAGRAMS = join(ROOT, "site", ".diagrams");
const DRAWN = process.argv.includes("--drawn");

// The headings of the pages of problems, and of the pages that come after them, as the build reads them.
const PROBLEMS_PAGE = "help/problems.md";
const RELATED = new Set(["pagine correlate", "related pages"]);

function markdownFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = join(dir, e.name);
		return e.isDirectory() ? markdownFiles(path) : e.name.endsWith(".md") ? [path] : [];
	});
}

/** Every Markdown file of `docs/<lang>/`, as the languages' pages. */
function docFiles(): DocFile[] {
	return LANGS.flatMap((lang) =>
		markdownFiles(join(DOCS, lang))
			.sort()
			.map((file) => ({
				path: relative(ROOT, file),
				lang,
				rel: relative(join(DOCS, lang), file),
				text: readFileSync(file, "utf8"),
			})),
	);
}

/** The texts of a dictionary language: its JSON files, the built-in reports' names and columns. */
function labelsOf(lang: string): string[] {
	const out: string[] = [];
	const walk = (value: unknown): void => {
		if (typeof value === "string") {
			out.push(value);
		} else if (value && typeof value === "object") {
			const record = value as Record<string, unknown>;
			// a text written in several languages: `{ "it": "…", "en": "…" }`
			if (typeof record[lang] === "string") {
				out.push(record[lang]);
			}
			Object.values(record).forEach(walk);
		}
	};
	const dictionaries = join(ROOT, "src", "lib", "i18n", lang);
	for (const f of readdirSync(dictionaries).filter((n) => n.endsWith(".json"))) {
		walk(JSON.parse(readFileSync(join(dictionaries, f), "utf8")));
	}
	const reports = join(ROOT, "config", "reports");
	for (const f of readdirSync(reports).filter((n) => n.endsWith(".json"))) {
		walk(JSON.parse(readFileSync(join(reports, f), "utf8")));
	}
	walk(SOURCES);
	return out;
}

const idsOfRendered = new Map<string, Set<string>>();

/** The ids of a page as the site build writes it (headings, boxes of problems), keyed by language and address. */
function renderedIds(lang: string, url: string): Set<string> | null {
	const key = `${lang}:${url}`;
	const cached = idsOfRendered.get(key);
	if (cached) {
		return cached;
	}
	const page = pages.find((p) => p.lang === lang && p.url === url && p.src !== "");
	if (!page) {
		return null;
	}
	const r = renderPage(page);
	const ids = new Set([...r.body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
	ids.add(slug(r.title));
	idsOfRendered.set(key, ids);
	return ids;
}

const anchorCache = new Map<string, Set<string>>();

function linkTarget(file: DocFile, target: string): LinkTarget {
	const from = join(ROOT, file.path);
	let abs = target === "" ? from : resolve(dirname(from), target);
	if (existsSync(abs) && statSync(abs).isDirectory() && existsSync(join(abs, "README.md"))) {
		abs = join(abs, "README.md");
	}
	if (!existsSync(abs)) {
		return { exists: false, anchors: null };
	}
	if (!abs.endsWith(".md")) {
		return { exists: true, anchors: null };
	}
	let anchors = anchorCache.get(abs);
	if (!anchors) {
		anchors = headingAnchors(readFileSync(abs, "utf8"));
		anchorCache.set(abs, anchors);
	}
	return { exists: true, anchors };
}

/** The anchors in the box of every problem of every page are in the page the build writes (9.46). */
function checkProblemBoxes(files: DocFile[]): Problem[] {
	const out: Problem[] = [];
	for (const file of files) {
		const onlyProblems = file.rel === PROBLEMS_PAGE;
		for (const box of problemAnchors(file.text, onlyProblems, RELATED)) {
			const hit = pages.filter(
				(p) => p.lang === file.lang && p.src === join(ROOT, file.path),
			);
			const missing =
				hit.length > 0 && hit.every((p) => !renderedIds(file.lang, p.url)?.has(box.anchor));
			if (missing) {
				out.push({
					check: "problems",
					file: file.path,
					line: box.line,
					message: `the box of the problem «#${box.anchor}» is not in the page the site writes`,
				});
			}
		}
	}
	return out;
}

/** Every target of the help links is a page of the site, and a section of it, in every language. */
function checkHelpTargets(): Problem[] {
	const out: Problem[] = [];
	const file = "src/lib/ui/help-targets.ts";
	const seen = new Set<string>();
	for (const target of allHelpTargets()) {
		for (const lang of DOCS_LANGUAGES) {
			const anchor = target.anchor?.[lang];
			const key = `${lang}/${target.page}#${anchor ?? ""}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			const ids = renderedIds(lang, `/${lang}/${target.page}`);
			if (!ids) {
				out.push({
					check: "help",
					file,
					line: 0,
					message: `the help target «${lang}/${target.page}» is not a page of the site`,
				});
			} else if (anchor && !ids.has(anchor)) {
				out.push({
					check: "help",
					file,
					line: 0,
					message: `the help target «${lang}/${target.page}#${anchor}» is not a section of that page`,
				});
			}
		}
	}
	return out;
}

/** Every Mermaid diagram has its drawing, once the diagrams are drawn at all (or always with `--drawn`). */
function checkDiagrams(): Problem[] {
	if (!DRAWN && !existsSync(DIAGRAMS)) {
		return [];
	}
	const out: Problem[] = [];
	const sources = new Set(pages.map((p) => p.src).filter((s) => s !== ""));
	for (const lang of LANGS) {
		if (existsSync(featuresSrc(lang))) {
			sources.add(featuresSrc(lang));
		}
	}
	for (const src of [...sources].sort()) {
		const text = readFileSync(src, "utf8");
		const lines = text.split("\n");
		const starts = lines.flatMap((l, i) => (l.startsWith("```mermaid") ? [i + 1] : []));
		mermaidBlocks(text).forEach((code, i) => {
			if (!existsSync(join(DIAGRAMS, `${diagramHash(code)}.svg`))) {
				out.push({
					check: "diagrams",
					file: relative(ROOT, src),
					line: starts[i] ?? 0,
					message:
						"the diagram has no drawing in site/.diagrams/ (bun run docs:diagrams)",
				});
			}
		});
	}
	return out;
}

/** What the build says about the documents: the warnings it gives while reading and rendering them. */
function buildWarnings(): Problem[] {
	for (const lang of LANGS) {
		for (const section of SECTIONS) {
			navGroups(lang, section);
		}
		for (const page of pages) {
			if (page.lang === lang && page.src !== "") {
				renderPage(page);
			}
		}
	}
	return (
		[...new Set(warnings)]
			// links are checked here with their line, and the headings they point to as well
			.filter((w) => !w.includes(": broken link "))
			.map((w) => {
				const at = w.indexOf(": ");
				return {
					check: "build",
					file: at > 0 ? w.slice(0, at) : "scripts/site-build.ts",
					line: 0,
					message: at > 0 ? w.slice(at + 2) : w,
				};
			})
	);
}

discover();
const files = docFiles();
const tech = [
	...new Set(pages.filter((p) => p.section === "tech" && p.src !== "").map((p) => p.src)),
].map((src): DocFile => ({
	path: relative(ROOT, src),
	lang: "en",
	rel: relative(DOCS, src),
	text: readFileSync(src, "utf8"),
}));
const matchers = new Map<string, (label: string) => boolean>(
	LANGS.map((lang) => [lang, labelMatcher(labelsOf(lang))]),
);
const shots = new Set(SHOTS.map((s) => s.name));

const problems: Problem[] = [
	...checkFigureNames([...files, ...tech], shots),
	...checkBoldLabels(files, (lang) => matchers.get(lang) ?? (() => false), BOLD_EXCEPTIONS),
	...checkParity(files, [...LANGS]),
	...checkLinks([...files, ...tech], linkTarget),
	...checkProblemBoxes(files),
	...checkHelpTargets(),
	...checkDiagrams(),
	...buildWarnings(),
];

if (problems.length > 0) {
	problems.sort(
		(a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.check.localeCompare(b.check),
	);
	for (const p of problems) {
		console.log(`${p.file}${p.line > 0 ? `:${p.line}` : ""}: [${p.check}] ${p.message}`);
	}
	const kinds = new Map<string, number>();
	for (const p of problems) {
		kinds.set(p.check, (kinds.get(p.check) ?? 0) + 1);
	}
	console.error(
		`\nsite:check: ${problems.length} problems (${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ")})`,
	);
	process.exit(1);
}
console.log(
	`site:check: ok (${files.length} pages in ${LANGS.length} languages, ${shots.size} pictures in the shot list)`,
);
