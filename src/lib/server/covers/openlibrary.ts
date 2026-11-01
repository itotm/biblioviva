// SPDX-License-Identifier: GPL-3.0-or-later
// Open Library covers by ISBN (`default=false` makes a missing cover a 404 instead of a
// placeholder); rate limited to 100 requests per 5 minutes per IP (Appendix F).
import { fetchBytes, type CoverProvider } from "./types.js";

export function openLibraryUrl(isbn13: string): string {
	return `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`;
}

export const openLibraryCovers: CoverProvider = {
	id: "openlibrary",
	name: "Open Library",
	async fetch(isbn13, ctx) {
		const answer = await fetchBytes(ctx, openLibraryUrl(isbn13));
		return answer?.contentType.startsWith("image/") ? answer.bytes : null;
	},
};
