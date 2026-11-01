// SPDX-License-Identifier: GPL-3.0-or-later
// Series and number in the series (step 9.14, Q84): how a provider's series statement splits into
// the two fields and how the pair is shown.

export interface SeriesParts {
	series: string;
	number: string | null;
}

// "Harry Potter ; 3", "Harry Potter #3", "Harry Potter (3)", "Harry Potter, 3",
// "Harry Potter -- 3", "Harry Potter, book 3", "Harry Potter vol. 3"
const TRAILING_NUMBER =
	/^(.*?)\s*(?:;|,|#|--|\()\s*(?:(?:book|vol(?:ume)?|v|n|no|nr|libro)\.?\s*)?([0-9]+(?:\.[0-9]+)?|[IVXLC]+)\)?\s*$/i;

/** Splits a series statement into the series and its number; null when nothing is left. */
export function parseSeries(statement: string | null | undefined): SeriesParts | null {
	const text = (statement ?? "").replace(/\s+/g, " ").trim();
	if (!text) {
		return null;
	}
	const m = TRAILING_NUMBER.exec(text);
	if (m?.[1]?.trim() && m[2]) {
		return { series: m[1].trim().replace(/[\s,;:.-]+$/, ""), number: m[2] };
	}
	return { series: text.replace(/[\s,;:.-]+$/, ""), number: null };
}

/** "Harry Potter · 3", or the series alone. */
export function formatSeries(series: string | null, number: string | null): string {
	if (!series) {
		return "";
	}
	return number ? `${series} · ${number}` : series;
}
