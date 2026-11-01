// SPDX-License-Identifier: GPL-3.0-or-later
// OPAC SBN through the undocumented JSON gateway of its mobile app (`opacmobilegw`, Q26): opt-in,
// no guarantee. Answer shape observed: `{ numFound, briefRecords: [{
// codiceIdentificativo, isbn, autorePrincipale, titolo: "Title / statement", pubblicazione:
// "Place : Publisher, Year", livello, tipo }] }`. Parameters: `isbn`, `title`, `author`, `any`, `rows`.
import { toIsbn13 } from "#lib/shared/isbn.js";
import { clean, fetchJson, isRecord, stringOrNull } from "./http.js";
import {
	MetadataError,
	type BiblioDraft,
	type MetadataProvider,
	type MetadataQuery,
	type ProviderContext,
} from "./types.js";

const BASE = "https://opac.sbn.it/opacmobilegw/search.json";

export function sbnJsonUrl(query: MetadataQuery, rows: number): string {
	const params = new URLSearchParams();
	if (query.kind === "isbn") {
		params.set("isbn", query.isbn);
	} else {
		if (query.title) {
			params.set("title", query.title);
		}
		if (query.author) {
			params.set("author", query.author);
		}
		if (query.words) {
			params.set("any", query.words);
		}
	}
	params.set("rows", String(rows));
	return `${BASE}?${params.toString()}`;
}

/** `"Milano : Mondadori, 2019"` → place, publisher, year. */
export function splitPublication(value: string | null): {
	place: string | null;
	publisher: string | null;
	year: number | null;
} {
	if (!value) {
		return { place: null, publisher: null, year: null };
	}
	const year = /(1[5-9]\d{2}|20\d{2})/.exec(value);
	const [placePart, rest] = value.includes(" : ")
		? [value.slice(0, value.indexOf(" : ")), value.slice(value.indexOf(" : ") + 3)]
		: [null, value];
	const publisher = clean(rest.replace(/,\s*(?:stampa\s+)?(?:\[?\d{4}\]?.*)?$/i, "")).replace(
		/[,;]\s*$/,
		"",
	);
	return {
		place: placePart ? clean(placePart.replace(/^\[|\]$/g, "")) : null,
		publisher: publisher || null,
		year: year ? Number(year[1]) : null,
	};
}

export function mapBriefRecord(rec: Record<string, unknown>, ctx: ProviderContext): BiblioDraft {
	const { catalog } = ctx.config;
	const titolo = stringOrNull(rec.titolo) ?? "";
	const slash = titolo.indexOf(" / ");
	const title = slash >= 0 ? titolo.slice(0, slash) : titolo;
	const responsibility = slash >= 0 ? clean(titolo.slice(slash + 3)) : null;
	const [mainTitle, ...subtitles] = title.split(" : ");
	const pub = splitPublication(stringOrNull(rec.pubblicazione));
	const isbnRaw = stringOrNull(rec.isbn);
	return {
		title: clean(mainTitle ?? ""),
		subtitle: subtitles.length ? clean(subtitles.join(" : ")) : null,
		// the brief record carries no uniform title (Q123)
		originalTitle: null,
		responsibility,
		author: stringOrNull(rec.autorePrincipale) ?? catalog.specialAuthors[0] ?? "Anonimo",
		publisher: pub.publisher ?? catalog.unknownPublisher,
		publicationPlace: pub.place,
		publicationYear: pub.year,
		isbn: isbnRaw ? toIsbn13(isbnRaw) : null,
		issn: null,
		physicalDescription: null,
		series: null,
		seriesNumber: null,
		dewey: null,
		subjects: [],
		sourceId: stringOrNull(rec.codiceIdentificativo),
		source: "sbn-json",
	};
}

export const sbnJsonProvider: MetadataProvider = {
	id: "sbn-json",
	name: "OPAC SBN (JSON)",
	async lookup(query, ctx) {
		const rows =
			query.kind === "isbn"
				? ctx.config.z3950.maxRecordsIsbn
				: ctx.config.z3950.maxRecordsSearch;
		const data = await fetchJson(ctx, sbnJsonUrl(query, rows));
		if (!isRecord(data) || !Array.isArray(data.briefRecords)) {
			throw new MetadataError("protocol", "unexpected answer from opacmobilegw");
		}
		const drafts = data.briefRecords
			.filter(isRecord)
			.filter((r) => r.livello !== "Spoglio")
			.map((r) => mapBriefRecord(r, ctx));
		return { hits: typeof data.numFound === "number" ? data.numFound : drafts.length, drafts };
	},
};
