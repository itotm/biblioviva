// SPDX-License-Identifier: GPL-3.0-or-later
// The language of a visitor of the public demo (PLAN.md §3.16, Q120, ADR-047): the cookie `bv_lang`
// written by the switch of the top bar, shared with the home page and the documentation on
// biblioviva.org, else the browser's preferred language among the available ones. An installation
// at a school has one language for every device: no switch, no cookie.

/** The cookie of the language chosen on biblioviva.org (the home page, the documentation, the demo). */
export const LANG_COOKIE = "bv_lang";

/** The domain the cookie is shared on: the home page and its subdomains (`docs.`, `demo.`). */
const SITE_DOMAIN = "biblioviva.org";

/** One year: the choice outlasts a visit. */
const MAX_AGE = 31_536_000;

/** The `document.cookie` assignment of a choice, on `hostname`: shared on biblioviva.org, the host's own elsewhere. */
export function languageCookie(code: string, hostname: string, https: boolean): string {
	const shared = hostname === SITE_DOMAIN || hostname.endsWith(`.${SITE_DOMAIN}`);
	return [
		`${LANG_COOKIE}=${encodeURIComponent(code)}`,
		"path=/",
		`max-age=${String(MAX_AGE)}`,
		"samesite=lax",
		...(shared ? [`domain=${SITE_DOMAIN}`] : []),
		...(https ? ["secure"] : []),
	].join("; ");
}

/**
 * The first language of an `Accept-Language` header that is `available`, by weight then order; a
 * region (`en-GB`) matches its language (`en`) and the other way round. `null` when none is.
 */
export function browserLanguage(
	header: string | null,
	available: readonly string[],
): string | null {
	if (!header) {
		return null;
	}
	const wanted = header
		.split(",")
		.map((part, i) => {
			const [tag = "", ...params] = part.trim().split(";");
			const q = params.map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)?.[1]).find(Boolean);
			return { tag: tag.trim().toLowerCase(), q: q === undefined ? 1 : Number(q), i };
		})
		.filter((w) => w.tag !== "" && w.tag !== "*" && w.q > 0)
		.sort((a, b) => b.q - a.q || a.i - b.i);
	const base = (code: string): string => code.toLowerCase().split("-")[0] ?? "";
	for (const { tag } of wanted) {
		const exact = available.find((code) => code.toLowerCase() === tag);
		const near = exact ?? available.find((code) => base(code) === base(tag));
		if (near) {
			return near;
		}
	}
	return null;
}
