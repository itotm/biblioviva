// SPDX-License-Identifier: GPL-3.0-or-later
// The dates of an import file (PLAN.md §3.22): the formats of spreadsheets and databases read as
// ISO dates (today, the default of a date left out, is `todayIn` of `#lib/shared/dates.ts`).

/** `2024-03-15`, `15/03/2024`, `15-03-2024`, `2024-03-15 10:00:00` → `2024-03-15`; null when unreadable. */
export function normalizeDate(raw: string): string | null {
	const s = raw.trim();
	let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(s);
	if (m) {
		return validDate(m[1] ?? "", m[2] ?? "", m[3] ?? "");
	}
	m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
	if (m) {
		return validDate(m[3] ?? "", (m[2] ?? "").padStart(2, "0"), (m[1] ?? "").padStart(2, "0"));
	}
	return null;
}

function validDate(y: string, mo: string, d: string): string | null {
	const iso = `${y}-${mo}-${d}`;
	const date = new Date(`${iso}T12:00:00Z`);
	return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}
