// SPDX-License-Identifier: GPL-3.0-or-later
// Catalogue import and migration from Koha (PLAN.md steps 3.9, 9.19; Q31, Q115): one CSV row per
// copy, the record fields repeated on each row and grouped by `biblio_key` (Koha's biblionumber) or
// by ISBN; the English columns of `#lib/shared/import-columns.ts` (the Koha queries in
// `docs/import/` output them); the validate phase (pure over a snapshot of the catalogue) with the
// class-per-copy question of §3.17, the special values for a missing author or publisher, and the
// titles without classification left to classify (9.21); the commit phase in one transaction with
// an `import_batch` row (§3.22).
import { parseSeries } from "#lib/shared/series.js";
import { eq, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item } from "#lib/server/db/schema.js";
import { ensureAtLeast } from "#lib/server/db/sequence.js";
import { sequenceName } from "#lib/server/barcodes/counters.js";
import { isCardNumber } from "#lib/server/barcodes/guard.js";
import { nextItemBarcode } from "#lib/server/barcodes/items.js";
import { BARCODE_TEXT } from "#lib/server/barcodes/render.js";
import {
	CatalogValidationError,
	createBiblio,
	validateBiblio,
	type BiblioData,
	type CatalogRules,
} from "#lib/server/services/catalog.js";
import { validateItem, type ItemData } from "#lib/server/services/catalog-items.js";
import type { AuditActor } from "#lib/server/services/audit.js";
import { moveClassesToItems } from "#lib/server/services/taxonomy.js";
import { counterOf, isValidCode, yearOf } from "#lib/shared/barcodes/pattern.js";
import {
	biblioFormSchema,
	itemFormSchema,
	type BiblioFormInput,
	type BiblioKind,
	type ItemStatus,
} from "#lib/shared/catalog-schema.js";
import { maxLengths } from "#lib/shared/text-limits.js";
import {
	classOf,
	computeCallNumber,
	genreOf,
	isFreeScheme,
	readCallNumber,
	schemeUses,
	type CallNumberParts,
} from "#lib/shared/classification.js";
import { refreshCallNumbers } from "#lib/server/services/call-numbers.js";
import { toIsbn13 } from "#lib/shared/isbn.js";
import { normalizeScan, recognise } from "#lib/shared/scan.js";
import { CATALOG_IMPORT, type CatalogField } from "#lib/shared/import-columns.js";
import { normalizeSearchText } from "#lib/shared/text.js";
import { normalizeDate } from "./dates.js";
import {
	canCommit,
	countRows,
	detectFormat,
	ImportNotReadyError,
	type DetectedFormat,
	type ImportCounts,
	type ImportRow,
	type MappedRow,
	type RowReason,
	tooLongReasons,
	withImportBatch,
} from "./pipeline.js";

export type CatalogImportColumn = CatalogField;

/** A word list keyed by the normalised form of each word. */
function wordMap<T>(words: Record<string, T>): Map<string, T> {
	return new Map(Object.entries(words).map(([w, v]) => [normalizeSearchText(w), v]));
}

export type CatalogFormatDetection = DetectedFormat<CatalogImportColumn>;

/**
 * A header row has the English names of the import (title, author and publisher are the columns
 * every file needs); otherwise every column is ignored until mapped.
 */
export function detectCatalogFormat(rows: readonly string[][]): CatalogFormatDetection {
	return detectFormat(CATALOG_IMPORT, rows);
}

export type CatalogImportInput = MappedRow<CatalogImportColumn>;

/** The caps of the record and copy forms, applied to the cells of a file too. */
const record = biblioFormSchema.entries;
const CATALOG_LIMITS = maxLengths<CatalogImportColumn>({
	title: record.title,
	author: record.author,
	publisher: record.publisher,
	issn: record.issn,
	ean: record.ean,
	subtitle: record.subtitle,
	originalTitle: record.originalTitle,
	responsibility: record.responsibility,
	publicationPlace: record.publicationPlace,
	physicalDescription: record.physicalDescription,
	series: record.series,
	seriesNumber: record.seriesNumber,
	dewey: record.dewey,
	subjects: record.subjects,
	notes: record.notes,
	callNumber: itemFormSchema.entries.enumeration,
	itemType: record.itemType,
	enumeration: itemFormSchema.entries.enumeration,
	itemNotes: itemFormSchema.entries.notes,
});

const STATUS_WORDS = wordMap<ItemStatus>({
	available: "available",
	disponibile: "available",
	lost: "lost",
	perso: "lost",
	smarrito: "lost",
	damaged: "damaged",
	danneggiato: "damaged",
	in_repair: "in_repair",
	"in riparazione": "in_repair",
	riparazione: "in_repair",
	withdrawn: "withdrawn",
	ritirato: "withdrawn",
	scartato: "withdrawn",
});

const TRUE_WORDS = new Set(["1", "si", "yes", "true", "x", "vero"]);
/**
 * Koha's reference type (`REF`, exported as `consultazione`) is not a material: such a copy is a
 * copy of its title excluded from loans, and the title keeps its own material (Q139).
 */
const REFERENCE_WORDS = new Set(["consultazione", "reference", "ref"]);
const FALSE_WORDS = new Set(["", "0", "no", "false", "falso"]);

export interface CatalogImportOptions {
	rules: CatalogRules;
	/** Fill a missing author with the first `catalog.specialAuthors` value and a missing publisher with `catalog.unknownPublisher`. */
	useSpecialValues: boolean;
	/**
	 * Answer to the class-per-copy question (§3.17): `true` enables `classification.classPerItem`
	 * at commit, `false` turns the rows of those titles into errors, `undefined` = not answered yet.
	 */
	enableClassPerItem?: boolean;
	/**
	 * Answer to the item-type question (Q139): the type is the record's, so copies of one new
	 * title with different types ask whether the record takes the type of most of them; `true`
	 * does so, `false` turns the rows of those titles into errors, `undefined` = not answered yet.
	 */
	useMajorityType?: boolean;
	/**
	 * Answer to the segnatura question (Q143): the segnatura is computed from the scheme, so copies
	 * whose segnatura in the file differs from the computed one ask whether to use the computed one;
	 * `true` does so, `false` turns those rows into errors, `undefined` = not answered yet.
	 */
	useComputedCallNumbers?: boolean;
	/** Today in the library's time zone (acquisition date default). */
	today: string;
}

export interface CatalogImportRow extends ImportRow<CatalogImportInput> {
	/** The title key the row belongs to. */
	group: string;
	/** The existing record the copy is added to, or null for a new record. */
	biblioId: number | null;
	/** The barcode the copy gets (empty = generated at commit). */
	barcode: string;
}

export interface CatalogImportResult {
	rows: CatalogImportRow[];
	counts: ImportCounts;
	/** New records, and titles merged into an existing record (by ISBN). */
	titles: { new: number; existing: number };
	/** New titles without classification: they go to the list of books to classify (9.21). */
	toClassify: number;
	/** New copies without a barcode in the file: the barcode is generated, labels to print. */
	generatedBarcodes: number;
	/** The class-per-copy question: how many titles have copies in different classes (0 = no question). */
	classPerItemQuestion: number;
	/** The item-type question: how many new titles have copies of different types (0 = no question). */
	typeQuestion: number;
	/** The segnatura question: how many copies have a segnatura other than the computed one. */
	callNumberQuestion: number;
	canCommit: boolean;
}

interface Known {
	id: number;
	kind: BiblioKind | null;
	itemType: string;
}

interface Snapshot {
	byIsbn: Map<string, Known>;
	/** Records created by an earlier import, by their `biblio_key` (Koha's biblionumber). */
	byKey: Map<string, Known>;
	/** barcode → record id */
	barcodes: Map<string, number>;
}

function loadSnapshot(db: DbOrTx): Snapshot {
	const byIsbn = new Map<string, Known>();
	for (const b of db
		.select({ id: biblio.id, isbn: biblio.isbn, kind: biblio.kind, itemType: biblio.itemType })
		.from(biblio)
		.where(sql`${biblio.isbn} IS NOT NULL`)
		.all()) {
		byIsbn.set(b.isbn ?? "", { ...b, kind: b.kind as BiblioKind | null });
	}
	const byKey = new Map<string, Known>();
	for (const b of db
		.select({
			id: biblio.id,
			sourceId: biblio.sourceId,
			kind: biblio.kind,
			itemType: biblio.itemType,
		})
		.from(biblio)
		.where(sql`${biblio.source} = 'import' AND ${biblio.sourceId} IS NOT NULL`)
		.all()) {
		byKey.set(b.sourceId ?? "", { ...b, kind: b.kind as BiblioKind | null });
	}
	const barcodes = new Map<string, number>();
	for (const i of db
		.select({ barcode: item.barcode, biblioId: item.biblioId })
		.from(item)
		.all()) {
		barcodes.set(i.barcode, i.biblioId);
	}
	return { byIsbn, byKey, barcodes };
}

/**
 * Kind and code of a row from `classification` (Koha's ccode): a genre code is fiction, a class
 * code non-fiction (the configuration never has a code that is both); empty → to classify (9.21).
 */
function classificationOfRow(
	input: CatalogImportInput,
	rules: CatalogRules,
): { kind: BiblioKind | null; genreCode: string; classCode: string; reason?: RowReason } {
	const scheme = rules.scheme;
	const code = input.classification.trim();
	if (code === "") {
		return { kind: null, genreCode: "", classCode: "" };
	}
	const genre = genreOf(scheme, code) ?? genreOf(scheme, code.toUpperCase());
	if (genre) {
		return { kind: "fiction", genreCode: genre.code, classCode: "" };
	}
	const klass = classOf(scheme, code) ?? classOf(scheme, code.toUpperCase());
	if (klass) {
		return { kind: "nonfiction", genreCode: "", classCode: klass.code };
	}
	return {
		kind: null,
		genreCode: "",
		classCode: "",
		reason: { code: "classificationUnknown", params: { value: code } },
	};
}

/**
 * The reading level of a row: a code or a name of the configured scale (any case; Koha's
 * `items.location` holds `1`…`5`); Koha's `S` (saggistica) and empty mean none. Anything else is
 * kept and refused by the validation.
 */
function readingLevelOf(raw: string, rules: CatalogRules): string {
	const s = raw.trim();
	if (s.toUpperCase() === "S") {
		return "";
	}
	const found = rules.scheme.readingLevels.find(
		(l) =>
			l.code.toLowerCase() === s.toLowerCase() || l.label.toLowerCase() === s.toLowerCase(),
	);
	return found?.code ?? s;
}

const groupKeyOf = (input: CatalogImportInput, isbn: string | null): string =>
	input.biblioKey !== ""
		? `key:${input.biblioKey}`
		: isbn
			? `isbn:${isbn}`
			: `line:${input.line}`;

interface Prepared {
	input: CatalogImportInput;
	reasons: RowReason[];
	group: string;
	isbn: string | null;
	kind: BiblioKind | null;
	genreCode: string;
	classCode: string;
	readingLevel: string;
	barcode: string;
	status: ItemStatus;
	notForLoan: boolean;
	/** The material of the cell, `""` when empty or a reference word (then `notForLoan`). */
	itemType: string;
	acquisitionDate: string;
}

function prepareRow(input: CatalogImportInput, options: CatalogImportOptions): Prepared {
	const reasons: RowReason[] = tooLongReasons(input, CATALOG_LIMITS, CATALOG_IMPORT);
	const isbn = input.isbn === "" ? null : toIsbn13(input.isbn);
	if (input.isbn !== "" && !isbn) {
		reasons.push({ code: "isbnInvalid", params: { value: input.isbn } });
	}
	const cls = classificationOfRow(input, options.rules);
	if (cls.reason) {
		reasons.push(cls.reason);
	}
	const codes = options.rules.codes;
	const barcode = input.barcode === "" ? "" : normalizeScan(input.barcode, codes);
	if (barcode !== "") {
		const kind = recognise(barcode, codes);
		if (!BARCODE_TEXT.test(barcode)) {
			reasons.push({ code: "barcodeInvalid", params: { value: input.barcode } });
		} else if (kind.reason === "item_check_digit") {
			reasons.push({ code: "barcodeCheckDigit", params: { value: barcode } });
		} else if (kind.kind === "card" || kind.reason === "card_check_digit") {
			// a copy barcode never reads as a card number (the rule of Q90)
			reasons.push({ code: "barcodeIsCard", params: { value: barcode } });
		}
	}
	const statusWord = normalizeSearchText(input.status);
	const status = statusWord === "" ? "available" : STATUS_WORDS.get(statusWord);
	if (!status) {
		reasons.push({ code: "statusUnknown", params: { value: input.status } });
	}
	const nfl = normalizeSearchText(input.notForLoan);
	if (!TRUE_WORDS.has(nfl) && !FALSE_WORDS.has(nfl)) {
		reasons.push({ code: "notForLoanUnknown", params: { value: input.notForLoan } });
	}
	const reference = REFERENCE_WORDS.has(normalizeSearchText(input.itemType));
	let acquisitionDate = options.today;
	if (input.acquisitionDate !== "") {
		const d = normalizeDate(input.acquisitionDate);
		if (d) {
			acquisitionDate = d;
		} else {
			reasons.push({ code: "dateInvalid", params: { value: input.acquisitionDate } });
		}
	}
	return {
		input,
		reasons,
		group: groupKeyOf(input, isbn),
		isbn,
		kind: cls.kind,
		genreCode: cls.genreCode,
		classCode: cls.classCode,
		readingLevel: readingLevelOf(input.readingLevel, options.rules),
		barcode,
		status: status ?? "available",
		notForLoan: TRUE_WORDS.has(nfl) || reference,
		itemType: reference ? "" : input.itemType,
		acquisitionDate,
	};
}

/** The parts of the segnatura a record gives a copy of the given level. */
function partsOf(
	record: Pick<BiblioData, "kind" | "genreCode" | "classCode" | "author" | "title" | "callText">,
	readingLevel: string | null,
): CallNumberParts {
	return {
		kind: record.kind,
		genreCode: record.genreCode,
		classCode: record.classCode,
		readingLevel,
		author: record.author,
		title: record.title,
		text: record.callText,
	};
}

/** An existing record as the segnatura needs it. */
function recordOf(db: DbOrTx, id: number): BiblioData | null {
	const r = db.select().from(biblio).where(eq(biblio.id, id)).get();
	return r ? { ...r, kind: r.kind as BiblioKind | null } : null;
}

/** The value most copies show (the first met on a tie); undefined when none shows one. */
function mostFrequent(values: readonly (string | undefined)[]): string | undefined {
	const counts = new Map<string, number>();
	for (const v of values) {
		if (v !== undefined) {
			counts.set(v, (counts.get(v) ?? 0) + 1);
		}
	}
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** The record form input of a title, from its first row (author and publisher filled when asked). */
function biblioInputOf(
	p: Prepared,
	options: CatalogImportOptions,
	readingLevel: string,
	itemType: string,
): { input: BiblioFormInput | null; reasons: RowReason[] } {
	const reasons: RowReason[] = [];
	const i = p.input;
	let author = i.author;
	let publisher = i.publisher;
	if (author === "") {
		if (options.useSpecialValues) {
			author = options.rules.specialAuthors[0] ?? "Anonimo";
		} else {
			reasons.push({ code: "authorMissing" });
		}
	}
	if (publisher === "") {
		if (options.useSpecialValues) {
			publisher = options.rules.unknownPublisher;
		} else {
			reasons.push({ code: "publisherMissing" });
		}
	}
	if (i.title === "") {
		reasons.push({ code: "titleMissing" });
	}
	if (reasons.length > 0) {
		return { input: null, reasons };
	}
	const year = /^\d{4}/.exec(i.publicationYear)?.[0] ?? i.publicationYear;
	// "Harry Potter ; 3" in the series column and no number column: split it (step 9.14)
	const series = i.seriesNumber ? null : parseSeries(i.series);
	return {
		input: {
			title: i.title,
			subtitle: i.subtitle,
			originalTitle: i.originalTitle,
			responsibility: i.responsibility,
			author,
			publisher,
			publicationPlace: i.publicationPlace,
			publicationYear: year,
			isbn: p.isbn ?? "",
			issn: i.issn,
			ean: i.ean,
			physicalDescription: i.physicalDescription,
			series: series?.series ?? i.series,
			seriesNumber: series?.number ?? i.seriesNumber,
			dewey: i.dewey,
			itemType,
			// no classification in the file: the title waits in the list "Da classificare" (9.21)
			kind: p.kind ?? "",
			genreCode: p.kind === "fiction" ? p.genreCode : "",
			classCode: p.kind === "nonfiction" ? p.classCode : "",
			readingLevel: p.kind === "fiction" ? readingLevel : "",
			subjects: i.subjects,
			notes: i.notes,
		},
		reasons,
	};
}

/**
 * The item types of the copies of one title, the most frequent first (the Q139 question); copies
 * without a type (or of the reference type) count only when no copy has one.
 */
function typesOf(members: readonly Prepared[], fallback: string): string[] {
	const counts = new Map<string, number>();
	for (const m of members) {
		if (m.itemType !== "") {
			counts.set(m.itemType, (counts.get(m.itemType) ?? 0) + 1);
		}
	}
	if (counts.size === 0) {
		return [fallback];
	}
	// a stable sort: on a tie the type met first in the file wins
	return [...counts].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

/** Copies of one title spread over different classes (the §3.17 question). */
function classesOf(members: readonly Prepared[]): string[] {
	return [...new Set(members.filter((m) => m.kind === "fiction").map((m) => m.readingLevel))];
}

export interface PreparedTitle {
	group: string;
	biblioId: number | null;
	kind: BiblioKind | null;
	biblio: BiblioFormInput | null;
	data: BiblioData | null;
	copies: {
		row: CatalogImportRow;
		item: ItemData;
		status: ItemStatus;
		barcode: string;
		/** The file's segnatura is not the computed one: the old labels are to print again. */
		relabel: boolean;
	}[];
}

interface Validation extends CatalogImportResult {
	prepared: PreparedTitle[];
}

function validate(
	db: DbOrTx,
	inputs: readonly CatalogImportInput[],
	options: CatalogImportOptions,
): Validation {
	const snapshot = loadSnapshot(db);
	const prepared = inputs.map((input) => prepareRow(input, options));
	const groups = new Map<string, Prepared[]>();
	for (const p of prepared) {
		const list = groups.get(p.group) ?? [];
		list.push(p);
		groups.set(p.group, list);
	}
	// the class-per-copy question: fiction titles whose copies sit in different classes
	const scheme = options.rules.scheme;
	let questionTitles = 0;
	for (const members of groups.values()) {
		if (classesOf(members).length > 1) {
			questionTitles++;
		}
	}
	const classPerItem =
		scheme.classPerItem || (options.enableClassPerItem === true && questionTitles > 0);
	const rules: CatalogRules = { ...options.rules, scheme: { ...scheme, classPerItem } };
	const defaultType = rules.itemTypes[0]?.code ?? "libro";
	let typeTitles = 0;
	let callNumberCopies = 0;

	const seenBarcodes = new Map<string, number>();
	const rows: CatalogImportRow[] = [];
	const titles: PreparedTitle[] = [];
	let newTitles = 0;
	let existingTitles = 0;
	let toClassify = 0;
	let generatedBarcodes = 0;
	for (const [group, members] of groups) {
		const first = members[0];
		if (!first) {
			continue;
		}
		// the same title imported before (same key), or already catalogued with the same ISBN
		const existing =
			(first.input.biblioKey !== ""
				? snapshot.byKey.get(first.input.biblioKey)
				: undefined) ?? (first.isbn ? snapshot.byIsbn.get(first.isbn) : undefined);
		const groupReasons: RowReason[] = [];
		// the type is the record's (Q139): an existing record keeps its own
		const types = typesOf(members, defaultType);
		if (!existing && types.length > 1) {
			typeTitles++;
			if (options.useMajorityType !== true) {
				groupReasons.push({
					code: options.useMajorityType === false ? "typeDiffers" : "typeQuestion",
					params: { types: types.join(", ") },
				});
			}
		}
		const recordType = existing?.itemType ?? types[0] ?? defaultType;
		const classes = classesOf(members);
		if (classes.length > 1 && !classPerItem) {
			groupReasons.push({
				code: options.enableClassPerItem === false ? "classDiffers" : "classQuestion",
				params: { classes: classes.filter(Boolean).join(", ") },
			});
		}
		// a title key shared by rows that describe different books is a mistake in the file
		const firstTitle = normalizeSearchText(first.input.title);
		for (const m of members.slice(1)) {
			if (m.input.title !== "" && normalizeSearchText(m.input.title) !== firstTitle) {
				m.reasons.push({ code: "groupConflict", params: { line: first.input.line } });
			}
		}
		let biblioInput: BiblioFormInput | null = null;
		let data: BiblioData | null = null;
		let kind: BiblioKind | null = existing?.kind ?? first.kind;
		if (!existing) {
			const titleClass = classPerItem ? "" : (classes.find(Boolean) ?? "");
			const built = biblioInputOf(first, options, titleClass, recordType);
			groupReasons.push(...built.reasons);
			biblioInput = built.input;
			if (biblioInput) {
				try {
					data = validateBiblio(biblioInput, rules);
				} catch (e) {
					if (!(e instanceof CatalogValidationError)) {
						throw e;
					}
					for (const issue of e.issues) {
						groupReasons.push({ code: `catalog.${issue.code}` });
					}
				}
			}
			kind = data?.kind ?? kind;
		}
		// the segnatura is computed (Q143): the title's text is read from the file's segnature
		const known = existing ? recordOf(db, existing.id) : null;
		const levelOf = (m: Prepared): string | null =>
			classPerItem
				? kind === "fiction" && m.readingLevel !== ""
					? m.readingLevel
					: null
				: ((known ?? data)?.readingLevel ?? null);
		const newData = data;
		if (!existing && newData && biblioInput && schemeUses(scheme, "text")) {
			const text = mostFrequent(
				members.map(
					(m) =>
						readCallNumber(scheme, partsOf(newData, levelOf(m)), m.input.callNumber)
							.text,
				),
			);
			if (text !== undefined) {
				biblioInput = { ...biblioInput, callText: text };
				data = { ...newData, callText: validateBiblio(biblioInput, rules).callText };
			}
		}
		const record = known ?? data;
		const title: PreparedTitle = {
			group,
			biblioId: existing?.id ?? null,
			kind,
			biblio: biblioInput,
			data,
			copies: [],
		};
		let groupOk = groupReasons.length === 0;
		for (const m of members) {
			const reasons = [...m.reasons, ...groupReasons];
			const row: CatalogImportRow = {
				line: m.input.line,
				status: "new",
				data: m.input,
				reasons,
				group,
				biblioId: existing?.id ?? null,
				barcode: m.barcode,
			};
			rows.push(row);
			if (m.barcode !== "") {
				const firstLine = seenBarcodes.get(m.barcode);
				if (firstLine !== undefined) {
					reasons.push({ code: "barcodeDuplicateInFile", params: { line: firstLine } });
				} else {
					seenBarcodes.set(m.barcode, m.input.line);
				}
				const owner = snapshot.barcodes.get(m.barcode);
				if (owner !== undefined) {
					if (owner === existing?.id && reasons.length === 0) {
						// the same copy imported again: nothing to do
						row.status = "unchanged";
						reasons.push({ code: "copyExists" });
						continue;
					}
					reasons.push({ code: "barcodeTaken", params: { value: m.barcode } });
				} else if (isCardNumber(db, m.barcode)) {
					reasons.push({ code: "barcodeIsCard", params: { value: m.barcode } });
				}
			}
			// the copy's text, where the scheme has one; then the file's segnatura is compared
			const parts = record ? partsOf(record, levelOf(m)) : null;
			const copyText = !schemeUses(scheme, "copytext")
				? undefined
				: isFreeScheme(scheme.callNumber) || !parts
					? m.input.callNumber
					: readCallNumber(scheme, parts, m.input.callNumber).copyText;
			const written = m.input.callNumber.replace(/\s+/g, " ").trim();
			const computed = parts
				? (computeCallNumber(scheme, { ...parts, copyText: copyText ?? null })?.full ?? "")
				: written;
			const relabel = written !== "" && written.toUpperCase() !== computed.toUpperCase();
			if (relabel) {
				callNumberCopies++;
				if (options.useComputedCallNumbers !== true) {
					reasons.push({
						code:
							options.useComputedCallNumbers === false
								? "callNumberDiffers"
								: "callNumberQuestion",
						params: { value: written, computed: computed || "—" },
					});
				}
			}
			let itemData: ItemData | null = null;
			try {
				itemData = validateItem(
					{
						callText: copyText,
						readingLevel: classPerItem && kind === "fiction" ? m.readingLevel : "",
						enumeration: m.input.enumeration,
						acquisitionDate: m.acquisitionDate,
						notes: m.input.itemNotes,
						notForLoan: m.notForLoan,
					},
					rules,
					kind,
					recordType,
				);
			} catch (e) {
				if (!(e instanceof CatalogValidationError)) {
					throw e;
				}
				for (const issue of e.issues) {
					reasons.push({ code: `catalog.${issue.code}` });
				}
			}
			if (reasons.length > 0 || !itemData) {
				row.status = "error";
				groupOk = false;
				continue;
			}
			if (existing) {
				reasons.push({ code: "mergedIntoExisting" });
			}
			title.copies.push({
				row,
				item: itemData,
				status: m.status,
				barcode: m.barcode,
				relabel,
			});
			if (m.barcode === "") {
				generatedBarcodes++;
			}
		}
		if (title.copies.length > 0 || groupOk) {
			if (existing) {
				existingTitles++;
			} else {
				newTitles++;
				if (kind === null) {
					toClassify++;
				}
			}
		}
		titles.push(title);
	}
	rows.sort((a, b) => a.line - b.line);
	const counts = countRows(rows);
	return {
		rows,
		counts,
		titles: { new: newTitles, existing: existingTitles },
		toClassify,
		generatedBarcodes,
		classPerItemQuestion: scheme.classPerItem ? 0 : questionTitles,
		typeQuestion: typeTitles,
		callNumberQuestion: callNumberCopies,
		canCommit: canCommit(counts) && counts.new > 0,
		prepared: titles,
	};
}

/** The validate phase: every row gets a status and reasons; nothing is written. */
export function validateCatalogImport(
	db: DbOrTx,
	inputs: readonly CatalogImportInput[],
	options: CatalogImportOptions,
): CatalogImportResult {
	const { prepared: _prepared, ...result } = validate(db, inputs, options);
	return result;
}

export interface CatalogImportSummary {
	batchId: number;
	titlesCreated: number;
	titlesMerged: number;
	copiesCreated: number;
	copiesSkipped: number;
	classPerItemEnabled: boolean;
	createdBiblioIds: number[];
	createdItemIds: number[];
	/** Copies that got a new barcode here: their labels are still to print. */
	generatedItemIds: number[];
}

export interface CatalogCommitOptions extends CatalogImportOptions {
	actor: AuditActor;
	filename: string;
	storeFile: (batchId: number) => string | null;
	/** Writes `classification.classPerItem: true` to the configuration (called before the transaction). */
	/** Switches `classification.classPerItem` in the configuration files (on for the import, off if it fails). */
	setClassPerItemInConfig?: (on: boolean) => void;
	now?: Date;
}

/**
 * The commit phase: validates again, refuses any error, switches the class-per-copy flag when the
 * operator said yes, then writes every record and copy in one transaction with an `import_batch` row;
 * when the transaction fails the flag is switched off again.
 */
export function commitCatalogImport(
	db: Db,
	inputs: readonly CatalogImportInput[],
	options: CatalogCommitOptions,
): CatalogImportSummary {
	const now = options.now ?? new Date();
	const check = validate(db, inputs, options);
	if (
		!check.canCommit ||
		(check.classPerItemQuestion > 0 && options.enableClassPerItem === undefined) ||
		(check.typeQuestion > 0 && options.useMajorityType === undefined) ||
		(check.callNumberQuestion > 0 && options.useComputedCallNumbers === undefined)
	) {
		throw new ImportNotReadyError();
	}
	const enabling = check.classPerItemQuestion > 0 && options.enableClassPerItem === true;
	if (enabling) {
		options.setClassPerItemInConfig?.(true);
	}
	const scheme = {
		...options.rules.scheme,
		classPerItem: options.rules.scheme.classPerItem || enabling,
	};
	const rules: CatalogRules = { ...options.rules, scheme };
	try {
		return commitInTransaction(db, inputs, options, rules, enabling, now);
	} catch (e) {
		// the database rolled back: the configuration goes back too, never "both" (Q96)
		if (enabling) {
			options.setClassPerItemInConfig?.(false);
		}
		throw e;
	}
}

function commitInTransaction(
	db: Db,
	inputs: readonly CatalogImportInput[],
	options: CatalogCommitOptions,
	rules: CatalogRules,
	enabling: boolean,
	now: Date,
): CatalogImportSummary {
	return db.transaction((tx) => {
		// again inside the transaction: the catalogue may have changed since the preview
		const result = validate(tx, inputs, options);
		if (!result.canCommit) {
			throw new ImportNotReadyError();
		}
		if (enabling) {
			moveClassesToItems(tx);
		}
		return withImportBatch(
			tx,
			{ ...options, kind: "catalog", now },
			() => writeCatalog(tx, result, { ...options, rules, now, enabling }),
			(summary) => ({
				titlesCreated: summary.titlesCreated,
				titlesMerged: summary.titlesMerged,
				copiesCreated: summary.copiesCreated,
				copiesSkipped: summary.copiesSkipped,
				classPerItemEnabled: summary.classPerItemEnabled,
			}),
		);
	});
}

/** The records and copies of a validated file, inside the commit's transaction. */
function writeCatalog(
	tx: DbOrTx,
	result: ReturnType<typeof validate>,
	options: CatalogCommitOptions & { rules: CatalogRules; now: Date; enabling: boolean },
): Omit<CatalogImportSummary, "batchId"> {
	const { rules, now } = options;
	const year = Number(options.today.slice(0, 4));
	const createdBiblioIds: number[] = [];
	const createdItemIds: number[] = [];
	const generatedItemIds: number[] = [];
	// imported codes of the current format move their counter past them before any code is
	// generated (codes of the same shape stored earlier are seen by the generator itself)
	const format = rules.codes.item.current;
	const counters = new Map<string, number>();
	for (const title of result.prepared) {
		for (const copy of title.copies) {
			if (copy.barcode !== "" && isValidCode(format, copy.barcode)) {
				const name = sequenceName("item", format, yearOf(format, copy.barcode));
				counters.set(
					name,
					Math.max(counters.get(name) ?? 0, counterOf(format, copy.barcode) ?? 0),
				);
			}
		}
	}
	for (const [name, counter] of counters) {
		ensureAtLeast(tx, name, counter);
	}
	let merged = 0;
	for (const title of result.prepared) {
		if (title.copies.length === 0) {
			continue;
		}
		let biblioId = title.biblioId;
		if (biblioId === null) {
			if (!title.biblio) {
				throw new ImportNotReadyError();
			}
			biblioId = createBiblio(tx, title.biblio, options.actor, rules, {
				source: "import",
				sourceId: title.group.startsWith("key:") ? title.group.slice(4) : null,
				now,
			});
			createdBiblioIds.push(biblioId);
		} else {
			merged++;
		}
		const record = tx.select().from(biblio).where(eq(biblio.id, biblioId)).get();
		if (!record) {
			throw new ImportNotReadyError();
		}
		// the labels already on the books were printed by the old system, unless the segnatura
		// changes here; a title still to classify gets its spine band once classified (9.21)
		for (const copy of title.copies) {
			const printed = copy.barcode !== "" && !copy.relabel;
			const barcode =
				copy.barcode === "" ? nextItemBarcode(tx, rules.codes, year) : copy.barcode;
			const row = tx
				.insert(item)
				.values({
					biblioId,
					barcode,
					callText: copy.item.callText ?? null,
					readingLevel: copy.item.readingLevel,
					enumeration: copy.item.enumeration,
					status: copy.status,
					notForLoan: copy.item.notForLoan ? 1 : 0,
					acquisitionDate: copy.item.acquisitionDate ?? options.today,
					notes: copy.item.notes,
					barcodeLabelPrintedAt: printed ? now.toISOString() : null,
					spineLabelPrintedAt:
						!printed || record.kind === null ? null : now.toISOString(),
					createdAt: now.toISOString(),
					updatedAt: now.toISOString(),
				})
				.returning({ id: item.id })
				.get();
			createdItemIds.push(row.id);
			if (copy.barcode === "") {
				generatedItemIds.push(row.id);
			}
		}
		refreshCallNumbers(tx, rules.scheme, [biblioId], now);
	}
	return {
		titlesCreated: createdBiblioIds.length,
		titlesMerged: merged,
		copiesCreated: createdItemIds.length,
		copiesSkipped: result.counts.unchanged,
		classPerItemEnabled: options.enabling,
		createdBiblioIds,
		createdItemIds,
		generatedItemIds,
	};
}
