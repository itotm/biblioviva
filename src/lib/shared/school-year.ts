// SPDX-License-Identifier: GPL-3.0-or-later
// School year label (`2026/2027`) for a calendar date: only a label, never a trigger (PLAN.md §3.8).

/**
 * How the school year is named (`library.schoolYearLabel`, 9.41): `span` → `2026/2027`, `start` →
 * `2026`, the year it starts in (Brazil, Japan's 年度, Korea's 학년도). Stored always as a span.
 */
export const SCHOOL_YEAR_LABELS = ["span", "start"] as const;
export type SchoolYearLabel = (typeof SCHOOL_YEAR_LABELS)[number];

/** The name of a stored school year (`2026/2027`) as the installation shows it. */
export function schoolYearLabel(stored: string, mode: SchoolYearLabel = "span"): string {
	return mode === "start" && /^\d{4}\/\d{4}$/.test(stored) ? stored.slice(0, 4) : stored;
}

/** `date` as `YYYY-MM-DD`; `start` as `MM-DD` (library.schoolYearStart). */
export function schoolYearFor(date: string, start = "09-01"): string {
	const year = Number(date.slice(0, 4));
	const monthDay = date.slice(5, 10);
	const first = monthDay >= start ? year : year - 1;
	return `${first}/${first + 1}`;
}

/** First calendar day of the school year that contains `date`. */
export function schoolYearStartDate(date: string, start = "09-01"): string {
	return `${schoolYearFor(date, start).slice(0, 4)}-${start}`;
}
