// SPDX-License-Identifier: GPL-3.0-or-later
// The language chosen with the switch of the header (IT · EN), kept in the cookie `bv_lang` that the
// home page, the documentation and the public demo share on biblioviva.org (ADR-047): the address of
// the documentation's root opens in that language from then on. Also the few lines that open the box
// of a problem reached by its anchor.
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

// A link to one problem of a "Possibili problemi" section (an anchor of a box) opens that box (9.46).
function openTarget() {
	const id = decodeURIComponent(location.hash.slice(1));
	const target = id ? document.getElementById(id) : null;
	if (target instanceof HTMLDetailsElement) {
		target.open = true;
	}
}
openTarget();
window.addEventListener("hashchange", openTarget);
