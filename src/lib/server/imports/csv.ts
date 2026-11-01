// SPDX-License-Identifier: GPL-3.0-or-later
// CSV reading for every import (PLAN.md §3.22): bytes → text (UTF-8 with or without BOM, else
// Windows-1252, the encoding of spreadsheets exported on Italian school PCs) → rows with the
// delimiter guessed by papaparse. Cells are cleaned (`cleanCell`); blank lines are dropped.
import Papa from "papaparse";

export type CsvEncoding = "utf-8" | "windows-1252";

export interface DecodedCsv {
	text: string;
	encoding: CsvEncoding;
}

/** UTF-8 when the bytes are valid UTF-8 (BOM stripped), Windows-1252 otherwise. */
export function decodeCsvBytes(bytes: Uint8Array): DecodedCsv {
	try {
		const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
		return { text, encoding: "utf-8" };
	} catch {
		return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" };
	}
}

export interface ParsedCsv {
	rows: string[][];
	/** File line (1-based) of each row, so blank lines do not shift the numbers shown to the operator. */
	lines: number[];
	delimiter: string;
}

const DELIMITERS = [";", ",", "\t", "|"];

/**
 * The delimiter that appears on every one of the first non-empty lines, the most frequent one
 * winning (papaparse's own guess gives up on very short files); `;` when none does.
 */
export function guessDelimiter(text: string): string {
	const lines = text
		.split(/\r?\n/)
		.filter((l) => l.trim() !== "")
		.slice(0, 20);
	let best = ";";
	let bestScore = 0;
	for (const d of DELIMITERS) {
		const counts = lines.map((l) => l.split(d).length - 1);
		if (counts.length === 0 || counts.some((c) => c === 0)) {
			continue;
		}
		const score = counts.reduce((a, b) => a + b, 0) / counts.length;
		if (score > bestScore) {
			best = d;
			bestScore = score;
		}
	}
	return best;
}

/** Control characters other than tab and line breaks: never part of a name, a title or a note. */
// eslint-disable-next-line no-control-regex -- the control characters are what it removes
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * A cell as the imports read it: trimmed, without control characters, and without the `'` that
 * our exports (and spreadsheets) put before a text starting like a formula (`'=…`, `'-…`).
 */
export function cleanCell(value: string): string {
	const text = value.replace(CONTROL, "").trim();
	return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

/** Rows of clean cells; `delimiter` is the one detected (`;` when the file has a single column). */
export function parseCsv(text: string): ParsedCsv {
	const delimiter = guessDelimiter(text);
	const result = Papa.parse<string[]>(text, { delimiter, transform: cleanCell });
	const rows: string[][] = [];
	const lines: number[] = [];
	result.data.forEach((row, i) => {
		if (!row.some((cell) => cell !== "")) {
			return;
		}
		rows.push(row);
		lines.push(i + 1);
	});
	return { rows, lines, delimiter };
}

/** Reads a whole file: decode, parse, and report what was detected. */
export function readCsv(bytes: Uint8Array): ParsedCsv & { encoding: CsvEncoding } {
	const decoded = decodeCsvBytes(bytes);
	return { ...parseCsv(decoded.text), encoding: decoded.encoding };
}

/** Serialises rows with `;` and a BOM so Excel opens the file with the right accents. */
export function writeCsv(rows: string[][]): string {
	return `\ufeff${Papa.unparse(rows, { delimiter: ";", newline: "\r\n", escapeFormulae: true })}\r\n`;
}
