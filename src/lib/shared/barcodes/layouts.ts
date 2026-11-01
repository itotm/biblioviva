// SPDX-License-Identifier: GPL-3.0-or-later
// Scanner repair tables (PLAN.md Phase 12, Q93). A handheld scanner types the code as key presses
// of a US keyboard; when the computer uses another layout some characters come out wrong. Each
// table says what the misread characters stand for, so `normalizeScan` can try the repaired text.
// The mappings follow the physical key positions of each layout [VERIFY with a real scanner on
// each layout before a school of that country relies on them].

export const KEYBOARD_LAYOUTS = ["it", "es", "de", "fr", "uk", "us"] as const;
export type KeyboardLayout = (typeof KEYBOARD_LAYOUTS)[number];

export interface LayoutRepair {
	/** Characters typed in place of the dash (the US `-` key), plus the space some scanners send. */
	dash: readonly string[];
	/** Characters typed in place of the digits (AZERTY gives the unshifted symbols of the top row). */
	digits?: Readonly<Record<string, string>>;
	/** Letters typed in place of others (keys that move between layouts). */
	letters?: Readonly<Record<string, string>>;
}

export const LAYOUT_REPAIRS: Readonly<Record<KeyboardLayout, LayoutRepair>> = {
	// the US `-` key is the Italian `'` key; `’` and the backtick come from some phone keyboards
	it: { dash: ["'", "’", "`", " "] },
	es: { dash: ["'", " "] },
	// QWERTZ: the `-` key gives `ß`, Y and Z are swapped
	de: { dash: ["ß", " "], letters: { Y: "Z", Z: "Y" } },
	// AZERTY: the `-` key gives `)`, the digit row gives its unshifted symbols, A/Q and Z/W are
	// swapped and the US M key is the AZERTY `,` key (`?` with shift)
	fr: {
		dash: [")", " "],
		digits: {
			"&": "1",
			é: "2",
			'"': "3",
			"'": "4",
			"(": "5",
			"-": "6",
			è: "7",
			_: "8",
			ç: "9",
			à: "0",
		},
		letters: { A: "Q", Q: "A", Z: "W", W: "Z", "?": "M" },
	},
	uk: { dash: [" "] },
	us: { dash: [" "] },
};

function mapChars(text: string, table: Readonly<Record<string, string>>): string {
	return Array.from(text, (c) => table[c] ?? c).join("");
}

/**
 * The readings of a raw code worth trying, most likely first: as typed, with the dash restored,
 * in upper case, with the layout's letters and digits repaired. Duplicates are removed.
 */
export function repairCandidates(text: string, layout: KeyboardLayout): string[] {
	const repair = LAYOUT_REPAIRS[layout];
	const out: string[] = [];
	const add = (s: string): void => {
		if (!out.includes(s)) {
			out.push(s);
		}
	};
	const dashed = (s: string): string =>
		mapChars(s, Object.fromEntries(repair.dash.map((d) => [d, "-"])));
	const bases = [text];
	// AZERTY digits: only when the text has no digit at all (a scanner set to the right layout
	// types real digits, and `'` or `-` then keep their usual meaning)
	if (repair.digits && !/\d/.test(text)) {
		bases.push(mapChars(text, repair.digits));
	}
	for (const base of bases) {
		for (const s of [base, dashed(base)]) {
			add(s);
			add(s.toUpperCase());
			if (repair.letters) {
				add(mapChars(s, repair.letters));
				add(mapChars(s.toUpperCase(), repair.letters));
			}
		}
	}
	return out;
}
