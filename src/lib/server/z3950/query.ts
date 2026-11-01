// SPDX-License-Identifier: GPL-3.0-or-later
// PQF queries and the yaz-client command file (PLAN.md Appendix D). Diacritics are stripped and
// quotes escaped before a term is sent; the command file shows up to `max` records one by one.
import { ISBN10_PATTERN, ISBN13_PATTERN, isbn10To13, isbn13To10 } from "#lib/shared/isbn.js";
import { Z3950_HOST, Z3950_WORD } from "#lib/shared/z3950.js";
import type { Z3950Target } from "./targets.js";

export type Z3950Query =
	| { kind: "isbn"; isbn: string }
	| { kind: "search"; title?: string; author?: string; words?: string };

/** ASCII fold for the target: `Cosmicòmiche` → `Cosmicomiche`; quotes and control characters dropped. */
export function pqfTerm(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/["\\\n\r\t]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function buildPqf(query: Z3950Query): string {
	if (query.kind === "isbn") {
		// SBN indexes older books (before 2007) by their ISBN-10 only: a 978 ISBN is searched in
		// both forms (a scanned book otherwise came back with no record, 9.13 round 7)
		const isbn = pqfTerm(query.isbn);
		const other = ISBN13_PATTERN.test(isbn)
			? isbn13To10(isbn)
			: ISBN10_PATTERN.test(isbn.toUpperCase())
				? isbn10To13(isbn)
				: null;
		return other ? `@or @attr 1=7 ${isbn} @attr 1=7 ${other}` : `@attr 1=7 ${isbn}`;
	}
	const parts: string[] = [];
	if (query.title?.trim()) {
		parts.push(`@attr 1=4 @attr 5=1 "${pqfTerm(query.title)}"`);
	}
	if (query.author?.trim()) {
		parts.push(`@attr 1=1003 "${pqfTerm(query.author)}"`);
	}
	if (query.words?.trim()) {
		parts.push(`@attr 1=1016 "${pqfTerm(query.words)}"`);
	}
	if (parts.length === 0) {
		throw new Error("empty query");
	}
	// PQF is prefix notation: @and a b; nest for three
	return parts.reduceRight((acc, part, i) =>
		i === parts.length - 1 ? part : `@and ${part} ${acc}`,
	);
}

/**
 * The command file of one request (Appendix D). The configuration schema keeps line breaks out of
 * a target's values; a value that would still add a command (a target tried before it is saved)
 * is refused here.
 */
export function buildCommandFile(target: Z3950Target, pqf: string, max: number): string {
	const words = [target.database, target.charset, target.elements, target.syntax];
	if (
		!Z3950_HOST.test(target.host) ||
		!words.every((w) => Z3950_WORD.test(w)) ||
		/[\p{Cc}]/u.test(pqf)
	) {
		throw new Error("Z39.50 target or query with a line break or a space");
	}
	const lines = [
		`open tcp:${target.host}:${target.port}/${target.database}`,
		`charset - ${target.charset} ${target.charset}`,
		`format ${target.syntax}`,
		`elements ${target.elements}`,
		`find ${pqf}`,
	];
	for (let i = 1; i <= Math.max(1, max); i++) {
		lines.push(`show ${i}+1`);
	}
	lines.push("quit");
	return `${lines.join("\n")}\n`;
}

/** `Number of hits: 3, setno 1` → 3; null when the target never answered the search. */
export function parseHits(stdout: string): number | null {
	const m = /Number of hits:\s*(\d+)/.exec(stdout);
	return m ? Number(m[1]) : null;
}
