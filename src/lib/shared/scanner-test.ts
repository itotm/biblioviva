// SPDX-License-Identifier: GPL-3.0-or-later
// The scanner test of `/admin/setup` (step 8.7): what a reading looks like to BiblioViva. The text
// the scanner typed is shown as it arrived, then as the code the desk would take (the same
// normalisation as every code field, `normalizeScan`), and a difference that is not just the
// letter case says the keyboard layout of the computer does not match the scanner's.
import type { CodeTable } from "./barcodes/table.js";
import { recogniseScan, type ScanKind, type ScanResult } from "./scan.js";

/** One character the layout typed for another one (`'` for `-`). */
export interface Repair {
	typed: string;
	meant: string;
}

export interface ScanDiagnosis {
	/** What arrived, trimmed of the Enter and the spaces at its ends. */
	typed: string;
	/** The code the desk takes from it. */
	code: string;
	/** What it is (`invalid` when no format of the configuration knows it). */
	kind: ScanKind;
	/** Why it is `invalid` (the key of `common.scan.errors`). */
	reason?: ScanResult["reason"];
	/** The layout repaired characters: the scanner and the computer disagree on the keyboard. */
	layoutMishap: boolean;
	/** The characters repaired, when they can be told apart (same length); empty for a lost dash. */
	repairs: Repair[];
	/** Characters a barcode never carries (`'`, `ß`, accents…), when the reading is not a code. */
	strange: string[];
}

const BARCODE_CHARS = /^[A-Za-z0-9\-. $/+%]$/;

/** The reading `raw` of a scanner or a keyboard, judged against the format table. */
export function diagnoseScan(raw: string, table: CodeTable): ScanDiagnosis {
	const typed = raw.replace(/[\r\n\t]+$/g, "").trim();
	const { code, result } = recogniseScan(typed, table);
	// a change of case alone is not the layout's doing (a scanner may send lower case)
	const layoutMishap = typed !== "" && code.toUpperCase() !== typed.toUpperCase();
	const repairs: Repair[] = [];
	if (layoutMishap && code.length === typed.length) {
		for (let i = 0; i < typed.length; i++) {
			const a = typed.charAt(i);
			const b = code.charAt(i);
			if (a.toUpperCase() !== b.toUpperCase()) {
				repairs.push({ typed: a, meant: b });
			}
		}
	}
	const strange =
		result.kind === "invalid" && result.reason === "unrecognised"
			? [...new Set(Array.from(typed).filter((c) => !BARCODE_CHARS.test(c)))]
			: [];
	return {
		typed,
		code,
		kind: result.kind,
		reason: result.reason,
		layoutMishap,
		repairs,
		strange,
	};
}
