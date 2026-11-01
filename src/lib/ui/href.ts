// SPDX-License-Identifier: GPL-3.0-or-later
// The links of the UI components: a page of the app — a route path ("/patrons") or `resolve(…)`
// from `$app/paths`, both checked against the routes by the type checker — or an address outside
// the app (a web page, an e-mail, a generated file), which opens without the app's router.
import type { ResolvedPathname } from "$app/types";

export type ExternalHref = `${"http" | "https" | "mailto" | "data"}:${string}`;

export type Href = ResolvedPathname | ExternalHref;

export function isExternal(href: Href): href is ExternalHref {
	return /^[a-z]+:/i.test(href);
}

/**
 * A URL of this app (a navigation target, the current location) as a link: it already carries
 * the base path.
 */
export function appHref(
	url: Pick<URL, "pathname" | "search"> & { hash?: string },
): ResolvedPathname {
	return `${url.pathname}${url.search}${url.hash ?? ""}` as ResolvedPathname;
}
