// SPDX-License-Identifier: GPL-3.0-or-later
// Check characters of the generated codes (PLAN.md Phase 12, Q91–Q92): Luhn and Damm give a digit,
// mod 23 gives a letter. Every algorithm works on the digits of the payload in their order, wherever
// the check character stands in the pattern.

export const CHECK_ALGORITHMS = ["luhn", "damm", "mod23"] as const;
export type CheckAlgorithm = (typeof CHECK_ALGORITHMS)[number];

/** The 23 letters of the mod-23 check: the alphabet without `I`, `O` and `Q` (they read as 1, 0, 0). */
export const MOD23_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

/** Upper-case letters allowed in codes (literals and check letters). */
export const CODE_LETTERS = MOD23_LETTERS;

const DIGITS = "0123456789";

/** The characters a check of this algorithm can be. */
export function checkAlphabet(algorithm: CheckAlgorithm): string {
	return algorithm === "mod23" ? MOD23_LETTERS : DIGITS;
}

function assertDigits(digits: string): void {
	if (!/^\d+$/.test(digits)) {
		throw new Error(`check: not a digit string: "${digits}"`);
	}
}

/** Luhn (mod 10): the digit that makes the payload followed by it Luhn-valid. */
export function luhnCheckDigit(digits: string): number {
	assertDigits(digits);
	let sum = 0;
	let double = true; // the rightmost payload digit is doubled
	for (let i = digits.length - 1; i >= 0; i--) {
		let d = Number(digits[i]);
		if (double) {
			d *= 2;
			if (d > 9) {
				d -= 9;
			}
		}
		sum += d;
		double = !double;
	}
	return (10 - (sum % 10)) % 10;
}

// Damm's totally anti-symmetric quasigroup of order 10 (H. M. Damm, 2004): every single-digit
// error and every adjacent transposition changes the result.
const DAMM: readonly (readonly number[])[] = [
	[0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
	[7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
	[4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
	[1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
	[6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
	[3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
	[5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
	[8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
	[9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
	[2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

export function dammCheckDigit(digits: string): number {
	assertDigits(digits);
	let interim = 0;
	for (const c of digits) {
		interim = DAMM[interim]?.[Number(c)] ?? 0;
	}
	return interim;
}

/**
 * The mod-23 check letter (the scheme of the Spanish DNI letter on an alphabet without `I O Q`):
 * the payload's value modulo 23. A single-digit error, an adjacent or jump transposition or a twin
 * error changes the value by d·10ᵏ, 9·d·10ᵏ, 99·d·10ᵏ or 11·d·10ᵏ (1 ≤ d ≤ 9), never a multiple
 * of the prime 23, so the letter changes too.
 */
export function mod23CheckLetter(digits: string): string {
	assertDigits(digits);
	let rest = 0;
	for (const c of digits) {
		rest = (rest * 10 + Number(c)) % 23;
	}
	return MOD23_LETTERS.charAt(rest);
}

/** The check character of a payload (its digits in order). */
export function checkCharacter(algorithm: CheckAlgorithm, digits: string): string {
	switch (algorithm) {
		case "luhn":
			return String(luhnCheckDigit(digits));
		case "damm":
			return String(dammCheckDigit(digits));
		case "mod23":
			return mod23CheckLetter(digits);
	}
}
