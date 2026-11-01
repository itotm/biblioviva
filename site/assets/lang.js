// SPDX-License-Identifier: GPL-3.0-or-later
// The language chosen with the switch of the header (IT · EN), kept in the cookie `bv_lang` that the
// home page, the documentation and the public demo share on biblioviva.org (ADR-047): the address of
// the documentation's root opens in that language from then on.
document.querySelectorAll(".lang a[hreflang]").forEach((a) =>
	a.addEventListener("click", () => {
		const host = location.hostname;
		const domain =
			host === "biblioviva.org" || host.endsWith(".biblioviva.org")
				? "; domain=biblioviva.org"
				: "";
		const secure = location.protocol === "https:" ? "; secure" : "";
		document.cookie = `bv_lang=${a.hreflang}; path=/; max-age=31536000; samesite=lax${domain}${secure}`;
	}),
);
