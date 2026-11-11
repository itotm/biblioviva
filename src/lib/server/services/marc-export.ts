// SPDX-License-Identifier: GPL-3.0-or-later
// The MARC export (PLAN.md step 9.65, Q156): the titles of a list of books or copies, each with
// its copies, written in UNIMARC or MARC 21, in ISO 2709 or MARCXML. A list of copies (a print
// list, the missing copies of a stocktaking campaign) gives its titles with those copies only.
import { asc, inArray } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { biblio, item } from "#lib/server/db/schema.js";
import { titleToMarc, type MarcCopy, type MarcTitle } from "#lib/server/marc/catalog-marc.js";
import type { MarcFlavour, MarcSyntax } from "#lib/server/marc/read.js";
import { toIso2709, toMarcxml } from "#lib/server/marc/write.js";
import { isoDateIn } from "#lib/shared/dates.js";

/** The four MARC formats of the export menus. */
export const MARC_FORMATS = ["marc21", "marc21-xml", "unimarc", "unimarc-xml"] as const;
export type MarcFormat = (typeof MARC_FORMATS)[number];

export function marcFormatParts(format: MarcFormat): { flavour: MarcFlavour; syntax: MarcSyntax } {
	return {
		flavour: format.startsWith("unimarc") ? "unimarc" : "marc21",
		syntax: format.endsWith("-xml") ? "marcxml" : "iso2709",
	};
}

/** What a list hands to the MARC export: its titles, or its copies. */
export type MarcSelection = { biblioIds: number[] } | { itemIds: number[] };

/** SQLite takes many parameters, but a list of 10 000 ids is read in slices all the same. */
const SLICE = 900;
function slices<T>(ids: readonly T[]): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < ids.length; i += SLICE) {
		out.push(ids.slice(i, i + SLICE));
	}
	return out;
}

/** The titles of a selection with their copies (all of them, or only the copies selected). */
export function marcTitles(db: DbOrTx, selection: MarcSelection, timezone: string): MarcTitle[] {
	const onlyItems = "itemIds" in selection ? new Set(selection.itemIds) : null;
	let biblioIds: number[];
	if ("itemIds" in selection) {
		const found = new Set<number>();
		for (const part of slices(selection.itemIds)) {
			for (const r of db
				.select({ biblioId: item.biblioId })
				.from(item)
				.where(inArray(item.id, part))
				.all()) {
				found.add(r.biblioId);
			}
		}
		biblioIds = [...found];
	} else {
		biblioIds = selection.biblioIds;
	}
	const order = new Map(biblioIds.map((id, i) => [id, i]));
	const titles: MarcTitle[] = [];
	for (const part of slices(biblioIds)) {
		const copies = new Map<number, MarcCopy[]>();
		for (const c of db
			.select()
			.from(item)
			.where(inArray(item.biblioId, part))
			.orderBy(asc(item.barcode))
			.all()) {
			if (onlyItems && !onlyItems.has(c.id)) {
				continue;
			}
			const list = copies.get(c.biblioId) ?? [];
			list.push({
				barcode: c.barcode,
				callNumber: c.callNumber,
				readingLevel: c.readingLevel,
				enumeration: c.enumeration,
				status: c.status,
				notForLoan: c.notForLoan === 1,
				acquisitionDate: c.acquisitionDate,
				notes: c.notes,
				inventoryNumber: c.inventoryNumber,
				origin: c.origin,
				valueCents: c.valueCents,
			});
			copies.set(c.biblioId, list);
		}
		for (const b of db.select().from(biblio).where(inArray(biblio.id, part)).all()) {
			titles.push({
				id: b.id,
				title: b.title,
				subtitle: b.subtitle,
				originalTitle: b.originalTitle,
				responsibility: b.responsibility,
				author: b.author,
				publisher: b.publisher,
				publicationPlace: b.publicationPlace,
				publicationYear: b.publicationYear,
				isbn: b.isbn,
				issn: b.issn,
				ean: b.ean,
				physicalDescription: b.physicalDescription,
				series: b.series,
				seriesNumber: b.seriesNumber,
				dewey: b.dewey,
				itemType: b.itemType,
				kind: b.kind,
				genreCode: b.genreCode,
				classCode: b.classCode,
				readingLevel: b.readingLevel,
				subjects: b.subjects,
				accessibleFormats: b.accessibleFormats,
				notes: b.notes,
				createdOn: isoDateIn(new Date(b.createdAt), timezone),
				copies: copies.get(b.id) ?? [],
			});
		}
	}
	return titles.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** The file of a selection: its bytes, type and extension. */
export function marcFile(
	db: DbOrTx,
	selection: MarcSelection,
	format: MarcFormat,
	options: { unknownAuthor: string; locale: string; timezone: string },
): { body: Uint8Array; mime: string; extension: string } {
	const { flavour, syntax } = marcFormatParts(format);
	const records = marcTitles(db, selection, options.timezone).map((t) =>
		titleToMarc(t, flavour, options),
	);
	return syntax === "iso2709"
		? { body: toIso2709(records), mime: "application/marc", extension: "mrc" }
		: {
				body: new TextEncoder().encode(toMarcxml(records)),
				mime: "application/marcxml+xml; charset=utf-8",
				extension: "xml",
			};
}
