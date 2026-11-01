// SPDX-License-Identifier: GPL-3.0-or-later
// The fixed words of the shipped cards and slips (9.41: "Docente", "Titolo", "Da restituire entro
// il"…) in the installation's language: `printing.words.*` of the dictionary, handed to the
// templates as `words.*`, so a card or a slip printed in English has no Italian word, and a school
// that edits a copy of a template can still write its own words. The installation's words come
// from `print-word-source.ts` (it needs the app's i18n, which the command-line scripts do not load).
import it from "#lib/i18n/it/printing.json" with { type: "json" };

/** The words of one print job, as the templates read them (`{{words.due_by}}`). */
export type PrintWords = Readonly<Record<(typeof WORD_KEYS)[number], string>>;

/** The dictionary key of each word, and its name in the templates. */
const WORDS = {
	teacher: "teacher",
	title: "title",
	code: "code",
	due_by: "dueBy",
	due: "due",
	name: "name",
	days_overdue: "daysOverdue",
	loan_on: "loanOn",
	overdues_on: "overduesOn",
	to_return: "toReturn",
	enjoy: "enjoy",
} as const;

export const WORD_KEYS = Object.keys(WORDS) as (keyof typeof WORDS)[];

/** The template fields of the words (`words.teacher`, …), for the engine's allowlists. */
export const WORD_FIELDS = WORD_KEYS.map((k) => `words.${k}`);

/** A translation of `printing.words.<key>` with its parameters. */
export type WordSource = (key: string, params: Record<string, string>) => string;

/** The words of the built-in Italian dictionary: what a template gets when none is handed in. */
export const ITALIAN_WORDS: WordSource = (key, params) =>
	Object.entries(params).reduce(
		(text, [name, value]) => text.replaceAll(`{{${name}}}`, value),
		(it.words as Record<string, string>)[key] ?? key,
	);

/** The words of one job; `date` fills the ones that name the day of the print. */
export function printWords(source: WordSource = ITALIAN_WORDS, date = ""): PrintWords {
	return Object.fromEntries(WORD_KEYS.map((k) => [k, source(WORDS[k], { date })])) as PrintWords;
}
