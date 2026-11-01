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
	callNumber: { fiction: string; fictionWithClass: string; nonfiction: string };
	/** `classification.readingLevels`: the reading levels of fiction, in order (Phase 12.6). */
	readingLevels: ReadingLevel[];
	/** `classification.deweyMap`: Dewey prefix → local class code (longest prefix wins). */
	deweyMap?: { prefix: string; code: string }[];
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

export interface CallNumberParts {
	kind: "fiction" | "nonfiction";
	genreCode: string | null;
	classCode: string | null;
	readingLevel: string | null;
	author: string;
	title: string;
}

/**
 * Suggested call number from the configured patterns (§3.17): `{{genre}}`, `{{class}}`,
 * `{{code}}`, `{{author3}}`, `{{title1}}`. Fiction uses the `fictionWithClass` pattern only when
 * a reading level is present; extra spaces from empty placeholders are collapsed.
 */
export function suggestCallNumber(scheme: ClassificationScheme, parts: CallNumberParts): string {
	const pattern =
		parts.kind === "fiction"
			? parts.readingLevel
				? scheme.callNumber.fictionWithClass
				: scheme.callNumber.fiction
			: scheme.callNumber.nonfiction;
	const values: Record<string, string> = {
		genre: parts.genreCode ?? "",
		class: parts.readingLevel ?? "",
		code: parts.classCode ?? "",
		author3: author3(parts.author),
		title1: parts.title.trim().charAt(0).toUpperCase(),
	};
	return pattern
		.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Splits a call number into the classification head and the rest (labels, §3.12): the head is
 * everything before the last token when the number has at least two tokens.
 */
export function splitCallNumber(callNumber: string): { head: string; rest: string } {
	const tokens = callNumber.trim().split(/\s+/).filter(Boolean);
	if (tokens.length < 2) {
		return { head: "", rest: callNumber.trim() };
	}
	return { head: tokens.slice(0, -1).join(" "), rest: tokens[tokens.length - 1] ?? "" };
}
