// SPDX-License-Identifier: GPL-3.0-or-later
// The rule that copies and cards can never be confused (PLAN.md Phase 12, Q90). Two formats are
// compared position by position: they can share a code only when they have the same length and
// every position allows a common character. The check character's value is never relied on.
//
//   errors:   a copy format and a card format share a code — as written, without their dashes,
//             or against the other kind's legacy shapes, the plain old numbers or an ISBN/ISSN;
//             the current copy and card formats look alike (no visible sign tells them apart)
//   warnings: legacy shapes of the two kinds overlap (old data, resolved by a lookup), or a
//             format has the shape of an ISBN-10 typed without hyphens
import {
	letterPositions,
	separatorPositions,
	withoutSeparators,
	type CompiledFormat,
	type Slot,
} from "./pattern.js";
import type { CodeKind, CodeTable } from "./table.js";

const DIGITS = "0123456789";

/** The characters allowed at every position. */
export type Shape = string[];

function slotChars(slot: Slot): string {
	switch (slot.type) {
		case "digit":
			return DIGITS;
		case "letter":
			return slot.letters;
		case "char":
			return slot.char;
	}
}

export function shapeOf(format: CompiledFormat): Shape {
	return format.slots.map(slotChars);
}

/** A text both shapes accept, or null when they are disjoint. */
export function commonCode(a: Shape, b: Shape): string | null {
	if (a.length !== b.length) {
		return null;
	}
	let out = "";
	for (let i = 0; i < a.length; i++) {
		const ai = a[i] ?? "";
		const bi = b[i] ?? "";
		const common = Array.from(ai).find((c) => bi.includes(c));
		if (common === undefined) {
			return null;
		}
		out += common;
	}
	return out;
}

const ISBN13: Shape = ["9", "7", "789", ...Array<string>(10).fill(DIGITS)];
const ISBN10: Shape = [...Array<string>(9).fill(DIGITS), `${DIGITS}X`];

function plainShapes(maxLength: number): Shape[] {
	return Array.from({ length: maxLength }, (_, i) => Array<string>(i + 1).fill(DIGITS));
}

export type FormatIssueCode =
	| "overlap"
	| "overlapWithoutDash"
	| "overlapLegacy"
	| "overlapPlain"
	| "overlapIsbn"
	| "overlapIsbn10"
	| "lookAlike";

export interface FormatIssue {
	code: FormatIssueCode;
	severity: "error" | "warning";
	/** The format the issue is about and the one (or the shape) it collides with. */
	kind: CodeKind;
	pattern: string;
	otherKind?: CodeKind;
	otherPattern?: string;
	/** A code both would accept (the overlaps). */
	example?: string;
}

/** Whether a person can tell two formats apart: length ±2, a letter elsewhere, or other dashes. */
export function visiblyDifferent(a: CompiledFormat, b: CompiledFormat): boolean {
	const same = (x: number[], y: number[]): boolean =>
		x.length === y.length && x.every((v, i) => v === y[i]);
	return (
		Math.abs(a.length - b.length) >= 2 ||
		!same(letterPositions(a), letterPositions(b)) ||
		!same(separatorPositions(a), separatorPositions(b))
	);
}

function other(kind: CodeKind): CodeKind {
	return kind === "item" ? "card" : "item";
}

/** Every issue of a format table; the configuration is refused while any `error` is listed. */
export function checkCodeTable(table: CodeTable): FormatIssue[] {
	const issues: FormatIssue[] = [];
	const generated = (kind: CodeKind): CompiledFormat[] => [
		table[kind].current,
		...table[kind].retired,
	];
	const plain = plainShapes(table.formats.plainMaxLength);

	for (const kind of ["item", "card"] as const) {
		const theirs = other(kind);
		for (const f of generated(kind)) {
			const base = { kind, pattern: f.def.pattern };
			// against the other kind's generated formats (each pair once) and legacy shapes
			const against = [
				...(kind === "item" ? generated(theirs) : []),
				...table[theirs].legacy,
			];
			for (const g of against) {
				const example = commonCode(shapeOf(f), shapeOf(g));
				const target = { otherKind: theirs, otherPattern: g.def.pattern };
				if (example !== null) {
					issues.push({
						...base,
						...target,
						code: "overlap",
						severity: "error",
						example,
					});
					continue;
				}
				const bare = commonCode(
					shapeOf(withoutSeparators(f)),
					shapeOf(withoutSeparators(g)),
				);
				if (bare !== null) {
					issues.push({
						...base,
						...target,
						code: "overlapWithoutDash",
						severity: "error",
						example: bare,
					});
				}
			}
			for (const p of plain) {
				const example = commonCode(shapeOf(f), p);
				if (example !== null) {
					issues.push({ ...base, code: "overlapPlain", severity: "error", example });
					break;
				}
			}
		}
		for (const f of [...generated(kind), ...table[kind].legacy]) {
			const base = { kind, pattern: f.def.pattern };
			for (const s of [shapeOf(f), shapeOf(withoutSeparators(f))]) {
				const isbn = commonCode(s, ISBN13);
				if (isbn !== null) {
					issues.push({ ...base, code: "overlapIsbn", severity: "error", example: isbn });
					break;
				}
			}
			// legacy cards and copies shaped like an ISBN-10 are old data the lookup resolves
			const isbn10 = table[kind].legacy.includes(f) ? null : commonCode(shapeOf(f), ISBN10);
			if (isbn10 !== null) {
				issues.push({
					...base,
					code: "overlapIsbn10",
					severity: "warning",
					example: isbn10,
				});
			}
		}
	}
	for (const f of table.item.legacy) {
		for (const g of table.card.legacy) {
			const example = commonCode(shapeOf(f), shapeOf(g));
			if (example !== null) {
				issues.push({
					kind: "item",
					pattern: f.def.pattern,
					otherKind: "card",
					otherPattern: g.def.pattern,
					code: "overlapLegacy",
					severity: "warning",
					example,
				});
			}
		}
	}
	if (!visiblyDifferent(table.item.current, table.card.current)) {
		issues.push({
			kind: "item",
			pattern: table.item.current.def.pattern,
			otherKind: "card",
			otherPattern: table.card.current.def.pattern,
			code: "lookAlike",
			severity: "error",
		});
	}
	return issues;
}
