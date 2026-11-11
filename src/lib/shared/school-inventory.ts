// SPDX-License-Identifier: GPL-3.0-or-later
// The school inventory of the copies (PLAN.md step 9.64, Q155): the inventory number as typed or
// proposed, and the value in euro as typed (`12,50`, `12.50`, `€ 1.200,00`) and stored in cents.
// Shared by the copy form, the services and the catalogue import.

/** An inventory number: letters, digits and the separators `.`, `/` and `-`, at most 20. */
const INVENTORY_NUMBER = /^[0-9A-Za-z](?:[0-9A-Za-z./-]{0,19})$/;

export function validInventoryNumber(text: string): boolean {
	return INVENTORY_NUMBER.test(text);
}

/** A number of digits only: the next ones of a series follow it. */
export function numericInventoryNumber(text: string): boolean {
	return /^\d{1,15}$/.test(text);
}

/**
 * The inventory numbers of `count` new copies starting from `first`: the following integers for
 * a number of digits only (keeping its leading zeros: `0098` → `0099`, `0100`), `null` when a
 * series cannot follow a number with letters.
 */
export function inventorySeries(first: string, count: number): string[] | null {
	if (count === 1) {
		return [first];
	}
	if (!numericInventoryNumber(first)) {
		return null;
	}
	const start = Number(first);
	return Array.from({ length: count }, (_, i) => String(start + i).padStart(first.length, "0"));
}

/**
 * The value typed in euro, in cents: `12`, `12,5`, `12.50`, `€ 12,50`, `1.200,00`, `1,200.00`;
 * `null` for an empty field, `NaN` for what is not an amount (negative ones included).
 */
export function parseEuro(text: string): number | null {
	let t = text.replace(/€|eur(o)?/gi, "").replace(/\s/g, "");
	if (t === "") {
		return null;
	}
	if (!/^\d[\d.,]*$/.test(t)) {
		return Number.NaN;
	}
	const lastComma = t.lastIndexOf(",");
	const lastDot = t.lastIndexOf(".");
	// the decimal separator is the last of the two when it has one or two digits after it
	const sep = Math.max(lastComma, lastDot);
	if (sep >= 0 && t.length - sep - 1 <= 2) {
		const whole = t.slice(0, sep).replace(/[.,]/g, "");
		const cents = t.slice(sep + 1).padEnd(2, "0");
		t = `${whole}.${cents}`;
	} else {
		t = t.replace(/[.,]/g, "");
	}
	const value = Math.round(Number(t) * 100);
	return Number.isFinite(value) && value <= 100_000_000_00 ? value : Number.NaN;
}

/** The cents as typed in a field: `1250` → `12,50` (Italian) or `12.50`. */
export function euroInput(cents: number | null, locale: string): string {
	if (cents === null) {
		return "";
	}
	const text = (cents / 100).toFixed(2);
	return locale === "it" ? text.replace(".", ",") : text;
}

/** The cents shown in a page: `€ 12,50`. */
export function formatEuro(cents: number | null, locale: string): string {
	if (cents === null) {
		return "";
	}
	return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
		cents / 100,
	);
}
