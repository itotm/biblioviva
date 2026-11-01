// SPDX-License-Identifier: GPL-3.0-or-later
// Open Library (opt-in). By ISBN: the edition record `/isbn/<isbn>.json` (followed redirect) plus
// the author records for the names. By title/author: `/search.json`, which returns works, not
// editions, so publisher and year are the first known ones and the ISBN is left empty.
// Rate limit 3 req/s with an identifying `User-Agent` (Appendix F).
import { toIsbn13 } from "#lib/shared/isbn.js";
import {
	authorFromList,
	clean,
	fetchJson,
	firstDewey,
	isRecord,
	stringArray,
	stringOrNull,
	yearOf,
} from "./http.js";
import {
	MetadataError,
	type BiblioDraft,
	type MetadataProvider,
	type MetadataQuery,
	type ProviderContext,
} from "./types.js";

const BASE = "https://openlibrary.org";
const SEARCH_FIELDS =
	"key,title,subtitle,author_name,publisher,first_publish_year,publish_place,ddc,subject,number_of_pages_median";

export function openLibrarySearchUrl(query: MetadataQuery, limit: number): string {
	const params = new URLSearchParams({ fields: SEARCH_FIELDS, limit: String(limit) });
	if (query.kind === "isbn") {
		params.set("q", `isbn:${query.isbn}`);
	} else {
		if (query.title) {
			params.set("title", query.title);
		}
		if (query.author) {
			params.set("author", query.author);
		}
		if (query.words) {
			params.set("q", query.words);
		}
	}
	return `${BASE}/search.json?${params.toString()}`;
}

async function authorNames(keys: string[], ctx: ProviderContext): Promise<string[]> {
	const names = await Promise.all(
		keys.slice(0, 3).map(async (key) => {
			try {
				const data = await fetchJson(ctx, `${BASE}${key}.json`);
				return isRecord(data) ? stringOrNull(data.name) : null;
			} catch {
				return null;
			}
		}),
	);
	// three or more author keys still mean "many authors" even when a name could not be read
	return keys.length >= 3
		? keys.map((k, i) => names[i] ?? k)
		: names.filter((n): n is string => n !== null);
}

export async function mapEdition(
	edition: Record<string, unknown>,
	ctx: ProviderContext,
): Promise<BiblioDraft> {
	const { catalog } = ctx.config;
	const keys = Array.isArray(edition.authors)
		? edition.authors
				.filter(isRecord)
				.map((a) => a.key)
				.filter((k): k is string => typeof k === "string")
		: [];
	const names = await authorNames(keys, ctx);
	const isbn13 = stringArray(edition.isbn_13)[0] ?? stringArray(edition.isbn_10)[0] ?? null;
	const pages =
		typeof edition.number_of_pages === "number" ? `${edition.number_of_pages} p.` : null;
	return {
		title: stringOrNull(edition.title) ?? "",
		subtitle: stringOrNull(edition.subtitle),
		// an edition that is a translation names its original (Q123)
		originalTitle: stringOrNull(edition.translation_of),
		responsibility: stringOrNull(edition.by_statement),
		author: authorFromList(names, catalog.specialAuthors),
		publisher: stringArray(edition.publishers).map(clean)[0] ?? catalog.unknownPublisher,
		publicationPlace: stringArray(edition.publish_places).map(clean)[0] ?? null,
		publicationYear: yearOf(stringOrNull(edition.publish_date)),
		isbn: isbn13 ? toIsbn13(isbn13) : null,
		issn: null,
		physicalDescription: stringOrNull(edition.pagination) ?? pages,
		// the edition's `series` is mostly the publisher's collana ("Puffin books"): left out (Q84)
		series: null,
		seriesNumber: null,
		dewey: firstDewey(stringArray(edition.dewey_decimal_class)),
		subjects: stringArray(edition.subjects).slice(0, 10),
		sourceId: stringOrNull(edition.key),
		source: "openlibrary",
	};
}

export function mapWork(doc: Record<string, unknown>, ctx: ProviderContext): BiblioDraft {
	const { catalog } = ctx.config;
	const pages =
		typeof doc.number_of_pages_median === "number" ? doc.number_of_pages_median : null;
	return {
		title: stringOrNull(doc.title) ?? "",
		subtitle: stringOrNull(doc.subtitle),
		originalTitle: null,
		responsibility: null,
		author: authorFromList(stringArray(doc.author_name), catalog.specialAuthors),
		publisher: stringArray(doc.publisher).map(clean)[0] ?? catalog.unknownPublisher,
		publicationPlace: stringArray(doc.publish_place).map(clean)[0] ?? null,
		publicationYear: yearOf(
			typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
		),
		isbn: null,
		issn: null,
		physicalDescription: pages ? `${pages} p.` : null,
		series: null,
		seriesNumber: null,
		dewey: firstDewey(stringArray(doc.ddc)),
		subjects: stringArray(doc.subject).slice(0, 10),
		sourceId: stringOrNull(doc.key),
		source: "openlibrary",
	};
}

export const openLibraryProvider: MetadataProvider = {
	id: "openlibrary",
	name: "Open Library",
	async lookup(query, ctx) {
		if (query.kind === "isbn") {
			let data: unknown;
			try {
				data = await fetchJson(ctx, `${BASE}/isbn/${query.isbn}.json`);
			} catch (e) {
				// an unknown ISBN is a 404: no hits, not a failure
				if (e instanceof MetadataError && e.code === "http" && e.message.endsWith(" 404")) {
					return { hits: 0, drafts: [] };
				}
				throw e;
			}
			if (!isRecord(data)) {
				throw new MetadataError("protocol", "unexpected answer from Open Library");
			}
			return { hits: 1, drafts: [await mapEdition(data, ctx)] };
		}
		const data = await fetchJson(
			ctx,
			openLibrarySearchUrl(query, ctx.config.z3950.maxRecordsSearch),
		);
		if (!isRecord(data) || !Array.isArray(data.docs)) {
			throw new MetadataError("protocol", "unexpected answer from Open Library");
		}
		const drafts = data.docs.filter(isRecord).map((d) => mapWork(d, ctx));
		return { hits: typeof data.numFound === "number" ? data.numFound : drafts.length, drafts };
	},
};
