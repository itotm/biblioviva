// SPDX-License-Identifier: GPL-3.0-or-later
// The classification taxonomy as the editor handles it (PLAN.md step 11.1): the draft shape shared
// by the page and the service, and the inline checks the page shows before anything is sent (the
// service validates again with the configuration schema).
import { CONFIG_CODE, LEVEL_CODE } from "./input-schemas.js";
import type { CallNumberScheme } from "./classification.js";

export const TAXONOMY_KINDS = ["fiction", "nonfiction"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export interface TaxonomyLeaf {
	code: string;
	label: string;
	/** A file of `classification/images/`, `draft:<token>` for an upload not saved yet, or null. */
	image: string | null;
	color: string | null;
}

export interface TaxonomyNode extends TaxonomyLeaf {
	children: TaxonomyLeaf[];
}

/** A reading level of fiction (Phase 12.6): the code is stored on the books, the label shown. */
export interface ReadingLevelDraft {
	code: string;
	label: string;
}

export interface TaxonomyDraft {
	fictionByClass: boolean;
	/** The reading levels in order (`classification.readingLevels`). */
	readingLevels: ReadingLevelDraft[];
	classPerItem: boolean;
	genres: TaxonomyLeaf[];
	nonfiction: TaxonomyNode[];
	deweyMap: { prefix: string; code: string }[];
	callNumber: CallNumberScheme;
}

/** How much of the catalogue a code files: records and their copies. */
export interface CodeUsage {
	records: number;
	copies: number;
}

export type TaxonomyUsage = Record<TaxonomyKind, Record<string, CodeUsage>>;

/** Prefix of an uploaded pictogram that is not saved yet. */
export const DRAFT_IMAGE = "draft:";
export const LABEL_MAX = 120;
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const DEWEY_PREFIX = /^\d{1,3}$/;
/**
 * The placeholders of the call number patterns (§3.17, Q143): computed (`genre`, `class`, `code`,
 * `author3`, `title1`) and written (`text`, one per title; `copytext`, one per copy).
 */
export const CALL_NUMBER_PLACEHOLDERS = [
	"genre",
	"class",
	"code",
	"author3",
	"title1",
	"text",
	"copytext",
] as const;

/** The URL that shows an image of the draft: a staged upload or a file of the images folder. */
export function draftImageSrc(image: string): string {
	return image.startsWith(DRAFT_IMAGE)
		? `/media/classification/draft/${image.slice(DRAFT_IMAGE.length)}`
		: `/media/classification/file/${encodeURIComponent(image)}`;
}

export type LeafProblem =
	"codeRequired" | "codeFormat" | "codeTaken" | "labelRequired" | "labelLong" | "colorFormat";

/** Every code of the draft, genres and classes together (a code names one node only). */
export function draftCodes(draft: Pick<TaxonomyDraft, "genres" | "nonfiction">): string[] {
	return [
		...draft.genres.map((g) => g.code.trim()),
		...draft.nonfiction.flatMap((n) => [
			n.code.trim(),
			...n.children.map((c) => c.code.trim()),
		]),
	];
}

/** How many nodes of the draft use each code. */
export function codeCounts(
	draft: Pick<TaxonomyDraft, "genres" | "nonfiction">,
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const code of draftCodes(draft)) {
		counts[code] = (counts[code] ?? 0) + 1;
	}
	return counts;
}

/** Problems of one genre or class; `counts` tells how many nodes use each code. */
export function leafProblems(
	leaf: Pick<TaxonomyLeaf, "code" | "label" | "color">,
	counts: Readonly<Record<string, number>>,
): LeafProblem[] {
	const problems: LeafProblem[] = [];
	const code = leaf.code.trim();
	if (code === "") {
		problems.push("codeRequired");
	} else if (!CONFIG_CODE.test(code)) {
		problems.push("codeFormat");
	} else if ((counts[code] ?? 0) > 1) {
		problems.push("codeTaken");
	}
	const label = leaf.label.trim();
	if (label === "") {
		problems.push("labelRequired");
	} else if (label.length > LABEL_MAX) {
		problems.push("labelLong");
	}
	if (leaf.color !== null && !HEX_COLOR.test(leaf.color)) {
		problems.push("colorFormat");
	}
	return problems;
}

export type DeweyProblem = "prefixFormat" | "prefixTaken" | "codeUnknown";

/** Problems of the Dewey map rows, by row index. */
export function deweyProblems(
	rows: readonly { prefix: string; code: string }[],
	classCodes: readonly string[],
): DeweyProblem[][] {
	const counts = new Map<string, number>();
	for (const r of rows) {
		counts.set(r.prefix.trim(), (counts.get(r.prefix.trim()) ?? 0) + 1);
	}
	return rows.map((r) => {
		const problems: DeweyProblem[] = [];
		const prefix = r.prefix.trim();
		if (!DEWEY_PREFIX.test(prefix)) {
			problems.push("prefixFormat");
		} else if ((counts.get(prefix) ?? 0) > 1) {
			problems.push("prefixTaken");
		}
		if (!classCodes.includes(r.code)) {
			problems.push("codeUnknown");
		}
		return problems;
	});
}

/** Placeholders of a call number pattern that are not among `CALL_NUMBER_PLACEHOLDERS`. */
export function unknownPlaceholders(pattern: string): string[] {
	const known: readonly string[] = CALL_NUMBER_PLACEHOLDERS;
	return [...pattern.matchAll(/\{\{\s*([^}\s]*)\s*\}\}/g)]
		.map((m) => m[1] ?? "")
		.filter((name) => !known.includes(name));
}

/** Prefix of the reading levels in the replacements of a save (`level:4` → `5`, or "" for none). */
export const LEVEL_KEY = "level:";

/** Problems of one reading level; `counts` tells how many levels use each code. */
export function levelProblems(
	level: ReadingLevelDraft,
	counts: Readonly<Record<string, number>>,
): LeafProblem[] {
	const problems: LeafProblem[] = [];
	const code = level.code.trim();
	if (code === "") {
		problems.push("codeRequired");
	} else if (!LEVEL_CODE.test(code)) {
		problems.push("codeFormat");
	} else if ((counts[code] ?? 0) > 1) {
		problems.push("codeTaken");
	}
	const label = level.label.trim();
	if (label === "") {
		problems.push("labelRequired");
	} else if (label.length > LABEL_MAX) {
		problems.push("labelLong");
	}
	return problems;
}
