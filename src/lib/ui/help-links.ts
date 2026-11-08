// SPDX-License-Identifier: GPL-3.0-or-later
// The help button of the top bar (steps 9.5b, 9.67): it opens, on the documentation site and in the
// installation's language (§3.23: one documentation, the current release's), the page that explains
// the screen in sight, at the section of that screen when it is part of a larger page. The one table
// of page → documentation: a renamed page or heading is fixed here, and `help-links.test.ts` checks
// every target against the Markdown of `docs/<lang>/`.
import type { RouteId } from "$app/types";
import type { AreaKey } from "#lib/shared/theme-palette.js";

export const DOCS_ORIGIN = "https://docs.biblioviva.org";

/** The languages the documentation is written in; any other reads the English one. */
export const DOCS_LANGUAGES = ["it", "en"] as const;
export type DocsLanguage = (typeof DOCS_LANGUAGES)[number];

/**
 * A page of the documentation: its path under `/<lang>/` (`manual/<screen>/` for the screens of
 * `docs/<lang>/manual/screens/`, `guide/<page>/` for the guides, `admin/screens/<screen>/` and
 * `admin/guides/<page>/` for Amministrazione) and, for a section of it, the heading's anchor in each
 * language (the anchors are made from the headings, so they differ between languages).
 */
export interface HelpTarget {
	page: string;
	anchor?: Readonly<Record<DocsLanguage, string>>;
}

/** The page of each area (`home`: the dashboard and the pages outside the areas). */
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

const section = (page: string, it: string, en: string): HelpTarget => ({
	page,
	anchor: { it, en },
});

/** One section of the settings (`/admin/config/<key>`): its heading in "A settings section". */
export const CONFIG_SECTION_ANCHORS: Readonly<
	Record<string, Readonly<Record<DocsLanguage, string>>>
> = {
	library: { it: "biblioteca-e-scuola", en: "library-and-school" },
	school: { it: "scuola", en: "school" },
	catalog: { it: "catalogo", en: "catalogue" },
	barcodes: { it: "codici-a-barre", en: "barcodes" },
	circulation: { it: "prestiti", en: "loans" },
	calendar: { it: "calendario", en: "calendar" },
	z3950: { it: "z3950-sbn", en: "z3950-sbn" },
	metadata: { it: "dati-dei-libri", en: "book-data" },
	performance: { it: "prestazioni", en: "performance" },
	classification: { it: "classificazione", en: "classification" },
	cards: { it: "tessere", en: "cards" },
	labels: { it: "etichette", en: "labels" },
	photos: { it: "foto-degli-utenti", en: "patron-photos" },
	covers: { it: "copertine", en: "covers" },
	privacy: { it: "privacy", en: "privacy" },
	backup: { it: "backup", en: "backup" },
	security: { it: "sicurezza-e-accessi", en: "security-and-access" },
	ui: { it: "interfaccia", en: "interface" },
};

const CONFIG_SECTIONS_PAGE = "admin/screens/configuration/";

/** Each page of the app (its route id) and what explains it; a function reads the page's parameters. */
export const SCREEN_HELP: Readonly<
	Partial<Record<RouteId, HelpTarget | ((params: Record<string, string>) => HelpTarget)>>
> = {
	"/(app)": { page: "manual/dashboard/" },
	"/(app)/about": { page: "manual/about/" },
	// Prestiti
	"/(app)/circulation/checkout": { page: "manual/checkout/" },
	"/(app)/circulation/checkin": { page: "manual/checkin/" },
	"/(app)/circulation/loans": { page: "manual/loans/" },
	"/(app)/circulation/overdues": { page: "manual/overdues/" },
	"/(app)/wishlist": { page: "manual/wishlist/" },
	"/(app)/calendar": { page: "manual/calendar/" },
	// Catalogo
	"/(app)/catalog": { page: "manual/catalog/" },
	"/(app)/catalog/[id]": { page: "manual/book-record/" },
	"/(app)/catalog/[id]/edit": section("manual/book-record/", "modifica-scheda", "edit-record"),
	"/(app)/cataloging/new": { page: "manual/new-book/" },
	"/(app)/catalog/new": section(
		"manual/new-book/",
		"scheda-compilata-a-mano",
		"record-filled-in-by-hand",
	),
	"/(app)/catalog/to-classify": { page: "manual/to-classify/" },
	"/(app)/catalog/to-classify/[id]": section(
		"manual/to-classify/",
		"classifica-il-libro",
		"classify-the-book",
	),
	"/(app)/inventory": { page: "manual/inventory/" },
	// Utenti
	"/(app)/patrons": { page: "manual/patrons/" },
	"/(app)/patrons/[id]": { page: "manual/patron-record/" },
	"/(app)/patrons/[id]/edit": section("manual/patron-record/", "modifica-utente", "edit-patron"),
	"/(app)/patrons/new": section("manual/patron-record/", "nuovo-utente", "new-patron"),
	"/(app)/census": { page: "manual/census/" },
	"/(app)/census/sheets/[id]": section("manual/census/", "pagina-dellimmagine", "picture-page"),
	// Stampe
	"/(app)/print-lists": { page: "manual/print-lists/" },
	"/(app)/print-lists/[id]": section("manual/print-lists/", "pagina-di-una-lista", "list-page"),
	// Segnalazioni
	"/(app)/notes": { page: "manual/notes/" },
	"/(app)/notes/archive": section("manual/notes/", "segnalazioni-archiviate", "archived-notes"),
	// Report
	"/(app)/reports": { page: "manual/reports/" },
	"/(app)/reports/[id]": section("manual/reports/", "pagina-di-un-report", "report-page"),
	// Amministrazione
	"/(app)/admin": { page: "admin/screens/admin/" },
	"/(app)/admin/appearance": { page: "admin/screens/appearance/" },
	"/(app)/admin/audit": { page: "admin/screens/audit/" },
	"/(app)/admin/backups": { page: "admin/screens/backups/" },
	"/(app)/admin/classes": { page: "admin/screens/classes/" },
	"/(app)/admin/users": { page: "admin/screens/users/" },
	"/(app)/admin/exports": { page: "admin/screens/exports/" },
	"/(app)/admin/rollover": { page: "admin/screens/rollover/" },
	"/(app)/admin/config": { page: CONFIG_SECTIONS_PAGE },
	"/(app)/admin/config/[section]": ({ section: key = "" }) => ({
		page: CONFIG_SECTIONS_PAGE,
		anchor: CONFIG_SECTION_ANCHORS[key] ?? {
			it: "una-sezione-delle-impostazioni",
			en: "a-settings-section",
		},
	}),
	"/(app)/admin/config/history": { page: "admin/screens/config-history/" },
	"/(app)/admin/config/classification": { page: "admin/guides/classification/" },
	"/(app)/admin/config/reports": { page: "admin/screens/reports-library/" },
	"/(app)/admin/config/reports/new": section(
		"admin/screens/reports-library/",
		"nuovo-report",
		"new-report",
	),
	"/(app)/admin/config/reports/[id]": section(
		"admin/screens/reports-library/",
		"editor-del-report",
		"report-editor",
	),
	"/(app)/admin/config/templates": { page: "admin/screens/templates/" },
	"/(app)/admin/config/templates/[kind]/[name]": section(
		"admin/screens/templates/",
		"editor-del-template",
		"template-editor",
	),
	"/(app)/admin/cards/templates": section(
		"admin/screens/templates/",
		"scheda-anteprime",
		"previews-tab",
	),
	"/(app)/admin/cards/calibration": { page: "admin/guides/calibrate-duplex/" },
	// the imports: the page of Importazioni only points to the guide of each one
	"/(app)/admin/imports": { page: "admin/screens/imports/" },
	"/(app)/admin/imports/catalog": { page: "admin/guides/import-the-catalogue/" },
	"/(app)/admin/imports/students": { page: "admin/guides/import-students/" },
	"/(app)/admin/imports/teachers": { page: "admin/guides/import-teachers/" },
	"/(app)/admin/imports/loans": { page: "admin/guides/import-loans/" },
	"/(app)/admin/imports/photos": { page: "admin/guides/import-photos/" },
};

/** The language of the documentation for `locale` (English for a language it is not written in). */
export function docsLanguage(locale: string): DocsLanguage {
	return DOCS_LANGUAGES.find((l) => l === locale.split("-")[0]) ?? "en";
}

/** The documentation in the language of `locale`. */
export function docsBase(locale: string): string {
	return `${DOCS_ORIGIN}/${docsLanguage(locale)}/`;
}

/** What explains a page: its own entry, else the page of its area. */
export function helpTarget(
	routeId: string | null,
	params: Record<string, string>,
	area: AreaKey | null,
): HelpTarget {
	const entry = routeId ? SCREEN_HELP[routeId as RouteId] : undefined;
	if (entry) {
		return typeof entry === "function" ? entry(params) : entry;
	}
	return { page: HELP_PAGES[area ?? "home"] };
}

/** The address of the help: `base` from `docsBase`, the anchor in the documentation's language. */
export function helpHref(base: string, target: HelpTarget): string {
	const lang = DOCS_LANGUAGES.find((l) => base.endsWith(`/${l}/`)) ?? "en";
	const anchor = target.anchor?.[lang];
	return `${base}${target.page}${anchor ? `#${anchor}` : ""}`;
}
