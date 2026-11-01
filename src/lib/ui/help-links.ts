// SPDX-License-Identifier: GPL-3.0-or-later
// The help icon of the top bar (step 9.5b): it opens the manual on the documentation site, in the
// installation's language (§3.23: one documentation, the current release's), at the page of the area
// the page belongs to. The one table of area → page of the documentation: a renamed page is fixed here.
import type { AreaKey } from "#lib/shared/theme-palette.js";

export const DOCS_ORIGIN = "https://docs.biblioviva.org";

/** The languages the documentation is written in; any other reads the English one. */
const DOCS_LANGUAGES = ["it", "en"] as const;

/** The page of each area, under `/<lang>/` (the screens of `docs/<lang>/manual/screens/`). */
export const HELP_PAGES: Readonly<Record<AreaKey | "home", string>> = {
	home: "manual/dashboard/",
	circulation: "manual/checkout/",
	catalog: "manual/catalog/",
	patrons: "manual/patrons/",
	printing: "manual/print-lists/",
	notes: "manual/notes/",
	reports: "manual/reports/",
	admin: "admin/",
};

/** The documentation in the language of `locale` (English for a language it is not written in). */
export function docsBase(locale: string): string {
	const lang = DOCS_LANGUAGES.find((l) => l === locale.split("-")[0]) ?? "en";
	return `${DOCS_ORIGIN}/${lang}/`;
}

/** The help page of an area (`null`: the dashboard and the pages outside the areas). */
export function helpHref(base: string, area: AreaKey | null): string {
	return `${base}${HELP_PAGES[area ?? "home"]}`;
}
