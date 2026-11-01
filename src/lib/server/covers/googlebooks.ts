// SPDX-License-Identifier: GPL-3.0-or-later
// Google Books cover: the volume found by ISBN gives a small thumbnail (`imageLinks`); the larger
// front cover comes from the content endpoint with `zoom=2` (undocumented but long-standing).
// Unauthenticated calls answered HTTP 429 in 2026 (see the metadata provider), so an API key is
// needed in practice; every failure falls through to the next provider.
import { fetchBytes, type CoverProvider } from "./types.js";

export function volumesUrl(isbn13: string, country: string, apiKey: string | null): string {
	const params = new URLSearchParams({ q: `isbn:${isbn13}`, country, maxResults: "1" });
	if (apiKey) {
		params.set("key", apiKey);
	}
	return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

export function contentUrl(volumeId: string): string {
	return `https://books.google.com/books/content?id=${encodeURIComponent(volumeId)}&printsec=frontcover&img=1&zoom=2`;
}

interface Volume {
	id?: string;
	volumeInfo?: { imageLinks?: Record<string, string> };
}

export const googleBooksCovers: CoverProvider = {
	id: "googlebooks",
	name: "Google Books",
	async fetch(isbn13, ctx) {
		const answer = await fetchBytes(
			ctx,
			volumesUrl(isbn13, ctx.country, ctx.googleBooksApiKey),
			"application/json",
		);
		if (!answer) {
			return null;
		}
		const data = JSON.parse(new TextDecoder().decode(answer.bytes)) as { items?: Volume[] };
		const volume = data.items?.[0];
		if (!volume?.id) {
			return null;
		}
		const links = volume.volumeInfo?.imageLinks ?? {};
		const candidates = [
			contentUrl(volume.id),
			...["extraLarge", "large", "medium", "small", "thumbnail"]
				.map((k) => links[k])
				.filter((u): u is string => typeof u === "string")
				.map((u) => u.replace(/^http:/, "https:")),
		];
		for (const url of candidates) {
			const image = await fetchBytes(ctx, url).catch(() => null);
			if (image?.contentType.startsWith("image/")) {
				return image.bytes;
			}
		}
		return null;
	},
};
