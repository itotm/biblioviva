// SPDX-License-Identifier: GPL-3.0-or-later
// Amazon cover through the undocumented image URL by ISBN-10 (the same source Koha uses, Q27):
// no API and no guarantee; a missing cover comes back as a 1 × 1 GIF, which the chain treats as
// "not found" through the minimum width check.
import { isbn13To10 } from "#lib/shared/isbn.js";
import { fetchBytes, type CoverProvider } from "./types.js";

export function amazonUrl(isbn10: string): string {
	return `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01._SCLZZZZZZZ_.jpg`;
}

export const amazonCovers: CoverProvider = {
	id: "amazon",
	name: "Amazon",
	async fetch(isbn13, ctx) {
		const isbn10 = isbn13To10(isbn13);
		if (!isbn10) {
			return null;
		}
		const answer = await fetchBytes(ctx, amazonUrl(isbn10));
		return answer?.contentType.startsWith("image/") ? answer.bytes : null;
	},
};
