// SPDX-License-Identifier: GPL-3.0-or-later
// The catalogue in MARC and back (PLAN.md step 9.65, Q156): one record per title with its copies,
// UNIMARC (the Italian libraries, SBN) or MARC 21. The standard fields carry what other systems
// read — the copies in 995 (UNIMARC) or 952 (MARC 21), the fields of Koha's items —; two local
// fields carry what only BiblioViva has, so a file of BiblioViva comes back whole:
//   959 (the title): $a kind, $g genre, $c class, $l reading level, $t item type, $f accessible
//       formats (repeated);
//   958 (one per copy): $f barcode, $k call number, $l reading level, $h volume, $s status, $n not
//       for loan, $d acquisition date, $u notes, $i inventory number, $e origin, $g value.
// A file of another system has neither: its copies come from 995 or 952, its classification from
// the copies' collection code (Koha's ccode, the column `classification` of the CSV import).
import { CATALOG_IMPORT, type CatalogField } from "#lib/shared/import-columns.js";
import {
	fieldsOf,
	isDataField,
	subfield,
	subfieldsOf,
	type DataField,
	type MarcRecord,
} from "./iso2709.js";
import type { MarcFlavour } from "./read.js";
import { mapUnimarc } from "./unimarc-map.js";

/** A copy as the export reads it from the database. */
export interface MarcCopy {
	barcode: string;
	callNumber: string | null;
	readingLevel: string | null;
	enumeration: string | null;
	status: string;
	notForLoan: boolean;
	acquisitionDate: string | null;
	notes: string | null;
	inventoryNumber: string | null;
	origin: string | null;
	valueCents: number | null;
}

/** A title as the export reads it from the database, with its copies. */
export interface MarcTitle {
	id: number;
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
	itemType: string;
	kind: string | null;
	genreCode: string | null;
	classCode: string | null;
	readingLevel: string | null;
	subjects: string[];
	accessibleFormats: string[];
	notes: string | null;
	/** `YYYY-MM-DD`: the day the record was made (UNIMARC 100, MARC 21 008). */
	createdOn: string;
	copies: MarcCopy[];
}

export interface MarcWriteOptions {
	/** `catalog.specialAuthors[0]`: the unknown author, written as no author at all. */
	unknownAuthor: string;
	/** The language of the cataloguing: `it` → `ita`, otherwise `eng`. */
	locale: string;
}

type Sub = [code: string, value: string | null | undefined];

function data(tag: string, ind: string, subs: Sub[]): DataField | null {
	const subfields = subs
		.filter((s): s is [string, string] => typeof s[1] === "string" && s[1].trim() !== "")
		.map(([code, value]) => ({ code, value: value.trim() }));
	return subfields.length === 0
		? null
		: { tag, ind1: ind.charAt(0) || " ", ind2: ind.charAt(1) || " ", subfields };
}

/** `Rodari, Gianni` → `["Rodari", "Gianni"]`; a name without a comma stays whole. */
function nameParts(author: string): [string, string | null] {
	const comma = author.indexOf(",");
	return comma < 0
		? [author, null]
		: [author.slice(0, comma).trim(), author.slice(comma + 1).trim() || null];
}

/** A note of several lines: one field per line, since MARC has no line breaks. */
const linesOf = (text: string | null): string[] =>
	(text ?? "")
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

const euro = (cents: number | null): string | null =>
	cents === null ? null : (cents / 100).toFixed(2);

/** The local field of the title (959), the same in both flavours. */
function titleLocal(t: MarcTitle): DataField | null {
	return data("959", "  ", [
		["a", t.kind],
		["g", t.genreCode],
		["c", t.classCode],
		["l", t.readingLevel],
		["t", t.itemType],
		...t.accessibleFormats.map((f): Sub => ["f", f]),
	]);
}

/** The local field of a copy (958), the same in both flavours. */
function copyLocal(c: MarcCopy): DataField | null {
	return data("958", "  ", [
		["f", c.barcode],
		["k", c.callNumber],
		["l", c.readingLevel],
		["h", c.enumeration],
		["s", c.status],
		["n", c.notForLoan ? "1" : "0"],
		["d", c.acquisitionDate],
		...linesOf(c.notes).map((l): Sub => ["u", l]),
		["i", c.inventoryNumber],
		["e", c.origin],
		["g", euro(c.valueCents)],
	]);
}

const collection = (t: MarcTitle): string | null => t.genreCode ?? t.classCode;

function unimarcRecord(t: MarcTitle, o: MarcWriteOptions): MarcRecord {
	const lang = o.locale === "it" ? "ita" : "eng";
	const year = t.publicationYear === null ? "    " : String(t.publicationYear).padStart(4, "0");
	// 100 $a: the day of entry, a single date, the language of cataloguing, Unicode (`50`)
	const general = `${t.createdOn.replaceAll("-", "")}d${year}    u  y0${lang}y50      ba`;
	const [surname, forename] = nameParts(t.author);
	const fields = [
		{ tag: "001", value: String(t.id) },
		data("010", "  ", [["a", t.isbn]]),
		data("011", "  ", [["a", t.issn]]),
		data("073", " 0", [["a", t.ean]]),
		data("100", "  ", [["a", general]]),
		// a translation: the language of the original differs, so 500 is its original title
		t.originalTitle
			? data("101", "1 ", [
					["a", lang],
					["c", "und"],
				])
			: null,
		data("200", "1 ", [
			["a", t.title],
			["e", t.subtitle],
			["f", t.responsibility],
		]),
		data("210", "  ", [
			["a", t.publicationPlace],
			["c", t.publisher],
			["d", t.publicationYear === null ? null : String(t.publicationYear)],
		]),
		data("215", "  ", [["a", t.physicalDescription]]),
		...linesOf(t.notes).map((l) => data("300", "  ", [["a", l]])),
		data("461", " 1", [
			["a", t.series],
			["v", t.seriesNumber],
		]),
		data("500", "10", [["a", t.originalTitle]]),
		...t.subjects.map((s) => data("606", "  ", [["a", s]])),
		data("676", "  ", [["a", t.dewey]]),
		t.author === o.unknownAuthor
			? null
			: data("700", " 1", [
					["a", surname],
					["b", forename],
				]),
		titleLocal(t),
		// the copies as Koha's UNIMARC framework reads them [VERIFY at the Koha migration: 995's
		// subfields in the school's framework]
		...t.copies.map((c) =>
			data("995", "  ", [
				["f", c.barcode],
				["k", c.callNumber],
				["r", t.itemType],
				["h", collection(t)],
				["u", c.notes],
			]),
		),
		...t.copies.map(copyLocal),
	];
	return {
		leader: "00000nam  2200000   450 ",
		fields: fields.filter((f): f is NonNullable<typeof f> => f !== null),
	};
}

function marc21Record(t: MarcTitle, o: MarcWriteOptions): MarcRecord {
	const year = t.publicationYear === null ? "    " : String(t.publicationYear).padStart(4, "0");
	// 008: the day of entry (yymmdd), a single date, no country, language undetermined
	const fixed = `${t.createdOn.replaceAll("-", "").slice(2)}s${year}    xx ${" ".repeat(17)}und d`;
	const flag = (on: boolean): string | null => (on ? "1" : null);
	const fields = [
		{ tag: "001", value: String(t.id) },
		{ tag: "008", value: fixed },
		data("020", "  ", [["a", t.isbn]]),
		data("022", "  ", [["a", t.issn]]),
		data("024", "3 ", [["a", t.ean]]),
		data("082", "04", [["a", t.dewey]]),
		t.author === o.unknownAuthor ? null : data("100", "1 ", [["a", t.author]]),
		data("240", "10", [["a", t.originalTitle]]),
		data("245", t.author === o.unknownAuthor ? "00" : "10", [
			["a", t.title],
			["b", t.subtitle],
			["c", t.responsibility],
		]),
		data("264", " 1", [
			["a", t.publicationPlace],
			["b", t.publisher],
			["c", t.publicationYear === null ? null : String(t.publicationYear)],
		]),
		data("300", "  ", [["a", t.physicalDescription]]),
		data("490", "0 ", [
			["a", t.series],
			["v", t.seriesNumber],
		]),
		...linesOf(t.notes).map((l) => data("500", "  ", [["a", l]])),
		...t.subjects.map((s) => data("650", " 4", [["a", s]])),
		data("942", "  ", [["c", t.itemType]]),
		titleLocal(t),
		// the copies as Koha's 952 holds them
		...t.copies.map((c) =>
			data("952", "  ", [
				["p", c.barcode],
				["o", c.callNumber],
				["y", t.itemType],
				["8", collection(t)],
				["d", c.acquisitionDate],
				["h", c.enumeration],
				["x", c.notes],
				["7", flag(c.notForLoan)],
				["1", flag(c.status === "lost")],
				["4", flag(c.status === "damaged")],
				["0", flag(c.status === "withdrawn")],
				["i", c.inventoryNumber],
				["e", c.origin],
				["g", euro(c.valueCents)],
			]),
		),
		...t.copies.map(copyLocal),
	];
	return {
		leader: "00000nam a2200000 i 4500",
		fields: fields.filter((f): f is NonNullable<typeof f> => f !== null),
	};
}

/** The MARC record of a title with its copies. */
export function titleToMarc(t: MarcTitle, flavour: MarcFlavour, o: MarcWriteOptions): MarcRecord {
	return flavour === "unimarc" ? unimarcRecord(t, o) : marc21Record(t, o);
}

// --- Reading: a MARC file as the rows of the catalogue import ---------------------------------

/** The columns of the rows, in the order of the catalogue export. */
export const MARC_IMPORT_FIELDS: readonly CatalogField[] = [
	"biblioKey",
	"title",
	"author",
	"publisher",
	"isbn",
	"issn",
	"ean",
	"subtitle",
	"originalTitle",
	"responsibility",
	"publicationPlace",
	"publicationYear",
	"physicalDescription",
	"series",
	"seriesNumber",
	"dewey",
	"classification",
	"readingLevel",
	"itemType",
	"subjects",
	"accessibleFormats",
	"notes",
	"barcode",
	"callNumber",
	"enumeration",
	"status",
	"notForLoan",
	"acquisitionDate",
	"itemNotes",
	"inventoryNumber",
	"origin",
	"value",
];

const HEADER = MARC_IMPORT_FIELDS.map(
	(f) => CATALOG_IMPORT.columns.find((c) => c.field === f)?.header ?? f,
);

type Row = Partial<Record<CatalogField, string>>;

export interface MarcReadOptions {
	/** `catalog.specialAuthors`: the first for a record without an author, the second for many. */
	specialAuthors: string[];
	unknownPublisher: string;
}

const first = (record: MarcRecord, tag: string, code: string): string =>
	fieldsOf(record, tag)
		.map((f) => subfield(f, code))
		.find((v): v is string => Boolean(v)) ?? "";

// ISBD punctuation that MARC 21 leaves at the end of a subfield (`Title /`, `Torino :`)
const unpunct = (s: string): string =>
	s
		.replace(/\s*[/:;,=]\s*$/, "")
		.replace(/\.$/, "")
		.trim();

/** The title's fields in MARC 21 (245, 100, 264/260, 020, 490…), like `mapUnimarc` for UNIMARC. */
function marc21Title(r: MarcRecord, o: MarcReadOptions): Row {
	const t245 = fieldsOf(r, "245")[0];
	const pub =
		fieldsOf(r, "264").find((f) => f.ind2 === "1") ??
		fieldsOf(r, "264")[0] ??
		fieldsOf(r, "260")[0];
	const persons = [...fieldsOf(r, "100"), ...fieldsOf(r, "700")];
	const main = fieldsOf(r, "100")[0];
	const corporate = fieldsOf(r, "110")[0];
	let author = o.specialAuthors[0] ?? "Anonimo";
	if (persons.length >= 3) {
		author = o.specialAuthors[1] ?? "AA. VV.";
	} else if (main && subfield(main, "a")) {
		author = unpunct(subfield(main, "a") ?? "");
	} else if (corporate && subfield(corporate, "a")) {
		author = unpunct(subfield(corporate, "a") ?? "");
	}
	const isbn = fieldsOf(r, "020")
		.map((f) => (subfield(f, "a") ?? "").split(/\s/)[0] ?? "")
		.find(Boolean);
	const series = fieldsOf(r, "490")[0] ?? fieldsOf(r, "830")[0];
	return {
		title: t245 ? unpunct(subfieldsOf(t245, "a").join(" ")) : "",
		subtitle: t245 ? unpunct(subfieldsOf(t245, "b").join(" : ")) : "",
		responsibility: t245 ? unpunct(subfieldsOf(t245, "c").join(" ; ")) : "",
		author,
		publisher: pub
			? unpunct(subfieldsOf(pub, "b").join(" ; ")) || o.unknownPublisher
			: o.unknownPublisher,
		publicationPlace: pub
			? unpunct(subfieldsOf(pub, "a").join(" ; ")).replace(/^\[|\]$/g, "")
			: "",
		publicationYear: pub
			? (/(1[5-9]\d{2}|20\d{2})/.exec(subfield(pub, "c") ?? "")?.[1] ?? "")
			: "",
		isbn: isbn ?? "",
		issn: first(r, "022", "a"),
		ean:
			fieldsOf(r, "024")
				.filter((f) => f.ind1 === "3")
				.map((f) => subfield(f, "a") ?? "")
				.find(Boolean) ?? "",
		originalTitle: unpunct(first(r, "240", "a")),
		physicalDescription: unpunct(first(r, "300", "a")),
		series: series ? unpunct(subfield(series, "a") ?? "") : "",
		seriesNumber: series ? unpunct(subfield(series, "v") ?? "") : "",
		dewey: /\d{1,3}(?:\.\d+)?/.exec(first(r, "082", "a"))?.[0] ?? "",
		subjects: fieldsOf(r, "650")
			.map((f) =>
				[subfield(f, "a"), ...subfieldsOf(f, "x")]
					.filter(Boolean)
					.map((s) => unpunct(s ?? ""))
					.join(" - "),
			)
			.filter(Boolean)
			.join("\n"),
		notes: fieldsOf(r, "500")
			.map((f) => subfield(f, "a") ?? "")
			.filter(Boolean)
			.join("\n"),
		itemType: first(r, "942", "c"),
	};
}

/** The title's fields in UNIMARC, through the mapping of the metadata lookups (Appendix D). */
function unimarcTitle(r: MarcRecord, o: MarcReadOptions): Row {
	const d = mapUnimarc(r, {
		specialAuthors: o.specialAuthors,
		unknownPublisher: o.unknownPublisher,
		source: "import",
	});
	return {
		title: d.title,
		subtitle: d.subtitle ?? "",
		originalTitle: d.originalTitle ?? "",
		responsibility: d.responsibility ?? "",
		author: d.author,
		publisher: d.publisher,
		publicationPlace: d.publicationPlace ?? "",
		publicationYear: d.publicationYear === null ? "" : String(d.publicationYear),
		isbn: d.isbn ?? "",
		issn: d.issn ?? "",
		ean: first(r, "073", "a"),
		physicalDescription: d.physicalDescription ?? "",
		series: d.series ?? "",
		seriesNumber: d.seriesNumber ?? "",
		dewey: d.dewey ?? "",
		subjects: d.subjects.join("\n"),
		notes: fieldsOf(r, "300")
			.map((f) => subfield(f, "a") ?? "")
			.filter(Boolean)
			.join("\n"),
	};
}

/**
 * The title's fields of a file of BiblioViva (it has the local 959): read back exactly as
 * `titleToMarc` wrote them, without the clean-ups other systems' records need.
 */
function ownTitle(r: MarcRecord, flavour: MarcFlavour, o: MarcReadOptions): Row {
	const raw = (tag: string, code: string): string => first(r, tag, code);
	const all = (tag: string, code: string): string[] =>
		fieldsOf(r, tag).flatMap((f) => subfieldsOf(f, code));
	if (flavour === "unimarc") {
		const surname = raw("700", "a");
		const forename = raw("700", "b");
		return {
			title: raw("200", "a"),
			subtitle: raw("200", "e"),
			responsibility: raw("200", "f"),
			author: surname
				? forename
					? `${surname}, ${forename}`
					: surname
				: (o.specialAuthors[0] ?? "Anonimo"),
			publisher: raw("210", "c"),
			publicationPlace: raw("210", "a"),
			publicationYear: raw("210", "d"),
			isbn: raw("010", "a"),
			issn: raw("011", "a"),
			ean: raw("073", "a"),
			physicalDescription: raw("215", "a"),
			notes: all("300", "a").join("\n"),
			series: raw("461", "a"),
			seriesNumber: raw("461", "v"),
			originalTitle: raw("500", "a"),
			subjects: all("606", "a").join("\n"),
			dewey: raw("676", "a"),
		};
	}
	return {
		title: raw("245", "a"),
		subtitle: raw("245", "b"),
		responsibility: raw("245", "c"),
		author: raw("100", "a") || (o.specialAuthors[0] ?? "Anonimo"),
		publisher: raw("264", "b"),
		publicationPlace: raw("264", "a"),
		publicationYear: raw("264", "c"),
		isbn: raw("020", "a"),
		issn: raw("022", "a"),
		ean: raw("024", "a"),
		physicalDescription: raw("300", "a"),
		notes: all("500", "a").join("\n"),
		series: raw("490", "a"),
		seriesNumber: raw("490", "v"),
		originalTitle: raw("240", "a"),
		subjects: all("650", "a").join("\n"),
		dewey: raw("082", "a"),
	};
}

/** The copies of a record: BiblioViva's 958, else Koha's 995 (UNIMARC) or 952 (MARC 21). */
function copiesOf(r: MarcRecord, flavour: MarcFlavour): { copy: Row; collection: string }[] {
	const own = fieldsOf(r, "958");
	if (own.length > 0) {
		return own.map((f) => ({
			collection: "",
			copy: {
				barcode: subfield(f, "f") ?? "",
				callNumber: subfield(f, "k") ?? "",
				readingLevel: subfield(f, "l") ?? "",
				enumeration: subfield(f, "h") ?? "",
				status: subfield(f, "s") ?? "",
				notForLoan: subfield(f, "n") ?? "",
				acquisitionDate: subfield(f, "d") ?? "",
				itemNotes: subfieldsOf(f, "u").join("\n"),
				inventoryNumber: subfield(f, "i") ?? "",
				origin: subfield(f, "e") ?? "",
				value: subfield(f, "g") ?? "",
			},
		}));
	}
	if (flavour === "unimarc") {
		return fieldsOf(r, "995").map((f) => ({
			collection: subfield(f, "h") ?? "",
			copy: {
				barcode: subfield(f, "f") ?? "",
				callNumber: subfield(f, "k") ?? "",
				itemType: subfield(f, "r") ?? "",
				itemNotes: subfield(f, "u") ?? "",
			},
		}));
	}
	return fieldsOf(r, "952").map((f) => {
		const on = (code: string): boolean => /^[1-9]/.test(subfield(f, code) ?? "");
		const status = on("0") ? "withdrawn" : on("1") ? "lost" : on("4") ? "damaged" : "";
		return {
			collection: subfield(f, "8") ?? "",
			copy: {
				barcode: subfield(f, "p") ?? "",
				callNumber: subfield(f, "o") ?? "",
				itemType: subfield(f, "y") ?? "",
				acquisitionDate: subfield(f, "d") ?? "",
				enumeration: subfield(f, "h") ?? "",
				itemNotes: subfield(f, "x") ?? "",
				notForLoan: on("7") ? "1" : "",
				status,
				inventoryNumber: subfield(f, "i") ?? "",
				origin: subfield(f, "e") ?? "",
				value: subfield(f, "g") ?? "",
			},
		};
	});
}

/**
 * A MARC file's records as the rows of the catalogue import (one per copy, the title's fields on
 * each, a title without copies on one row): the header first, then the rows; `lines` numbers the
 * rows from 1 (one per copy, as the preview lists them), the header 0.
 */
export function marcToCatalogRows(
	records: readonly MarcRecord[],
	flavour: MarcFlavour,
	o: MarcReadOptions,
): { rows: string[][]; lines: number[] } {
	const rows: string[][] = [HEADER];
	const lines: number[] = [0];
	records.forEach((r, index) => {
		const own = fieldsOf(r, "959")[0];
		const title = own
			? ownTitle(r, flavour, o)
			: flavour === "unimarc"
				? unimarcTitle(r, o)
				: marc21Title(r, o);
		const local: Row = own
			? {
					classification: subfield(own, "g") ?? subfield(own, "c") ?? "",
					readingLevel: subfield(own, "l") ?? "",
					itemType: subfield(own, "t") ?? title.itemType ?? "",
					accessibleFormats: subfieldsOf(own, "f").join("; "),
				}
			: {};
		const key =
			r.fields.find((f) => f.tag === "001" && !isDataField(f) && f.value.trim() !== "") ??
			null;
		const biblioKey = key && !isDataField(key) ? key.value.trim() : `marc-${index + 1}`;
		const copies = copiesOf(r, flavour);
		for (const { copy, collection } of copies.length > 0
			? copies
			: [{ copy: {}, collection: "" }]) {
			const row: Row = {
				...title,
				classification: collection,
				...local,
				...Object.fromEntries(Object.entries(copy).filter(([, v]) => v !== "")),
				biblioKey,
			};
			rows.push(MARC_IMPORT_FIELDS.map((f) => row[f] ?? ""));
			lines.push(rows.length - 1);
		}
	});
	return { rows, lines };
}
