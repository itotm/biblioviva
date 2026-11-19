// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-non-null-assertion -- regex groups and list lookups that the patterns and the loops guarantee */
// The pure parts of `bun run site:check` (PLAN.md §3.23, steps 9.5, 9.5b, 9.7, 9.46, 9.53): what the
// check reads in a Markdown text (headings, numbered steps, figure markers, bold labels, links) and the
// comparisons it makes. No file is read here: `scripts/site-check.ts` finds the files, the dictionaries
// and the pages the site build produces, and hands them over.
import { FIGURE_MARKER_SOURCE, slug } from "./docs-markup.ts";

/** A Markdown file of a language: `path` is how a message names it, `rel` its place under `docs/<lang>/`. */
export interface DocFile {
	path: string;
	lang: string;
	rel: string;
	text: string;
}

export interface Problem {
	/** The kind of check that found it (`figure`, `bold`, `headings`, `steps`, `links`, …). */
	check: string;
	file: string;
	/** 0 when the problem is about the file as a whole. */
	line: number;
	message: string;
}

// ---------------------------------------------------------------- reading Markdown

/** The number of the line a character is on (1-based). */
function lineAt(text: string, index: number): number {
	let line = 1;
	for (let i = text.indexOf("\n"); i !== -1 && i < index; i = text.indexOf("\n", i + 1)) {
		line += 1;
	}
	return line;
}

/** The text with the fenced code blocks blanked (every character kept in place, so lines and offsets stay). */
export function maskFences(text: string): string {
	let fence: { char: string; length: number } | null = null;
	const blank = (line: string): string => line.replace(/[^\n]/g, " ");
	return text
		.split("\n")
		.map((line) => {
			const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
			const marker = m?.[1];
			if (!fence) {
				if (marker && !(marker.startsWith("`") && (m?.[2] ?? "").includes("`"))) {
					fence = { char: marker[0] ?? "`", length: marker.length };
					return blank(line);
				}
				return line;
			}
			if (
				marker?.startsWith(fence.char) &&
				marker.length >= fence.length &&
				(m?.[2] ?? "").trim() === ""
			) {
				fence = null;
			}
			return blank(line);
		})
		.join("\n");
}

/** The text with the HTML comments blanked (newlines kept). */
export function maskComments(text: string): string {
	return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}

/** The text with the content of inline code spans blanked, or only their asterisks changed. */
function maskInlineCode(text: string, keepText: boolean): string {
	return text.replace(/(`+)(?!`)([^\n]*?[^`\n])\1(?!`)/g, (m, ticks: string, body: string) =>
		keepText ? `${ticks}${body.replace(/\*/g, "+")}${ticks}` : m.replace(/[^\n]/g, " "),
	);
}

/** What a reader sees of a heading's Markdown: links, code and emphasis without their marks. */
function headingText(markdown: string): string {
	return markdown
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, "")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/(\*\*|__|\*|_)(?=\S)([\s\S]*?\S)\1/g, "$2")
		.trim();
}

export interface Heading {
	level: number;
	text: string;
	line: number;
}

/** The headings of a page, outside code and comments. */
export function headings(text: string): Heading[] {
	const out: Heading[] = [];
	maskComments(maskFences(text))
		.split("\n")
		.forEach((line, i) => {
			const m = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*(?:#+[ \t]*)?$/.exec(line);
			if (m) {
				out.push({ level: m[1]!.length, text: headingText(m[2]!), line: i + 1 });
			}
		});
	return out;
}

/** The anchor of each heading of a page, as GitHub (and the site) make them: repeats get `-1`, `-2`. */
export function anchorList(text: string): { heading: Heading; anchor: string }[] {
	const seen = new Map<string, number>();
	return headings(text).map((heading) => {
		const base = slug(heading.text);
		const n = seen.get(base) ?? 0;
		seen.set(base, n + 1);
		return { heading, anchor: n === 0 ? base : `${base}-${n}` };
	});
}

export function headingAnchors(text: string): Set<string> {
	return new Set(anchorList(text).map((a) => a.anchor));
}

/** An ordered list: where it starts and how many steps it has. */
export interface OrderedList {
	line: number;
	items: number;
}

/** The numbered lists of a page (nested ones apart), as the steps the reader follows. */
export function orderedLists(text: string): OrderedList[] {
	const out: OrderedList[] = [];
	// the open lists, by the column of their numbers
	let open: { indent: number; list: OrderedList }[] = [];
	// a comment line (a variant marker) is text that ends the list it follows, its other lines are blank
	maskFences(text)
		.replace(/<!--[\s\S]*?-->/g, (m) => `<${m.slice(1).replace(/[^\n]/g, " ")}`)
		.split("\n")
		.forEach((raw, i) => {
			if (raw.trim() === "") {
				return;
			}
			const indent = raw.length - raw.trimStart().length;
			const item = /^\s*\d{1,3}[.)]\s+\S/.test(raw);
			// a line at or left of an open list's numbers ends it, unless it is another number of it
			open = open.filter((o) => indent > o.indent || (item && indent === o.indent));
			if (!item) {
				return;
			}
			const same = open.find((o) => o.indent === indent);
			if (same) {
				same.list.items += 1;
				return;
			}
			const list = { line: i + 1, items: 1 };
			out.push(list);
			open.push({ indent, list });
		});
	return out;
}

export interface FigureMarker {
	kind: string;
	name: string;
	/** Missing when the marker has none (the site then shows the name). */
	caption: string | undefined;
	line: number;
}

/** The figure markers of a page (outside code blocks). */
export function figureMarkers(text: string): FigureMarker[] {
	const masked = maskFences(text);
	return [...masked.matchAll(new RegExp(FIGURE_MARKER_SOURCE, "g"))].map((m) => ({
		kind: m[1] ?? "figure",
		name: (m[2] ?? "").trim(),
		caption: m[3]?.trim() || undefined,
		line: lineAt(masked, m.index ?? 0),
	}));
}

export interface BoldSpan {
	text: string;
	line: number;
	/** The label that opens a variant block (`**Con Tailscale**`): not a label of the interface. */
	variantLabel: boolean;
}

/** The bold texts of a page, outside code and comments; a text may continue on the next lines. */
export function boldSpans(text: string): BoldSpan[] {
	const original = text.split("\n");
	const masked = maskInlineCode(maskComments(maskFences(text)), true);
	const out: BoldSpan[] = [];
	for (const m of masked.matchAll(/\*\*(?=\S)((?:(?!\n[ \t]*\n)[\s\S])+?)(?<=\S)\*\*/g)) {
		const line = lineAt(masked, m.index ?? 0);
		const row = (original[line - 1] ?? "").trim();
		let before = line - 2;
		while (before >= 0 && (original[before] ?? "").trim() === "") {
			before -= 1;
		}
		out.push({
			// a bold text may run over a line break, and a quotation's `>` begins each line
			text: text
				.slice((m.index ?? 0) + 2, (m.index ?? 0) + m[0].length - 2)
				.replace(/\n[ \t>]*/g, " "),
			line,
			variantLabel:
				row.startsWith("**") &&
				row.endsWith("**") &&
				/^<!--\s*variant:/.test((original[before] ?? "").trim()),
		});
	}
	return out;
}

export interface LinkRef {
	href: string;
	line: number;
}

/** The links of a page, `[text](target)`, outside code; external ones are left out. */
export function links(text: string): LinkRef[] {
	const masked = maskInlineCode(maskComments(maskFences(text)), false);
	const out: LinkRef[] = [];
	for (const m of masked.matchAll(
		/(?<!!)\[(?:[^\][]|\[[^\]]*\])*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g,
	)) {
		const href = (m[1] ?? "").replace(/^<|>$/g, "");
		if (/^(https?:|mailto:|tel:|\/\/)/.test(href)) {
			continue;
		}
		out.push({ href, line: lineAt(masked, m.index ?? 0) });
	}
	return out;
}

// ---------------------------------------------------------------- labels of the interface

/** A label compared the way the check does: one line, plain quotes, no final colon, dot or ellipsis. */
export function normalizeLabel(text: string): string {
	return text
		.replace(/`/g, "")
		.replace(/[‘’]/g, "'")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[:.…\s]+$/, "")
		.trim();
}

const MAX_ALTERNATIVES = 16;

/** The plural forms of a dictionary text written out: `{{n:plural; one:copia; other:copie;}}` gives both. */
function expandPlurals(value: string): string[] {
	const plural = /\{\{\s*[\w.]+\s*:\s*plural\s*;((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/;
	let all = [value];
	for (let guard = 0; guard < 6; guard += 1) {
		const next: string[] = [];
		let changed = false;
		for (const text of all) {
			const m = plural.exec(text);
			if (!m) {
				next.push(text);
				continue;
			}
			changed = true;
			const forms = [...(m[1] ?? "").matchAll(/\w+:((?:[^;{}]|\{\{[^{}]*\}\})*);?/g)].map(
				(f) => f[1] ?? "",
			);
			for (const form of forms.length > 0 ? forms : [""]) {
				next.push(text.slice(0, m.index) + form + text.slice((m.index ?? 0) + m[0].length));
			}
		}
		all = next.slice(0, MAX_ALTERNATIVES);
		if (!changed) {
			break;
		}
	}
	return all;
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether a text is a label of the interface: one of the given texts, compared by `normalizeLabel`
 * (so case counts, a final colon, dot or ellipsis do not). A text with placeholders (`{{n}}`, `{group}`)
 * matches whatever stands in their place, as long as it keeps at least three letters of its own; a count
 * written after a label as `(N)` or `(3)`, as a tab shows it, may be left out of the dictionary text.
 */
export function labelMatcher(values: Iterable<string>): (label: string) => boolean {
	const exact = new Set<string>();
	const patterns: RegExp[] = [];
	for (const value of values) {
		for (const text of expandPlurals(value)) {
			const parts = text.split(/\{\{[^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*\}\}|\{[^{}]*\}/);
			if (parts.length === 1) {
				exact.add(normalizeLabel(text));
				continue;
			}
			if (parts.join("").replace(/[^\p{L}]/gu, "").length < 3) {
				continue;
			}
			const source = parts
				.map((part) =>
					escapeRegex(normalizeLabel(part).replace(/\s+/g, " ")).replace(/ /g, "\\s+"),
				)
				.join("\\s*.*?\\s*");
			patterns.push(new RegExp(`^${source}$`, "u"));
		}
	}
	const known = (text: string): boolean => exact.has(text) || patterns.some((p) => p.test(text));
	return (label) => {
		const text = normalizeLabel(label);
		// the tab of a list shows its count after the label: `Prestiti in corso (N)`
		return known(text) || known(text.replace(/\s*\((?:N|n|\d+)\)$/, ""));
	};
}

/** A bold text that is not a label of the interface and is allowed (emphasis, a name from elsewhere). */
export interface BoldException {
	text: string;
	/** Only in this language, and only in files whose path under `docs/<lang>/` contains this. */
	lang?: string;
	file?: string;
	why: string;
}

// ---------------------------------------------------------------- the checks

/** Figure markers whose name is not in the shot list. */
export function checkFigureNames(files: DocFile[], shots: ReadonlySet<string>): Problem[] {
	const out: Problem[] = [];
	for (const file of files) {
		for (const m of figureMarkers(file.text)) {
			if (m.name === "") {
				out.push({
					check: "figure",
					file: file.path,
					line: m.line,
					message: `a ${m.kind} marker without a name`,
				});
			} else if (!shots.has(m.name)) {
				out.push({
					check: "figure",
					file: file.path,
					line: m.line,
					message: `«${m.name}» is not in the shot list (docs/shots.ts)`,
				});
			}
		}
	}
	return out;
}

/** Bold texts of the files that are not a label of that language's interface. */
export function checkBoldLabels(
	files: DocFile[],
	matcherOf: (lang: string) => (label: string) => boolean,
	exceptions: readonly BoldException[],
): Problem[] {
	const out: Problem[] = [];
	for (const file of files) {
		const isLabel = matcherOf(file.lang);
		for (const span of boldSpans(file.text)) {
			if (span.variantLabel) {
				continue;
			}
			const text = normalizeLabel(span.text);
			if (text === "" || isLabel(span.text)) {
				continue;
			}
			const allowed = exceptions.some(
				(e) =>
					normalizeLabel(e.text) === text &&
					(e.lang === undefined || e.lang === file.lang) &&
					(e.file === undefined || file.rel.includes(e.file)),
			);
			if (!allowed) {
				out.push({
					check: "bold",
					file: file.path,
					line: span.line,
					message: `bold «${text}» is not a text of the ${file.lang} dictionaries (a label of another program goes in quotation marks, emphasis in italics, anything else in scripts/site-check-exceptions.ts)`,
				});
			}
		}
	}
	return out;
}

/** The reference language of a set of files: Italian when there is one, else the first. */
function referenceLanguage(langs: string[]): string {
	return langs.includes("it") ? "it" : (langs[0] ?? "it");
}

/** The pages of every language by their place under `docs/<lang>/`. */
function byRel(files: DocFile[]): Map<string, Map<string, DocFile>> {
	const out = new Map<string, Map<string, DocFile>>();
	for (const file of files) {
		const entry = out.get(file.rel) ?? new Map<string, DocFile>();
		entry.set(file.lang, file);
		out.set(file.rel, entry);
	}
	return out;
}

/**
 * The languages mirror each other: every page in every language, and on each page the same headings
 * (number and levels, in order), the same number of numbered steps in each list and the same figures
 * in the same order.
 */
export function checkParity(files: DocFile[], langs: string[]): Problem[] {
	const out: Problem[] = [];
	const ref = referenceLanguage(langs);
	for (const [rel, entry] of [...byRel(files)].sort(([a], [b]) => a.localeCompare(b))) {
		const base = entry.get(ref);
		for (const lang of langs) {
			if (entry.has(lang)) {
				continue;
			}
			const other = [...entry.values()][0]!;
			out.push({
				check: "parity",
				file: `docs/${lang}/${rel}`,
				line: 0,
				message: `the page is missing: ${other.path} exists`,
			});
		}
		if (!base) {
			continue;
		}
		for (const [lang, file] of entry) {
			if (lang !== ref) {
				out.push(
					...compareHeadings(base, file),
					...compareSteps(base, file),
					...compareFigures(base, file),
				);
			}
		}
	}
	return out;
}

function compareHeadings(a: DocFile, b: DocFile): Problem[] {
	const ha = headings(a.text);
	const hb = headings(b.text);
	for (let i = 0; i < Math.max(ha.length, hb.length); i += 1) {
		const x = ha[i];
		const y = hb[i];
		if (x?.level === y?.level && x && y) {
			continue;
		}
		const show = (h: Heading | undefined, f: DocFile): string =>
			h
				? `${f.lang} ${"#".repeat(h.level)} «${h.text}» (line ${h.line})`
				: `${f.lang} has none`;
		return [
			{
				check: "headings",
				file: b.path,
				line: y?.line ?? hb.at(-1)?.line ?? 0,
				message: `headings differ from ${a.path} at heading ${i + 1} (${ha.length} in ${a.lang}, ${hb.length} in ${b.lang}): ${show(x, a)}, ${show(y, b)}`,
			},
		];
	}
	return [];
}

function compareSteps(a: DocFile, b: DocFile): Problem[] {
	const la = orderedLists(a.text);
	const lb = orderedLists(b.text);
	const same = la.length === lb.length && la.every((l, i) => l.items === lb[i]?.items);
	if (same) {
		return [];
	}
	const total = (lists: OrderedList[]): number => lists.reduce((n, l) => n + l.items, 0);
	const show = (lists: OrderedList[]): string =>
		lists.length === 0 ? "none" : lists.map((l) => `${l.items} (line ${l.line})`).join(" + ");
	let at = 0;
	while (at < la.length && at < lb.length && la[at]?.items === lb[at]?.items) {
		at += 1;
	}
	return [
		{
			check: "steps",
			file: b.path,
			line: lb[at]?.line ?? lb.at(-1)?.line ?? 0,
			message: `numbered steps differ from ${a.path}: ${a.lang} ${total(la)} steps in lists of ${show(la)}; ${b.lang} ${total(lb)} in ${show(lb)}`,
		},
	];
}

function compareFigures(a: DocFile, b: DocFile): Problem[] {
	const fa = figureMarkers(a.text);
	const fb = figureMarkers(b.text);
	for (let i = 0; i < Math.max(fa.length, fb.length); i += 1) {
		if (fa[i]?.name === fb[i]?.name) {
			continue;
		}
		return [
			{
				check: "figures",
				file: b.path,
				line: fb[i]?.line ?? fb.at(-1)?.line ?? 0,
				message: `figure markers differ from ${a.path} at marker ${i + 1}: ${a.lang} ${fa[i] ? `«${fa[i]!.name}» (line ${fa[i]!.line})` : "has none"}, ${b.lang} ${fb[i] ? `«${fb[i]!.name}»` : "has none"}`,
			},
		];
	}
	return [];
}

/** What a link points to: whether the file is there and, for a page, the anchors it has. */
export interface LinkTarget {
	exists: boolean;
	/** Null when the anchors of the target cannot be known (a file that is not a Markdown page). */
	anchors: ReadonlySet<string> | null;
}

/**
 * Links that point to a missing file or, with `#anchor`, to a heading the target does not have.
 * `resolve` finds the target of a path written in the file (`''` for the file itself).
 */
export function checkLinks(
	files: DocFile[],
	resolve: (file: DocFile, target: string) => LinkTarget,
): Problem[] {
	const out: Problem[] = [];
	for (const file of files) {
		for (const link of links(file.text)) {
			const [target = "", rawAnchor] = link.href.split("#");
			let anchor = rawAnchor;
			try {
				anchor = rawAnchor === undefined ? undefined : decodeURIComponent(rawAnchor);
			} catch {
				// keep the anchor as written
			}
			const found = resolve(file, decodeUri(target));
			if (!found.exists) {
				out.push({
					check: "links",
					file: file.path,
					line: link.line,
					message: `the link «${link.href}» points to a file that does not exist`,
				});
			} else if (anchor && found.anchors && !found.anchors.has(anchor)) {
				out.push({
					check: "links",
					file: file.path,
					line: link.line,
					message: `the link «${link.href}» points to a heading that does not exist`,
				});
			}
		}
	}
	return out;
}

function decodeUri(text: string): string {
	try {
		return decodeURI(text);
	} catch {
		return text;
	}
}

const PROBLEM_HEADINGS = new Set(["possibili problemi", "possible problems"]);

/**
 * The anchors of the headings that become the boxes of a problems section: every `###` under "Possibili
 * problemi" / "Possible problems", and on a page made of problems only every `##` but the related pages.
 */
export function problemAnchors(
	text: string,
	onlyProblems: boolean,
	relatedHeadings: ReadonlySet<string>,
): { anchor: string; line: number }[] {
	const out: { anchor: string; line: number }[] = [];
	let inProblems = false;
	for (const { heading, anchor } of anchorList(text)) {
		if (heading.level === 2) {
			inProblems = PROBLEM_HEADINGS.has(heading.text.toLowerCase());
			if (onlyProblems && !relatedHeadings.has(heading.text.toLowerCase())) {
				out.push({ anchor, line: heading.line });
			}
		} else if (heading.level === 3 && inProblems && !onlyProblems) {
			out.push({ anchor, line: heading.line });
		}
	}
	return out;
}
