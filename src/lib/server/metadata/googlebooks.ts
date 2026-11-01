// SPDX-License-Identifier: GPL-3.0-or-later
// Google Books volumes API (opt-in). Note: unauthenticated calls from a server
// answered HTTP 429 with a daily quota of 0, so in practice `GOOGLE_BOOKS_API_KEY` is needed;
// without a key the provider still tries once and reports `rate_limited` next to the other results.
import { env } from "#lib/server/env.js";
import { toIsbn13 } from "#lib/shared/isbn.js";
import { authorFromList, fetchJson, isRecord, stringArray, stringOrNull, yearOf } from "./http.js";
import {
	MetadataError,
	type BiblioDraft,
	type MetadataProvider,
	type MetadataQuery,
	type ProviderContext,
} from "./types.js";

const BASE = "https://www.googleapis.com/books/v1/volumes";

export function googleBooksUrl(query: MetadataQuery, max: number, apiKey: string | null): string {
	const q =
		query.kind === "isbn"
			? `isbn:${query.isbn}`
			: [
					query.title ? `intitle:"${query.title}"` : null,
					query.author ? `inauthor:"${query.author}"` : null,
					query.words ?? null,
				]
					.filter(Boolean)
					.join(" ");
	const params = new URLSearchParams({
		q,
		country: "IT",
		maxResults: String(Math.min(max, 40)),
		printType: "books",
	});
	if (apiKey) {
		params.set("key", apiKey);
	}
	return `${BASE}?${params.toString()}`;
}

export function mapVolume(item: Record<string, unknown>, ctx: ProviderContext): BiblioDraft | null {
	const info = item.volumeInfo;
	if (!isRecord(info)) {
		return null;
	}
	const { catalog } = ctx.config;
	const ids = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
	let isbn: string | null = null;
	for (const id of ids) {
		if (isRecord(id) && typeof id.identifier === "string") {
			isbn = toIsbn13(id.identifier) ?? isbn;
			if (id.type === "ISBN_13" && isbn) {
				break;
			}
		}
	}
	const pages = typeof info.pageCount === "number" && info.pageCount > 0 ? info.pageCount : null;
	return {
		title: stringOrNull(info.title) ?? "",
		subtitle: stringOrNull(info.subtitle),
		// the volume names no original work (Q123)
		originalTitle: null,
		responsibility: null,
		author: authorFromList(stringArray(info.authors), catalog.specialAuthors),
		publisher: stringOrNull(info.publisher) ?? catalog.unknownPublisher,
		publicationPlace: null,
		publicationYear: yearOf(stringOrNull(info.publishedDate)),
		isbn,
		issn: null,
		physicalDescription: pages ? `${pages} p.` : null,
		// `seriesInfo` names no series, only an id: nothing to show
		series: null,
		seriesNumber: null,
		dewey: null,
		subjects: stringArray(info.categories),
		sourceId: stringOrNull(item.id),
		source: "googlebooks",
	};
}

export const googleBooksProvider: MetadataProvider = {
	id: "googlebooks",
	name: "Google Books",
	async lookup(query, ctx) {
		const max =
			query.kind === "isbn"
				? ctx.config.z3950.maxRecordsIsbn
				: ctx.config.z3950.maxRecordsSearch;
		const data = await fetchJson(
			ctx,
			googleBooksUrl(query, max, env().GOOGLE_BOOKS_API_KEY ?? null),
		);
		if (!isRecord(data)) {
			throw new MetadataError("protocol", "unexpected answer from Google Books");
		}
		const items = Array.isArray(data.items) ? data.items.filter(isRecord) : [];
		const drafts = items
			.map((i) => mapVolume(i, ctx))
			.filter((d): d is BiblioDraft => d !== null);
		return {
			hits: typeof data.totalItems === "number" ? data.totalItems : drafts.length,
			drafts,
		};
	},
};
