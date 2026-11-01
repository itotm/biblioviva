// SPDX-License-Identifier: GPL-3.0-or-later
// Ready-made pairs of formats for copies and cards (PLAN.md Phase 12, Q91): every pair follows the
// rule that the two kinds can never be confused (compare.ts), whatever check algorithm is chosen.
import type { CheckAlgorithm } from "./check.js";
import type { FormatDef } from "./pattern.js";
import type { CodeFormats } from "./table.js";

export const CODE_PRESETS = ["standard", "classic", "prefix"] as const;
export type CodePreset = (typeof CODE_PRESETS)[number];

/** The default for new installations (Q91–Q92): `2026-E0267` and `U012345`. */
export const DEFAULT_CODE_PRESET: CodePreset = "standard";
export const DEFAULT_CHECK: CheckAlgorithm = "mod23";

const PATTERNS: Readonly<Record<CodePreset, { item: string; card: string }>> = {
	// year, dash, check, counter / check and a 6-digit counter
	standard: { item: "YYYY-CNNNN", card: "CNNNNNN" },
	// the formats of BiblioViva until Phase 12 (PLAN.md §3.7, Q7–Q8)
	classic: { item: "YYYY-NNNNC", card: "NNNNNNNNNC" },
	// a letter in front tells the kind: L for libro (copy), T for tessera (card)
	prefix: { item: "'L'-YYNNNNC", card: "'T'NNNNNNC" },
};

export function presetFormats(
	preset: CodePreset,
	check: CheckAlgorithm,
): { item: FormatDef; card: FormatDef } {
	const p = PATTERNS[preset];
	return { item: { pattern: p.item, check }, card: { pattern: p.card, check } };
}

/** The ready-made format of one kind: the copies of one preset may go with the cards of another. */
export function kindFormat(
	kind: "item" | "card",
	preset: CodePreset,
	check: CheckAlgorithm,
): FormatDef {
	return { pattern: PATTERNS[preset][kind], check };
}

/** The formats of a new installation without codes from an older system. */
export const DEFAULT_CODE_FORMATS: CodeFormats = {
	item: {
		current: presetFormats(DEFAULT_CODE_PRESET, DEFAULT_CHECK).item,
		retired: [],
		legacy: [],
	},
	card: {
		current: presetFormats(DEFAULT_CODE_PRESET, DEFAULT_CHECK).card,
		retired: [],
		legacy: [],
	},
	plainMaxLength: 0,
	libraryCode: "",
	layout: "it",
};
