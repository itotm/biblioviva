// SPDX-License-Identifier: GPL-3.0-or-later
// ISBN helpers (PLAN.md §3.7): EAN-13 check digit, ISBN-10 → ISBN-13 conversion, normalisation.

/** The shape of an ISBN-13: the 978 or 979 prefix and ten digits (check digit not verified). */
export const ISBN13_PATTERN = /^97[89]\d{10}$/;

/** The shape of an ISBN-10: nine digits and a digit or `X` (check digit not verified). */
export const ISBN10_PATTERN = /^\d{9}[\dX]$/;

/** Strip hyphens/spaces and upper-case the ISBN-10 `x` check digit. */
export function cleanIsbn(raw: string): string {
	return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function ean13Valid(digits: string): boolean {
	if (!/^\d{13}$/.test(digits)) {
		return false;
	}
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
	}
	return (10 - (sum % 10)) % 10 === Number(digits[12]);
}

export function isbn10Valid(code: string): boolean {
	if (!ISBN10_PATTERN.test(code)) {
		return false;
	}
	let sum = 0;
	for (let i = 0; i < 9; i++) {
		sum += Number(code[i]) * (10 - i);
	}
	const check = code[9] === "X" ? 10 : Number(code[9]);
	return (sum + check) % 11 === 0;
}

/** `8804668231` → `9788804668237`. The input must be a valid ISBN-10. */
export function isbn10To13(code: string): string {
	const payload = `978${code.slice(0, 9)}`;
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		sum += Number(payload[i]) * (i % 2 === 0 ? 1 : 3);
	}
	return payload + String((10 - (sum % 10)) % 10);
}

/** `9788804668237` → `8804668237`; null for 979 prefixes (they have no ISBN-10 form). */
export function isbn13To10(isbn13: string): string | null {
	if (!/^978\d{10}$/.test(isbn13)) {
		return null;
	}
	const payload = isbn13.slice(3, 12);
	let sum = 0;
	for (let i = 0; i < 9; i++) {
		sum += Number(payload[i]) * (10 - i);
	}
	const check = (11 - (sum % 11)) % 11;
	return payload + (check === 10 ? "X" : String(check));
}

/** Canonical ISBN-13 for any valid ISBN-10/13 input (hyphens allowed), `null` otherwise. */
export function toIsbn13(raw: string): string | null {
	const code = cleanIsbn(raw);
	if (code.length === 13) {
		return isIsbnBarcode(code) ? code : null;
	}
	if (code.length === 10) {
		return isbn10Valid(code) ? isbn10To13(code) : null;
	}
	return null;
}

/**
 * Canonical ISBN-13 of any input (step 3.2): hyphens and spaces stripped, ISBN-10 converted,
 * check digits verified. Add-ons (`9788804668237 12345`, EAN-2/EAN-5 price codes) are refused:
 * they are not part of the number.
 */
export function normalizeIsbn(raw: string): string | null {
	const trimmed = raw.trim();
	if (/\s\d{2,5}$/.test(trimmed) || /^\d{13}\d{2,5}$/.test(trimmed.replace(/[\s-]/g, ""))) {
		return null;
	}
	return toIsbn13(trimmed);
}

/** An EAN-13 scanned from a book: 978 or 979 prefix with a valid check digit. */
export function isIsbnBarcode(ean13: string): boolean {
	return ISBN13_PATTERN.test(ean13) && ean13Valid(ean13);
}
