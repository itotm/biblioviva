// SPDX-License-Identifier: GPL-3.0-or-later
// Words used by SVAR DataGrid and its core widgets, per app locale (PLAN.md §3.16).
import { en as gridEn } from "@svar-ui/grid-locales";
import { en as coreEn, it as coreIt } from "@svar-ui/core-locales";

export type GridWords = Record<string, unknown> & { core: Record<string, string> };

const gridIt = {
	"Add before": "Aggiungi prima",
	"Add after": "Aggiungi dopo",
	Copy: "Copia",
	Cut: "Taglia",
	Paste: "Incolla",
	Delete: "Elimina",
	"New row": "Nuova riga",
	"Move up": "Sposta su",
	"Move down": "Sposta giù",
	Undo: "Annulla",
	Redo: "Ripeti",
	selected: "selezionati",
};

const english: GridWords = { ...coreEn, ...gridEn };
const words: Record<string, GridWords> = {
	it: { ...coreIt, grid: gridIt },
	en: english,
};

/** The grid words of the locale; a language without its own set falls back to English. */
export function gridWords(locale: string): GridWords {
	return words[locale] ?? english;
}
