// SPDX-License-Identifier: GPL-3.0-or-later
// The school-library classification scheme (PLAN.md §3.17) as the UI and the services see it:
// fiction genres, the one-or-two-level non-fiction taxonomy (children inherit image and colour),
// the associated class flag, the class-per-copy flag and the call number patterns.

export interface ClassificationLeaf {
	code: string;
	label: string;
	image?: string | null;
	color?: string | null;
}

export interface ClassificationNode extends ClassificationLeaf {
	children?: ClassificationLeaf[];
}

/** A reading level: the code is stored on the books and printed in the call number. */
export interface ReadingLevel {
	code: string;
	label: string;
}

export interface ClassificationScheme {
	fictionByClass: boolean;
	classPerItem: boolean;
	genres: ClassificationLeaf[];
	nonfiction: ClassificationNode[];
	callNumber: CallNumberScheme;
	/** `classification.readingLevels`: the reading levels of fiction, in order (Phase 12.6). */
	readingLevels: ReadingLevel[];
	/** `classification.deweyMap`: Dewey prefix → local class code (longest prefix wins). */
	deweyMap?: { prefix: string; code: string }[];
	/**
	 * `catalog.specialAuthors` (Anonimo, AA. VV.): a book without a real author takes the
	 * initials of its title in the segnatura (Q143).
	 */
	specialAuthors?: readonly string[];
}

/** A node resolved for display: its own or inherited image and colour, and its parent. */
export interface ResolvedNode {
	code: string;
	label: string;
	image: string | null;
	color: string | null;
	parent: string | null;
	/** `fiction` genres, `nonfiction` classes. */
	kind: "fiction" | "nonfiction";
}

export function genreOf(scheme: ClassificationScheme, code: string): ResolvedNode | null {
	const g = scheme.genres.find((x) => x.code === code);
	return g
		? {
				code: g.code,
				label: g.label,
				image: g.image ?? null,
				color: g.color ?? null,
				parent: null,
				kind: "fiction",
			}
		: null;
}

/** A non-fiction class by code (parent or child); children inherit the parent's image and colour. */
export function classOf(scheme: ClassificationScheme, code: string): ResolvedNode | null {
	for (const node of scheme.nonfiction) {
		if (node.code === code) {
			return {
				code: node.code,
				label: node.label,
				image: node.image ?? null,
				color: node.color ?? null,
				parent: null,
				kind: "nonfiction",
			};
		}
		for (const child of node.children ?? []) {
			if (child.code === code) {
				return {
					code: child.code,
					label: child.label,
					image: child.image ?? node.image ?? null,
					color: child.color ?? node.color ?? null,
					parent: node.code,
					kind: "nonfiction",
				};
			}
		}
	}
	return null;
}

/**
 * The URL of a genre's or class's pictogram (§3.17), versioned by its image file and colour so a
 * change made in the classification editor shows at once despite the browser cache.
 */
export function pictogramSrc(node: {
	code: string;
	image?: string | null;
	color?: string | null;
}): string {
	const version = node.image ?? node.color ?? "";
	return `/media/classification/${encodeURIComponent(node.code)}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}

/** The code and every descendant code (for "class including children" filters). */
export function classCodesUnder(scheme: ClassificationScheme, code: string): string[] {
	const node = scheme.nonfiction.find((n) => n.code === code);
	if (!node) {
		return [code];
	}
	return [code, ...(node.children ?? []).map((c) => c.code)];
}

/** The classification of a record: genre for fiction, class for non-fiction. */
export function classificationOf(
	scheme: ClassificationScheme,
	record: { kind: string | null; genreCode: string | null; classCode: string | null },
): ResolvedNode | null {
	if (record.kind === null) {
		return null;
	}
	if (record.kind === "fiction") {
		return record.genreCode ? genreOf(scheme, record.genreCode) : null;
	}
	return record.classCode ? classOf(scheme, record.classCode) : null;
}

/**
 * The local class suggested by a Dewey number through `deweyMap` (§3.17): the longest matching
 * prefix wins, and the code must exist in the taxonomy. `null` when nothing matches.
 */
export function suggestClassFromDewey(
	scheme: ClassificationScheme,
	dewey: string | null,
): string | null {
	const digits = /^\d{1,3}/.exec((dewey ?? "").trim())?.[0];
	if (!digits) {
		return null;
	}
	let best: { prefix: string; code: string } | null = null;
	for (const m of scheme.deweyMap ?? []) {
		if (digits.startsWith(m.prefix) && (!best || m.prefix.length > best.prefix.length)) {
			best = m;
		}
	}
	return best && classOf(scheme, best.code) ? best.code : null;
}

/** First three letters of the author's surname, upper-cased (`Delitto, Anna` → `DEL`). */
export function author3(author: string): string {
	const surname = author.split(/[,\s]+/).find((part) => part.length > 0) ?? "";
	return surname
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^A-Za-z]/g, "")
		.slice(0, 3)
		.toUpperCase();
}

/** What `{{text}}` proposes for a title that has no text of its own (Q143). */
export const CALL_TEXT_PROPOSALS = ["author3", "title1", "none"] as const;
export type CallTextProposal = (typeof CALL_TEXT_PROPOSALS)[number];

/** `classification.callNumber`: the scheme the segnatura is computed from (§3.17, Q143). */
export interface CallNumberScheme {
	fiction: string;
	fictionWithClass: string;
	nonfiction: string;
	text: CallTextProposal;
}

/** The order of the segnatura offered by the wizard and the classification page (Q143). */
export const CALL_NUMBER_ORDERS = ["genreLevel", "levelGenre", "genre", "free"] as const;
export type CallNumberOrder = (typeof CALL_NUMBER_ORDERS)[number];
/** Its end: the author's initials computed, proposed and editable per title, or nothing. */
export const CALL_NUMBER_ENDS = ["author", "text", "none"] as const;
export type CallNumberEnd = (typeof CALL_NUMBER_ENDS)[number];

/** The patterns of an order and an end. */
export function callNumberScheme(order: CallNumberOrder, end: CallNumberEnd): CallNumberScheme {
	if (order === "free") {
		return {
			fiction: "{{copytext}}",
			fictionWithClass: "{{copytext}}",
			nonfiction: "{{copytext}}",
			text: "none",
		};
	}
	const tail = end === "author" ? " {{author3}}" : end === "text" ? " {{text}}" : "";
	const withClass =
		order === "genreLevel"
			? "{{genre}} {{class}}"
			: order === "levelGenre"
				? "{{class}} {{genre}}"
				: "{{genre}}";
	return {
		fiction: `{{genre}}${tail}`,
		fictionWithClass: `${withClass}${tail}`,
		nonfiction: `{{code}}${tail}`,
		text: end === "text" ? "author3" : end === "none" ? "none" : "author3",
	};
}

/** A scheme where every segnatura is written by hand on the copy (the free order). */
export function isFreeScheme(scheme: CallNumberScheme): boolean {
	return [scheme.fiction, scheme.fictionWithClass, scheme.nonfiction].every(
		(p) => p.replace(/\s+/g, "") === "{{copytext}}",
	);
}

/** The order and end a scheme was made from, or null for patterns written by hand. */
export function callNumberChoice(
	scheme: CallNumberScheme,
): { order: CallNumberOrder; end: CallNumberEnd } | null {
	const same = (a: CallNumberScheme, b: CallNumberScheme): boolean =>
		a.fiction.trim() === b.fiction.trim() &&
		a.fictionWithClass.trim() === b.fictionWithClass.trim() &&
		a.nonfiction.trim() === b.nonfiction.trim() &&
		(a.text === b.text || !a.fiction.includes("{{text}}"));
	for (const order of CALL_NUMBER_ORDERS) {
		for (const end of CALL_NUMBER_ENDS) {
			if (same(scheme, callNumberScheme(order, end))) {
				return { order, end };
			}
		}
	}
	return null;
}

/** What the computation of the segnatura reads from the configuration. */
export type CallNumberRules = Pick<ClassificationScheme, "callNumber" | "specialAuthors">;

/** Leading articles skipped by the title's initials (`Il gatto` → `GAT`, `L'isola` → `ISO`). */
const ARTICLES = new Set(
	"il lo la i gli le un uno una the a an les el los las der die das ein eine".split(" "),
);

/** First three letters of the title, past a leading article (`Enciclopedia dei ragazzi` → `ENC`). */
export function title3(title: string): string {
	const words = title
		.trim()
		.replace(/^(l|un)['’]\s*/i, "")
		.split(/\s+/)
		.filter(Boolean);
	const first =
		words.length > 1 && ARTICLES.has((words[0] ?? "").toLowerCase()) ? words[1] : words[0];
	return author3(first ?? "");
}

/** The initials of the segnatura: the author's, or the title's for a special author (Anonimo). */
function initialsOf(rules: CallNumberRules, record: { author: string; title: string }): string {
	const author = record.author.trim().toLowerCase();
	return (rules.specialAuthors ?? []).some((a) => a.trim().toLowerCase() === author)
		? title3(record.title)
		: author3(record.author);
}

export interface CallNumberParts {
	/** Null for a record still to classify: no segnatura (step 9.21). */
	kind: string | null;
	genreCode: string | null;
	classCode: string | null;
	/** The level that counts for this copy: the copy's with `classPerItem`, else the record's. */
	readingLevel: string | null;
	author: string;
	title: string;
	/** The title's `{{text}}`; null follows the scheme's proposal. */
	text?: string | null;
	/** The copy's `{{copytext}}`. */
	copyText?: string | null;
}

/** The computed placeholders that file a book on its shelf: the head of the segnatura. */
const SHELF_PLACEHOLDERS = new Set(["genre", "class", "code"]);
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/** The pattern of the copy: fiction with a level, fiction, non-fiction; null to classify. */
function patternOf(scheme: CallNumberRules, parts: CallNumberParts): string | null {
	if (parts.kind === null) {
		return null;
	}
	return parts.kind === "fiction"
		? parts.readingLevel
			? scheme.callNumber.fictionWithClass
			: scheme.callNumber.fiction
		: scheme.callNumber.nonfiction;
}

/** What `{{text}}` proposes for a title (Q143): its author's initials, its title's, or nothing. */
export function callTextProposal(
	scheme: CallNumberRules,
	record: { author: string; title: string },
): string {
	const proposal = scheme.callNumber.text;
	return proposal === "author3"
		? initialsOf(scheme, record)
		: proposal === "title1"
			? record.title.trim().charAt(0).toUpperCase()
			: "";
}

/** Whether a pattern of the scheme has a placeholder (`text`, `copytext`…). */
export function schemeUses(scheme: CallNumberRules, placeholder: string): boolean {
	const { fiction, fictionWithClass, nonfiction } = scheme.callNumber;
	return [fiction, fictionWithClass, nonfiction].some((p) =>
		[...p.matchAll(PLACEHOLDER)].some((m) => m[1] === placeholder),
	);
}

function render(pattern: string, values: Record<string, string>): string {
	return pattern
		.replace(PLACEHOLDER, (_, key: string) => values[key] ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

function valuesOf(scheme: CallNumberRules, parts: CallNumberParts): Record<string, string> {
	return {
		genre: parts.genreCode ?? "",
		class: parts.readingLevel ?? "",
		code: parts.classCode ?? "",
		author3: initialsOf(scheme, parts),
		title1: parts.title.trim().charAt(0).toUpperCase(),
		text: (parts.text ?? callTextProposal(scheme, parts)).trim(),
		copytext: (parts.copyText ?? "").trim(),
	};
}

/**
 * The segnatura of a copy computed from the scheme (§3.17, Q143): `full` is the whole of it,
 * `head` its shelf part (the classification placeholders it begins with, printed large on the
 * spine band, the shelf of the inventory). Null for a record still to classify or an empty result.
 */
export function computeCallNumber(
	scheme: CallNumberRules,
	parts: CallNumberParts,
): { full: string; head: string } | null {
	const pattern = patternOf(scheme, parts);
	if (pattern === null) {
		return null;
	}
	const values = valuesOf(scheme, parts);
	const full = render(pattern, values);
	if (full === "") {
		return null;
	}
	const names = [...pattern.matchAll(PLACEHOLDER)].map((m) => m[1] ?? "");
	if (!names.some((n) => SHELF_PLACEHOLDERS.has(n))) {
		// a segnatura written by hand: its last word is the rest, as on the old labels
		return { full, head: splitCallNumber(full).head };
	}
	// the head: the pattern up to the first placeholder that does not file the book
	let cut = pattern.length;
	for (const m of pattern.matchAll(PLACEHOLDER)) {
		if (!SHELF_PLACEHOLDERS.has(m[1] ?? "")) {
			cut = m.index;
			break;
		}
	}
	return { full, head: render(pattern.slice(0, cut), values) };
}

/** The whole segnatura, or "" (previews). */
export function suggestCallNumber(scheme: CallNumberRules, parts: CallNumberParts): string {
	return computeCallNumber(scheme, parts)?.full ?? "";
}

/**
 * The written parts of a segnatura read back from a whole one (the catalogue import, a change of
 * scheme): what stands where `{{text}}` and `{{copytext}}` are, once the computed parts around
 * them are taken off. A part the string does not show stays undefined.
 */
export function readCallNumber(
	scheme: CallNumberRules,
	parts: CallNumberParts,
	written: string,
): { text?: string; copyText?: string } {
	const pattern = patternOf(scheme, parts);
	const value = written.replace(/\s+/g, " ").trim();
	if (pattern === null || value === "") {
		return {};
	}
	const values = valuesOf(scheme, parts);
	const out: { text?: string; copyText?: string } = {};
	for (const [name, key] of [
		["text", "text"],
		["copytext", "copyText"],
	] as const) {
		const at = [...pattern.matchAll(PLACEHOLDER)].find((m) => m[1] === name);
		if (!at) {
			continue;
		}
		const blank = { ...values, text: "", copytext: "" };
		const before = render(pattern.slice(0, at.index), blank);
		const after = render(pattern.slice(at.index + at[0].length), blank);
		if (before !== "" && value !== before && !value.startsWith(`${before} `)) {
			continue;
		}
		let rest = before === "" ? value : value.slice(before.length).trim();
		if (after !== "") {
			if (rest !== after && !rest.endsWith(` ${after}`)) {
				continue;
			}
			rest = rest.slice(0, rest.length - after.length).trim();
		}
		out[key] = rest;
	}
	return out;
}

/**
 * Splits a segnatura written by hand into the classification head and the rest (labels, §3.12):
 * the head is everything before the last word when it has at least two.
 */
export function splitCallNumber(callNumber: string): { head: string; rest: string } {
	const tokens = callNumber.trim().split(/\s+/).filter(Boolean);
	if (tokens.length < 2) {
		return { head: "", rest: callNumber.trim() };
	}
	return { head: tokens.slice(0, -1).join(" "), rest: tokens[tokens.length - 1] ?? "" };
}

/** The part of a segnatura after its head (the rest printed under it on the spine band). */
export function callNumberRest(full: string, head: string): string {
	return head !== "" && (full === head || full.startsWith(`${head} `))
		? full.slice(head.length).trim()
		: head === ""
			? full
			: splitCallNumber(full).rest;
}
