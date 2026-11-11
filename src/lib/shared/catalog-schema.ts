// SPDX-License-Identifier: GPL-3.0-or-later
// Biblio and item form inputs (PLAN.md step 3.1). Values arrive as strings from the forms; the
// catalog service turns them into typed data and applies the configuration rules (§3.17).
import * as v from "valibot";
import { levelCodeOrEmpty, textId } from "#lib/shared/input-schemas.js";

const optionalText = (
	max: number,
): v.OptionalSchema<
	v.SchemaWithPipe<
		readonly [
			v.StringSchema<undefined>,
			v.TrimAction,
			v.MaxLengthAction<string, number, undefined>,
		]
	>,
	""
> => v.optional(v.pipe(v.string(), v.trim(), v.maxLength(max)), "");

export const BIBLIO_KIND_VALUES = ["fiction", "nonfiction"] as const;
export type BiblioKind = (typeof BIBLIO_KIND_VALUES)[number];
/** The catalogue filter of the records still to classify (step 9.21). */
export const UNCLASSIFIED = "unclassified";

export const biblioFormSchema = v.object({
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
	subtitle: optionalText(300),
	/** The title of the original work, only for a translation (step 9.23). */
	originalTitle: optionalText(300),
	responsibility: optionalText(300),
	author: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	publisher: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	publicationPlace: optionalText(120),
	/** Empty or a year. */
	publicationYear: optionalText(4),
	isbn: optionalText(20),
	issn: optionalText(12),
	ean: optionalText(14),
	physicalDescription: optionalText(200),
	/** Series and number in the series (step 9.14). */
	series: optionalText(200),
	seriesNumber: optionalText(20),
	dewey: optionalText(20),
	/**
	 * A code of `library.itemTypes`, for every copy (9.45). Empty or left out: the first configured
	 * type for a new record, the record's own on an edit.
	 */
	itemType: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(32))),
	/** `""`: "Classifica dopo", the record waits in the list of books to classify (step 9.21). */
	kind: v.optional(v.union([v.picklist(BIBLIO_KIND_VALUES), v.literal("")]), ""),
	genreCode: optionalText(16),
	classCode: optionalText(16),
	/** Select value: `''` or `'1'`…`'5'` (only with `fictionByClass` and without `classPerItem`). */
	readingLevel: optionalText(8),
	/**
	 * The title's written part of the segnatura, `{{text}}` (Q143), only when the scheme has it;
	 * left out keeps the record's, the proposal (the author's initials) is stored as "follow it".
	 */
	callText: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(40))),
	/** One subject per line or comma-separated. */
	subjects: optionalText(1000),
	/**
	 * Accessible formats (9.66), names of `catalog.accessibleFormats` joined by `|`; left out keeps
	 * the record's.
	 */
	accessibleFormats: v.optional(v.pipe(v.string(), v.maxLength(1000))),
	notes: optionalText(2000),
});
export type BiblioFormInput = v.InferOutput<typeof biblioFormSchema>;

export const biblioEditSchema = v.object({
	id: textId,
	...biblioFormSchema.entries,
	/** When the record has exactly one copy its fields are edited on the same page (owner review). */
	itemId: optionalText(12),
	itemCallText: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(40))),
	itemReadingLevel: optionalText(2),
	itemEnumeration: optionalText(60),
	itemAcquisitionDate: optionalText(10),
	itemNotes: optionalText(500),
	itemNotForLoan: v.optional(v.boolean(), false),
	itemInventoryNumber: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(20))),
	itemOrigin: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60))),
	itemValue: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(16))),
});

export const ITEM_STATUS_VALUES = [
	"available",
	"lost",
	"damaged",
	"in_repair",
	"withdrawn",
] as const;
export type ItemStatus = (typeof ITEM_STATUS_VALUES)[number];

export const itemFormSchema = v.object({
	/** The copy's written part of the segnatura, `{{copytext}}` (Q143); left out keeps the copy's. */
	callText: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(40))),
	/** Per-copy class (only with `classPerItem`). */
	readingLevel: optionalText(8),
	enumeration: optionalText(60),
	/** `YYYY-MM-DD` or empty (defaults to today on creation). */
	acquisitionDate: optionalText(10),
	notes: optionalText(500),
	notForLoan: v.optional(v.boolean(), false),
	/**
	 * The school inventory (step 9.64), read only with `catalog.inventory.enabled`; left out keeps
	 * the copy's. A new copy left without a number gets the next one; an empty one stays without.
	 */
	inventoryNumber: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(20))),
	origin: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60))),
	/** In euro as typed (`12,50`). */
	value: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(16))),
});
export type ItemFormInput = v.InferOutput<typeof itemFormSchema>;

/** `relevance` ranks the full-text matches (bm25) and falls back to the title without a query. */
export const BIBLIO_SORTS = ["relevance", "title", "author", "year", "created", "series"] as const;

export const biblioFiltersSchema = v.object({
	q: v.optional(v.pipe(v.string(), v.maxLength(120)), ""),
	kind: v.optional(
		v.union([v.picklist([...BIBLIO_KIND_VALUES, UNCLASSIFIED]), v.literal("")]),
		"",
	),
	genreCode: v.optional(v.pipe(v.string(), v.maxLength(16)), ""),
	classCode: v.optional(v.pipe(v.string(), v.maxLength(16)), ""),
	readingLevel: v.optional(levelCodeOrEmpty, ""),
	itemType: v.optional(v.pipe(v.string(), v.maxLength(32)), ""),
	/** Exactly this series (the link on the record page), its books in order. */
	series: v.optional(v.pipe(v.string(), v.maxLength(200)), ""),
	/** `1` also lists the records whose copies are all withdrawn (hidden by default). */
	withdrawn: v.optional(v.picklist(["", "1"]), ""),
	/** `1`: only records with a copy on the shelf now (available, lendable, not on loan). */
	available: v.optional(v.picklist(["", "1"]), ""),
	/** An accessible format (9.66), `*` for any of them. */
	accessibleFormat: v.optional(v.pipe(v.string(), v.maxLength(40)), ""),
	yearFrom: v.optional(v.pipe(v.string(), v.regex(/^\d{0,4}$/)), ""),
	yearTo: v.optional(v.pipe(v.string(), v.regex(/^\d{0,4}$/)), ""),
	sort: v.optional(v.picklist(BIBLIO_SORTS), "relevance"),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2000)), 500),
	offset: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
});
export type BiblioFilters = v.InferOutput<typeof biblioFiltersSchema>;

/** "Nuovo libro" fast-add (step 3.6): the record, the copies and the provenance in one form. */
export const fastAddSchema = v.object({
	...biblioFormSchema.entries,
	/** Number of copies as typed (`'1'`…`'100'`). */
	copies: v.pipe(v.string(), v.regex(/^\d{1,3}$/)),
	itemCallText: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(40))),
	/** Per-copy class (only with `classPerItem`). */
	itemReadingLevel: optionalText(2),
	acquisitionDate: optionalText(10),
	/** The school inventory (9.64): the copies' origin and value (their numbers are the next ones). */
	itemOrigin: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60))),
	itemValue: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(16))),
	/** Metadata provider the record came from (`manual` when typed). */
	source: optionalText(32),
	sourceId: optionalText(64),
});
export type FastAddInput = v.InferOutput<typeof fastAddSchema>;
