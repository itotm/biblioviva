// SPDX-License-Identifier: GPL-3.0-or-later
// The rows behind a code (§3.7): the copy of a barcode and the patron of a card number, and what a
// scanned code is, for the desk, the scan mode of the print lists, the catalogue's quick search and
// the guard that keeps the two kinds apart.
import { and, eq, ne } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, patron } from "#lib/server/db/schema.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { shortTitle } from "#lib/shared/desk-titles.js";
import { patronFullName } from "#lib/shared/patron-name.js";
import { recogniseScan } from "#lib/shared/scan.js";

/** The copy of a barcode, with the title of its record. */
export function itemByBarcode(
	db: DbOrTx,
	barcode: string,
): { id: number; biblioId: number; title: string } | null {
	return (
		db
			.select({ id: item.id, biblioId: item.biblioId, title: biblio.title })
			.from(item)
			.innerJoin(biblio, eq(biblio.id, item.biblioId))
			.where(eq(item.barcode, barcode))
			.get() ?? null
	);
}

/** The patron of a card number; a removed (anonymized) patron only when `anonymized` is asked. */
export function patronByCard(
	db: DbOrTx,
	cardNumber: string,
	options: { anonymized?: boolean } = {},
): { id: number; firstName: string; lastName: string } | null {
	return (
		db
			.select({ id: patron.id, firstName: patron.firstName, lastName: patron.lastName })
			.from(patron)
			.where(
				options.anonymized
					? eq(patron.cardNumber, cardNumber)
					: and(eq(patron.cardNumber, cardNumber), ne(patron.status, "anonymized")),
			)
			.get() ?? null
	);
}

export type ScanTarget =
	| { kind: "patron"; patronId: number; code: string; name: string }
	| { kind: "item"; itemId: number; code: string; title: string }
	| {
			kind: "ambiguous";
			patronId: number;
			itemId: number;
			code: string;
			name: string;
			title: string;
	  }
	| { kind: "unknown"; code: string }
	| { kind: "badCheckDigit"; code: string };

function deskPatronByCard(db: DbOrTx, code: string): { id: number; name: string } | null {
	const p = patronByCard(db, code);
	return p ? { id: p.id, name: patronFullName(p) } : null;
}

function deskItemByBarcode(db: DbOrTx, code: string): { id: number; title: string } | null {
	const i = itemByBarcode(db, code);
	return i ? { id: i.id, title: shortTitle(i.title) } : null;
}

/**
 * Resolves a scanned or typed code (§3.7): a card, a copy, or a legacy plain number that may be
 * either (both found → `ambiguous`, the desk asks). Anonymized patrons' cards are not found.
 */
export function resolveScan(db: DbOrTx, raw: string, codes: CodeTable): ScanTarget {
	const { code, result: r } = recogniseScan(raw, codes);
	if (r.kind === "invalid") {
		return r.reason === "item_check_digit" ||
			r.reason === "card_check_digit" ||
			r.reason === "isbn_check_digit"
			? { kind: "badCheckDigit", code }
			: { kind: "unknown", code };
	}
	const value = r.value;
	if (r.kind === "card") {
		const p = deskPatronByCard(db, value);
		return p
			? { kind: "patron", patronId: p.id, code: value, name: p.name }
			: { kind: "unknown", code: value };
	}
	if (r.kind === "item" || r.kind === "legacy_item") {
		const i = deskItemByBarcode(db, value);
		return i
			? { kind: "item", itemId: i.id, code: value, title: i.title }
			: { kind: "unknown", code: value };
	}
	if (r.kind === "ambiguous") {
		const p = deskPatronByCard(db, value);
		const i = deskItemByBarcode(db, value);
		if (p && i) {
			return {
				kind: "ambiguous",
				patronId: p.id,
				itemId: i.id,
				code: value,
				name: p.name,
				title: i.title,
			};
		}
		if (p) {
			return { kind: "patron", patronId: p.id, code: value, name: p.name };
		}
		if (i) {
			return { kind: "item", itemId: i.id, code: value, title: i.title };
		}
	}
	// an ISBN is the book, not the copy: the desk needs the copy's own label
	return { kind: "unknown", code: value };
}
