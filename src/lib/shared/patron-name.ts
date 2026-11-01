// SPDX-License-Identifier: GPL-3.0-or-later
// A patron's name, written the same way everywhere: "Nome Cognome" where a person is spoken to or
// about (the desk, slips, reminders, the dashboard), "Cognome Nome" where people are listed and
// sorted (grids, exports, the patron page).

export interface PatronNameParts {
	firstName: string | null | undefined;
	lastName: string | null | undefined;
}

const join = (a: string | null | undefined, b: string | null | undefined): string =>
	`${a ?? ""} ${b ?? ""}`.trim();

/** "Mario Rossi": the name as said to or about someone. */
export function patronFullName(p: PatronNameParts): string {
	return join(p.firstName, p.lastName);
}

/** "Rossi Mario": the name as listed and sorted. */
export function patronSortName(p: PatronNameParts): string {
	return join(p.lastName, p.firstName);
}
