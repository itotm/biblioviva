// SPDX-License-Identifier: GPL-3.0-or-later
// The fixed words of the shipped cards and slips in the installation's language (9.41), for the
// print routes and the previews; `print-words.ts` turns them into the words of one job.
import { serverTranslator } from "#lib/i18n/server.js";
import type { WordSource } from "./print-words.js";

export async function printWordSource(locale: string): Promise<WordSource> {
	const t = await serverTranslator(locale);
	return (key, params) => t(`printing.words.${key}`, params);
}
