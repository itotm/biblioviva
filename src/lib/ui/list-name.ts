// SPDX-License-Identifier: GPL-3.0-or-later
// The name a new print list takes when none is typed (owner): "Lista N del gg/mm/aaaa", N the
// first number after the lists there are that no list already uses. Shown as the placeholder of
// the name field, so the operator sees it before confirming.
import type { Format } from "./format.js";

/** `printing.lists.defaultName` with `{{n}}` and `{{date}}`. */
export type NameTemplate = (n: number, date: string) => string;

export function proposedListName(
	existing: readonly string[],
	template: NameTemplate,
	format: Pick<Format, "date">,
	now = new Date(),
): string {
	const date = format.date(now, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
	let n = existing.length + 1;
	while (taken.has(template(n, date).toLowerCase())) {
		n++;
	}
	return template(n, date);
}
