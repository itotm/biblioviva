// SPDX-License-Identifier: GPL-3.0-or-later
// The small help icons beside the trickier parts of a page (`HelpLink`, step 9.5b): a module of its
// own, loaded by the pages that show one.
import { type HelpTarget, section } from "./help-links.js";

/** The steps of the import wizard (`import-wizard.svelte.ts`). */
export type ImportHelpStep = "upload" | "mapping" | "preview" | "done";
/** The imports that run in the wizard. */
export type ImportHelpKind = "catalog" | "students" | "teachers" | "loans";

/**
 * The small `HelpLink` icons beside the trickier parts of a page (step 9.5b): each spot by its key,
 * the page and the section of the documentation it opens. A renamed chapter is fixed here, and
 * `help-links.test.ts` checks every spot against the Markdown of `docs/<lang>/`.
 */
export const HELP_SPOTS = {
	// Nuovo libro: one spot at the heading of each stage
	fastAddCode: section("manual/new-book/", "passo-codice", "code-step"),
	fastAddSearch: section(
		"manual/new-book/",
		"ricerca-per-titolo-e-autore",
		"search-by-title-and-author",
	),
	fastAddDuplicate: section(
		"manual/new-book/",
		"libro-già-in-catalogo",
		"book-already-in-the-catalogue",
	),
	fastAddLookup: section("manual/new-book/", "passo-ricerca", "lookup-step"),
	fastAddForm: section("manual/new-book/", "passo-scheda-e-copie", "record-and-copies-step"),
	fastAddDone: section("manual/new-book/", "scheda-salvata", "record-saved"),
	// the camera that photographs a cover (Nuovo libro and the record)
	coverCapture: section(
		"guide/add-a-cover/",
		"fotografare-o-caricare-la-copertina",
		"photograph-or-upload-the-cover",
	),
	// the four steps of each import of the wizard (the guide of the import)
	"import.catalog.upload": section(
		"admin/guides/import-the-catalogue/",
		"preparare-il-file",
		"prepare-the-file",
	),
	"import.catalog.mapping": section(
		"admin/guides/import-the-catalogue/",
		"caricare-il-file",
		"upload-the-file",
	),
	"import.catalog.preview": section(
		"admin/guides/import-the-catalogue/",
		"controllare-il-file",
		"check-the-file",
	),
	"import.catalog.done": section("admin/guides/import-the-catalogue/", "importare", "import"),
	"import.students.upload": section(
		"admin/guides/import-students/",
		"preparare-il-file",
		"prepare-the-file",
	),
	"import.students.mapping": section(
		"admin/guides/import-students/",
		"scegliere-che-cosa-fare",
		"choose-what-to-do",
	),
	"import.students.preview": section(
		"admin/guides/import-students/",
		"controllare-il-file",
		"check-the-file",
	),
	"import.students.done": section("admin/guides/import-students/", "importare", "import"),
	"import.teachers.upload": section(
		"admin/guides/import-teachers/",
		"preparare-il-file",
		"prepare-the-file",
	),
	"import.teachers.mapping": section(
		"admin/guides/import-teachers/",
		"caricare-e-controllare",
		"upload-and-check",
	),
	"import.teachers.preview": section(
		"admin/guides/import-teachers/",
		"caricare-e-controllare",
		"upload-and-check",
	),
	"import.teachers.done": section("admin/guides/import-teachers/", "importare", "import"),
	"import.loans.upload": section(
		"admin/guides/import-loans/",
		"preparare-il-file",
		"prepare-the-file",
	),
	"import.loans.mapping": section(
		"admin/guides/import-loans/",
		"caricare-e-controllare",
		"upload-and-check",
	),
	"import.loans.preview": section(
		"admin/guides/import-loans/",
		"caricare-e-controllare",
		"upload-and-check",
	),
	"import.loans.done": section("admin/guides/import-loans/", "importare", "import"),
	// the page of the photos has no wizard: one spot for each of its two ways
	photosZip: section("admin/guides/import-photos/", "caricare-larchivio", "upload-the-archive"),
	photosFolder: section(
		"admin/guides/import-photos/",
		"usare-la-cartella-del-computer-facoltativo",
		"use-the-computer-folder-optional",
	),
	// the labels: printing them, and the sheets they are printed on
	labelsPrint: section("guide/print-book-labels/", "procedura", "procedure"),
	labelStocks: section(
		"admin/guides/add-a-label-stock/",
		"inserire-il-foglio",
		"enter-the-sheet",
	),
	// Backup: what a copy holds, a copy of some parts, the off-site copy, the restore
	backupContents: section(
		"admin/screens/backups/",
		"cosa-contiene-il-backup",
		"what-the-backup-contains",
	),
	backupParts: section(
		"admin/screens/backups/",
		"backup-o-esportazione-di-alcune-parti",
		"backup-or-export-of-some-parts",
	),
	backupOffsite: section("admin/screens/backups/", "copia-esterna", "off-site-copy"),
	backupRestore: section("admin/screens/backups/", "ripristino", "restore"),
	// the language packs: installing one from the list (Aspetto e lingua, the first-run wizard) and
	// the editor of the packs (the settings)
	languageInstall: section(
		"admin/guides/add-a-language/",
		"installare-una-lingua-dallelenco",
		"install-a-language-from-the-list",
	),
	languagePacks: section(
		"admin/guides/add-a-language/",
		"caricare-il-pacchetto",
		"upload-the-pack",
	),
} as const satisfies Record<string, HelpTarget>;

/** The key of a spot of `HELP_SPOTS`. */
export type HelpSpot = keyof typeof HELP_SPOTS;

/** The spot of a step of an import. */
export function importSpot(kind: ImportHelpKind, step: ImportHelpStep): HelpSpot {
	return `import.${kind}.${step}`;
}
