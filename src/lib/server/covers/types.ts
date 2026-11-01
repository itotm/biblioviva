// SPDX-License-Identifier: GPL-3.0-or-later
// Cover providers (PLAN.md §3.9, step 3.7b, Q27): each one turns an ISBN-13 into image bytes or
// null, within a timeout and with an identifying User-Agent. The chain in `index.ts` tries them in
// the configured order and falls through silently.
export type CoverProviderId = "googlebooks" | "amazon" | "openlibrary" | "mock";

export interface CoverContext {
	fetch: typeof fetch;
	userAgent: string;
	timeoutMs: number;
	/** `covers.country` (Google Books market). */
	country: string;
	googleBooksApiKey: string | null;
}

export interface CoverProvider {
	id: CoverProviderId;
	name: string;
	/** Image bytes, or null when the provider has no cover for the ISBN. */
	fetch(isbn13: string, ctx: CoverContext): Promise<Uint8Array | null>;
}

/** GET with timeout and User-Agent; null on a 404 (nothing there), throws on other failures. */
export async function fetchBytes(
	ctx: CoverContext,
	url: string,
	accept = "image/*",
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
	const response = await ctx.fetch(url, {
		headers: { accept, "user-agent": ctx.userAgent },
		signal: AbortSignal.timeout(ctx.timeoutMs),
		redirect: "follow",
	});
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new Error(`${url} answered ${response.status}`);
	}
	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		contentType: response.headers.get("content-type") ?? "",
	};
}
