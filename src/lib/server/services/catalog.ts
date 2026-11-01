// SPDX-License-Identifier: GPL-3.0-or-later
// Catalog (PLAN.md step 3.1): bibliographic records and their copies. Validation applies the
// classification rules of §3.17 (fiction needs a genre, non-fiction a class code, the associated
// class only where the flags allow it), ISBN normalisation and uniqueness; items get their
// barcodes from the per-year sequence and a suggested call number. Plain functions `(db, …)`.
// The copies are in `catalog-items.ts`, the reads in `catalog-search.ts`, the books to classify
// in `catalog-classify.ts`.
import { blankToNull } from "#lib/shared/text.js";
import { NotFoundError } from "#lib/server/errors.js";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item } from "#lib/server/db/schema.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { BiblioFormInput, BiblioKind } from "#lib/shared/catalog-schema.js";
import {
	classOf,
	genreOf,
	suggestCallNumber,
	type ClassificationScheme,
} from "#lib/shared/classification.js";
import { ean13Valid, toIsbn13 } from "#lib/shared/isbn.js";
import { demoBiblio } from "#lib/server/demo/content.js";
import { audit, type AuditActor } from "./audit.js";

export interface CatalogRules {
	scheme: ClassificationScheme;
	itemTypes: { code: string; label: string; notForLoan: boolean }[];
	specialAuthors: string[];
	unknownPublisher: string;
	unknownPlace: string;
	timezone: string;
	/** The installation's language: the order of titles in the results. */
	locale: string;
	/** The format table: barcodes of new copies (Phase 12). */
	codes: CodeTable;
}

export function catalogRules(config: AppConfig): CatalogRules {
	const c = config.classification;
	return {
		scheme: {
			fictionByClass: c.fictionByClass,
			classPerItem: c.classPerItem,
			genres: c.genres,
			nonfiction: c.nonfiction,
			callNumber: c.callNumber,
			readingLevels: c.readingLevels,
			deweyMap: c.deweyMap,
		},
		itemTypes: config.library.itemTypes.map((t) => ({
			code: t.code,
			label: t.label,
			notForLoan: t.notForLoan,
		})),
		specialAuthors: config.catalog.specialAuthors,
		unknownPublisher: config.catalog.unknownPublisher,
		unknownPlace: config.catalog.unknownPlace,
		timezone: config.library.timezone,
		locale: config.ui.locale,
		codes: codeTable(config),
	};
}

export type BiblioIssueCode =
	| "isbnInvalid"
	| "isbnTaken"
	| "issnInvalid"
	| "eanInvalid"
	| "yearImplausible"
	| "genreRequired"
	| "genreUnknown"
	| "genreNotForNonfiction"
	| "classCodeRequired"
	| "classCodeUnknown"
	| "classCodeNotForFiction"
	| "readingLevelNotAllowed"
	| "readingLevelOutOfRange";

export type ItemIssueCode =
	| "itemTypeUnknown"
	| "readingLevelNotAllowed"
	| "readingLevelOutOfRange"
	| "acquisitionDateInvalid"
	| "copiesOutOfRange";

export interface CatalogIssue {
	field: string;
	code: BiblioIssueCode | ItemIssueCode;
}

export class CatalogValidationError extends Error {
	constructor(readonly issues: CatalogIssue[]) {
		super(`invalid catalog input: ${issues.map((i) => `${i.field}:${i.code}`).join(", ")}`);
		this.name = "CatalogValidationError";
	}
}

export class BiblioNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("biblio", `biblio ${id} not found`);
		this.name = "BiblioNotFoundError";
	}
}

export class ItemNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("item", `item ${id} not found`);
		this.name = "ItemNotFoundError";
	}
}

export class BiblioHasItemsError extends Error {
	constructor(
		readonly id: number,
		readonly items: number,
	) {
		super(`biblio ${id} still has ${items} item(s)`);
		this.name = "BiblioHasItemsError";
	}
}

export class ItemOnLoanError extends Error {
	constructor(readonly id: number) {
		super(`item ${id} is on loan`);
		this.name = "ItemOnLoanError";
	}
}

export interface BiblioData {
	title: string;
	subtitle: string | null;
	originalTitle: string | null;
	responsibility: string | null;
	author: string;
	publisher: string;
	publicationPlace: string | null;
	publicationYear: number | null;
	isbn: string | null;
	issn: string | null;
	ean: string | null;
	physicalDescription: string | null;
	series: string | null;
	seriesNumber: string | null;
	dewey: string | null;
	/** Null while the record waits to be classified (step 9.21). */
	kind: BiblioKind | null;
	genreCode: string | null;
	classCode: string | null;
	readingLevel: string | null;
	subjects: string[];
	notes: string | null;
}

/** Applies §3.17 and the identifier rules; returns typed data or throws with every issue. */
export function validateBiblio(
	input: BiblioFormInput,
	rules: CatalogRules,
	now = new Date(),
): BiblioData {
	const issues: CatalogIssue[] = [];
	const { scheme } = rules;
	let isbn: string | null = null;
	if (blankToNull(input.isbn)) {
		isbn = toIsbn13(input.isbn);
		if (!isbn) {
			issues.push({ field: "isbn", code: "isbnInvalid" });
		}
	}
	const issn = blankToNull(input.issn)?.replace(/\s/g, "").toUpperCase() ?? null;
	if (issn && !/^\d{4}-?\d{3}[\dX]$/.test(issn)) {
		issues.push({ field: "issn", code: "issnInvalid" });
	}
	const ean = blankToNull(input.ean)?.replace(/[\s-]/g, "") ?? null;
	if (ean && !ean13Valid(ean)) {
		issues.push({ field: "ean", code: "eanInvalid" });
	}
	let publicationYear: number | null = null;
	if (blankToNull(input.publicationYear)) {
		publicationYear = Number(input.publicationYear);
		const max = now.getUTCFullYear() + 1;
		if (!Number.isInteger(publicationYear) || publicationYear < 1450 || publicationYear > max) {
			issues.push({ field: "publicationYear", code: "yearImplausible" });
		}
	}
	const genreCode = blankToNull(input.genreCode);
	const classCode = blankToNull(input.classCode);
	const readingLevel = blankToNull(input.readingLevel);
	if (input.kind === "") {
		// "Classifica dopo": no classification yet, whatever the pickers held
	} else if (input.kind === "fiction") {
		if (!genreCode) {
			issues.push({ field: "genreCode", code: "genreRequired" });
		} else if (!genreOf(scheme, genreCode)) {
			issues.push({ field: "genreCode", code: "genreUnknown" });
		}
		if (classCode) {
			issues.push({ field: "classCode", code: "classCodeNotForFiction" });
		}
		if (readingLevel !== null) {
			if (!scheme.fictionByClass || scheme.classPerItem) {
				issues.push({ field: "readingLevel", code: "readingLevelNotAllowed" });
			} else if (!scheme.readingLevels.some((l) => l.code === readingLevel)) {
				issues.push({ field: "readingLevel", code: "readingLevelOutOfRange" });
			}
		}
	} else {
		if (!classCode) {
			issues.push({ field: "classCode", code: "classCodeRequired" });
		} else if (!classOf(scheme, classCode)) {
			issues.push({ field: "classCode", code: "classCodeUnknown" });
		}
		if (genreCode) {
			issues.push({ field: "genreCode", code: "genreNotForNonfiction" });
		}
		if (readingLevel !== null) {
			issues.push({ field: "readingLevel", code: "readingLevelNotAllowed" });
		}
	}
	if (issues.length > 0) {
		throw new CatalogValidationError(issues);
	}
	return {
		title: input.title.trim(),
		subtitle: blankToNull(input.subtitle),
		originalTitle: blankToNull(input.originalTitle),
		responsibility: blankToNull(input.responsibility),
		author: input.author.trim(),
		publisher: input.publisher.trim(),
		publicationPlace: blankToNull(input.publicationPlace),
		publicationYear,
		isbn,
		issn,
		ean,
		physicalDescription: blankToNull(input.physicalDescription),
		series: blankToNull(input.series ?? ""),
		// a number without a series means nothing
		seriesNumber: blankToNull(input.series ?? "")
			? blankToNull(input.seriesNumber ?? "")
			: null,
		dewey: blankToNull(input.dewey),
		kind: input.kind === "" ? null : input.kind,
		genreCode: input.kind === "fiction" ? genreCode : null,
		classCode: input.kind === "nonfiction" ? classCode : null,
		readingLevel: input.kind === "fiction" ? readingLevel : null,
		subjects: input.subjects
			.split(/[\n,;]+/)
			.map((s) => s.trim())
			.filter(Boolean),
		notes: blankToNull(input.notes),
	};
}

function assertIsbnFree(db: DbOrTx, isbn: string | null, exceptId?: number): void {
	if (!isbn) {
		return;
	}
	const clash = db
		.select({ id: biblio.id })
		.from(biblio)
		.where(
			and(
				eq(biblio.isbn, isbn),
				exceptId === undefined ? undefined : ne(biblio.id, exceptId),
			),
		)
		.get();
	if (clash) {
		throw new CatalogValidationError([{ field: "isbn", code: "isbnTaken" }]);
	}
}

/** The record with the given ISBN-13, for the duplicate check of the fast-add flow (3.6). */
export function findBiblioByIsbn(db: DbOrTx, isbn: string): { id: number; title: string } | null {
	return (
		db
			.select({ id: biblio.id, title: biblio.title })
			.from(biblio)
			.where(eq(biblio.isbn, isbn))
			.get() ?? null
	);
}

/** The special values the public demo writes for a record's author and publisher (Q121). */
function demoSpecial(rules: CatalogRules): { author: string; publisher: string } {
	return {
		author:
			rules.specialAuthors.find((a) => /^AA\.?\s*VV\.?$/i.test(a)) ??
			rules.specialAuthors[0] ??
			"AA. VV.",
		publisher: rules.unknownPublisher,
	};
}

export function createBiblio(
	db: DbOrTx,
	input: BiblioFormInput,
	actor: AuditActor,
	rules: CatalogRules,
	options: { source?: string; sourceId?: string | null; now?: Date } = {},
): number {
	// the public demo stores its example record; an import there is the demo's example file
	const sent =
		options.source === "import"
			? input
			: demoBiblio(input, demoSpecial(rules), undefined, options.now);
	const data = validateBiblio(sent, rules, options.now);
	const now = options.now ?? new Date();
	return db.transaction((tx) => {
		assertIsbnFree(tx, data.isbn);
		const row = tx
			.insert(biblio)
			.values({
				...data,
				source: options.source ?? "manual",
				sourceId: options.sourceId ?? null,
				createdBy: actor.id,
				updatedBy: actor.id,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
			})
			.returning({ id: biblio.id })
			.get();
		audit(
			tx,
			actor,
			"biblio.create",
			"biblio",
			row.id,
			{ kind: data.kind, source: options.source ?? "manual" },
			now,
		);
		return row.id;
	});
}

const TRACKED: (keyof BiblioData)[] = [
	"title",
	"subtitle",
	"originalTitle",
	"responsibility",
	"author",
	"publisher",
	"publicationPlace",
	"publicationYear",
	"isbn",
	"issn",
	"ean",
	"physicalDescription",
	"series",
	"seriesNumber",
	"dewey",
	"kind",
	"genreCode",
	"classCode",
	"readingLevel",
	"subjects",
	"notes",
];

export function updateBiblio(
	db: DbOrTx,
	id: number,
	input: BiblioFormInput,
	actor: AuditActor,
	rules: CatalogRules,
	now = new Date(),
): string[] {
	return db.transaction((tx) => {
		const existing = tx.select().from(biblio).where(eq(biblio.id, id)).get();
		if (!existing) {
			throw new BiblioNotFoundError(id);
		}
		const data = validateBiblio(
			demoBiblio(input, demoSpecial(rules), existing, now),
			rules,
			now,
		);
		assertIsbnFree(tx, data.isbn, id);
		const changed = TRACKED.filter(
			(k) => JSON.stringify(existing[k] ?? null) !== JSON.stringify(data[k] ?? null),
		);
		if (changed.length === 0) {
			return [];
		}
		tx.update(biblio)
			.set({ ...data, updatedBy: actor.id, updatedAt: now.toISOString() })
			.where(eq(biblio.id, id))
			.run();
		if (existing.kind === null && data.kind !== null) {
			fillCallNumbers(tx, id, data, rules, now);
		}
		audit(tx, actor, "biblio.update", "biblio", id, { changed }, now);
		return changed;
	});
}

/**
 * A record just classified (step 9.21): its copies without a call number get the suggested one,
 * which waited for the classification.
 */
function fillCallNumbers(
	tx: DbOrTx,
	biblioId: number,
	record: BiblioData,
	rules: CatalogRules,
	now: Date,
): void {
	for (const copy of tx
		.select({ id: item.id, readingLevel: item.readingLevel })
		.from(item)
		.where(and(eq(item.biblioId, biblioId), isNull(item.callNumber)))
		.all()) {
		const callNumber = suggestedCallNumber(rules, record, copy.readingLevel) || null;
		tx.update(item)
			.set({ callNumber, updatedAt: now.toISOString() })
			.where(eq(item.id, copy.id))
			.run();
	}
}

/** Refused while copies exist: withdraw or delete them first. */
export function deleteBiblio(db: Db, id: number, actor: AuditActor, now = new Date()): void {
	db.transaction((tx) => {
		const existing = tx.select({ id: biblio.id }).from(biblio).where(eq(biblio.id, id)).get();
		if (!existing) {
			throw new BiblioNotFoundError(id);
		}
		const copies = tx
			.select({ id: item.id })
			.from(item)
			.where(eq(item.biblioId, id))
			.all().length;
		if (copies > 0) {
			throw new BiblioHasItemsError(id, copies);
		}
		tx.delete(biblio).where(eq(biblio.id, id)).run();
		audit(tx, actor, "biblio.delete", "biblio", id, undefined, now);
	});
}

/** The call number the forms propose for a copy of the record (§3.17). */
export function suggestedCallNumber(
	rules: CatalogRules,
	record: {
		kind: string | null;
		genreCode: string | null;
		classCode: string | null;
		readingLevel: string | null;
		author: string;
		title: string;
	},
	itemReadingLevel: string | null = null,
): string {
	// the call number waits for the classification (step 9.21)
	if (record.kind === null) {
		return "";
	}
	return suggestCallNumber(rules.scheme, {
		kind: record.kind as BiblioKind,
		genreCode: record.genreCode,
		classCode: record.classCode,
		readingLevel: rules.scheme.classPerItem ? itemReadingLevel : record.readingLevel,
		author: record.author,
		title: record.title,
	});
}

/** A genre or nonfiction class as the pickers show it (image and colour resolved, never undefined). */
export interface ClassificationOption {
	code: string;
	label: string;
	image: string | null;
	color: string | null;
}

/** The DTO of `classificationOptions`: what the pickers and filters need. */
export interface ClassificationOptions {
	fictionByClass: boolean;
	classPerItem: boolean;
	readingLevels: ClassificationScheme["readingLevels"];
	genres: ClassificationOption[];
	nonfiction: (ClassificationOption & { children: ClassificationOption[] })[];
	itemTypes: CatalogRules["itemTypes"];
	callNumber: ClassificationScheme["callNumber"];
	deweyMap: NonNullable<ClassificationScheme["deweyMap"]>;
	specialAuthors: string[];
	unknownPublisher: string;
	unknownPlace: string;
}

/** What the pickers and filters need: genres, taxonomy, flags, item types, quick picks. */
export function classificationOptions(rules: CatalogRules): ClassificationOptions {
	return {
		fictionByClass: rules.scheme.fictionByClass,
		classPerItem: rules.scheme.classPerItem,
		readingLevels: rules.scheme.readingLevels,
		genres: rules.scheme.genres.map((g) => ({
			code: g.code,
			label: g.label,
			image: g.image ?? null,
			color: g.color ?? null,
		})),
		nonfiction: rules.scheme.nonfiction.map((n) => ({
			code: n.code,
			label: n.label,
			image: n.image ?? null,
			color: n.color ?? null,
			children: (n.children ?? []).map((c) => ({
				code: c.code,
				label: c.label,
				image: c.image ?? n.image ?? null,
				color: c.color ?? n.color ?? null,
			})),
		})),
		itemTypes: rules.itemTypes,
		callNumber: rules.scheme.callNumber,
		deweyMap: rules.scheme.deweyMap ?? [],
		specialAuthors: rules.specialAuthors,
		unknownPublisher: rules.unknownPublisher,
		unknownPlace: rules.unknownPlace,
	};
}
