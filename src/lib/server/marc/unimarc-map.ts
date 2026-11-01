// SPDX-License-Identifier: GPL-3.0-or-later
// UNIMARC → BiblioDraft (PLAN.md Appendix D): the few fields the catalogue keeps (Q73), with the
// SBN conventions seen in the recorded fixtures (`$b , Name` with a leading comma, `[2014]`
// bracketed years, repeated `$c` publishers, `210` today and `214` in newer records).
import { controlField, fieldsOf, subfield, subfieldsOf, type MarcRecord } from "./iso2709.js";
import { toIsbn13 } from "#lib/shared/isbn.js";

export interface BiblioDraft {
	title: string;
	subtitle: string | null;
	/** The title of the original work, only for a translation (step 9.23, Q123). */
	originalTitle: string | null;
	responsibility: string | null;
	author: string;
	publisher: string;
	publicationPlace: string | null;
	publicationYear: number | null;
	isbn: string | null;
	issn: string | null;
	physicalDescription: string | null;
	/** The series the book belongs to (Q84), never the publisher's collana. */
	series: string | null;
	/** Number in the series as printed (`3`, `3.5`, `II`). */
	seriesNumber: string | null;
	dewey: string | null;
	subjects: string[];
	/** Provider record id (SBN BID). */
	sourceId: string | null;
	source: string;
}

export interface MapOptions {
	/** `catalog.specialAuthors`: the first one stands for an unknown author, the second for many. */
	specialAuthors: string[];
	unknownPublisher: string;
	source?: string;
}

// SBN records carry ISO 6630 sorting markers (NSB/NSE, 0x88/0x89) and other C0/C1 control
// characters inside titles ("L'\u0088eco\u0089vandalo"): they are dropped, never shown.
const clean = (s: string): string =>
	s
		// eslint-disable-next-line no-control-regex -- the markers are control characters by design
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
		.replace(/\s+/g, " ")
		.replace(/\s+([,;:.])/g, "$1")
		.trim();

/** `Rowling` + `, J. K.` → `Rowling, J. K.`; `Tolkien` alone stays. */
function personName(surname: string, forename: string | null): string {
	const a = clean(surname).replace(/[,\s]+$/, "");
	const b = forename ? clean(forename).replace(/^[,\s]+/, "") : "";
	return b ? `${a}, ${b}` : a;
}

function firstYear(values: string[]): number | null {
	for (const v of values) {
		const m = /(1[5-9]\d{2}|20\d{2})/.exec(v);
		if (m) {
			return Number(m[1]);
		}
	}
	return null;
}

export function mapUnimarc(record: MarcRecord, options: MapOptions): BiblioDraft {
	const title200 = fieldsOf(record, "200")[0];
	const title = title200 ? subfieldsOf(title200, "a").map(clean).join(" ; ") : "";
	const subtitle = title200 ? subfieldsOf(title200, "e").map(clean).join(" : ") : "";
	const responsibility = title200
		? [...subfieldsOf(title200, "f"), ...subfieldsOf(title200, "g")].map(clean).join(" ; ")
		: "";

	// publication: 214 (new cataloguing) wins over 210 when present
	const pub = fieldsOf(record, "214")[0] ?? fieldsOf(record, "210")[0];
	const publisher = pub ? subfieldsOf(pub, "c").map(clean).join(" ; ") : "";
	const place = pub
		? subfieldsOf(pub, "a")
				.map((p) => clean(p).replace(/^\[|\]$/g, ""))
				.join(" ; ")
		: "";
	const year = pub ? firstYear(subfieldsOf(pub, "d")) : null;

	const physical = fieldsOf(record, "215")[0];
	const physicalDescription = physical
		? [
				subfield(physical, "a"),
				subfield(physical, "c") ? `: ${subfield(physical, "c")}` : null,
				subfield(physical, "d") ? `; ${subfield(physical, "d")}` : null,
			]
				.filter((x): x is string => Boolean(x))
				.map(clean)
				.join(" ")
				.replace(/\.$/, "")
		: null;

	let isbn: string | null = null;
	for (const f of fieldsOf(record, "010")) {
		const a = subfield(f, "a");
		const normalised = a ? toIsbn13(a) : null;
		if (normalised) {
			isbn = normalised;
			break;
		}
	}
	const issnField = fieldsOf(record, "011")[0];
	const issn = issnField ? subfield(issnField, "a") : null;

	// series (Q84): the 461 set a volume belongs to ("Il Signore degli anelli ; 2"); the 225/410
	// series statements of SBN hold the publisher's collana ("Il battello a vapore. Serie azzurra"),
	// which the owner does not want as the series, so they are left out on purpose
	const set461 = fieldsOf(record, "461")[0];
	const seriesTitle = set461 ? clean(subfield(set461, "a") ?? "") : "";
	const seriesNumber = set461 ? clean(subfield(set461, "v") ?? "") : "";

	// original title (Q123): the uniform title 500$a, only for a translation — the language of the
	// original (101$c) differs from the language of the text (101$a); SBN records give a 500 to
	// works in their own language too ("Harry Potter" on an English edition), which is no original
	const languages = fieldsOf(record, "101")[0];
	const textLanguages = languages ? subfieldsOf(languages, "a").map((l) => l.trim()) : [];
	const originalLanguages = languages ? subfieldsOf(languages, "c").map((l) => l.trim()) : [];
	const translated = originalLanguages.some((l) => l && !textLanguages.includes(l));
	const uniform = translated ? fieldsOf(record, "500")[0] : undefined;
	const originalTitle = uniform ? clean(subfield(uniform, "a") ?? "").replace(/[.\s]+$/, "") : "";

	const deweyField = fieldsOf(record, "676")[0];
	const deweyRaw = deweyField ? subfield(deweyField, "a") : null;
	const dewey = deweyRaw ? (/\d{1,3}(?:\.\d+)?/.exec(deweyRaw)?.[0] ?? null) : null;

	const subjects = fieldsOf(record, "606").map((f) =>
		[subfield(f, "a"), ...subfieldsOf(f, "x")]
			.filter((x): x is string => Boolean(x))
			.map(clean)
			.join(" - "),
	);

	// author: 700, else the first 701, else 710; three or more personal names → "AA. VV."
	const persons = [...fieldsOf(record, "700"), ...fieldsOf(record, "701")];
	const unknownAuthor = options.specialAuthors[0] ?? "Anonimo";
	const manyAuthors = options.specialAuthors[1] ?? "AA. VV.";
	let author: string;
	if (persons.length >= 3) {
		author = manyAuthors;
	} else {
		const main = fieldsOf(record, "700")[0] ?? fieldsOf(record, "701")[0];
		const corporate = fieldsOf(record, "710")[0];
		if (main && subfield(main, "a")) {
			author = personName(subfield(main, "a") ?? "", subfield(main, "b"));
		} else if (corporate && subfield(corporate, "a")) {
			author = clean(subfield(corporate, "a") ?? "");
		} else {
			author = unknownAuthor;
		}
	}

	return {
		title,
		subtitle: subtitle || null,
		originalTitle: originalTitle && originalTitle !== title ? originalTitle : null,
		responsibility: responsibility || null,
		author,
		publisher: publisher || options.unknownPublisher,
		publicationPlace: place || null,
		publicationYear: year,
		isbn,
		issn,
		physicalDescription,
		series: seriesTitle || null,
		seriesNumber: seriesTitle && seriesNumber ? seriesNumber : null,
		dewey,
		subjects,
		sourceId: controlField(record, "001"),
		source: options.source ?? "sbn",
	};
}
