// SPDX-License-Identifier: GPL-3.0-or-later
// The author of a record is stored as "Surname, Name" (PLAN.md §4.1), the form the Z39.50 servers
// send; the web providers and the demo data write names in the natural order and pass here.

/** Particles written with a capital that belong to the surname ("Dos Passos", "Von Arnim"). */
const SURNAME_PARTICLES = new Set([
	"De",
	"Del",
	"Della",
	"Di",
	"Da",
	"Dos",
	"Du",
	"La",
	"Le",
	"Van",
	"Von",
	"Mac",
]);
/** Particles in lower case that follow the name in the catalogue ("Saint-Exupéry, Antoine de"). */
const NAME_PARTICLES = new Set([
	"de",
	"del",
	"della",
	"di",
	"da",
	"du",
	"von",
	"van",
	"der",
	"den",
]);

/**
 * "Antoine de Saint-Exupéry" → "Saint-Exupéry, Antoine de"; a name already inverted, or a single
 * word ("Omero"), is kept; of "A and B" the first author is kept; a leading "Sir" is dropped.
 */
export function invertAuthorName(natural: string): string {
	const first = natural.split(/\s+(?:and|&)\s+/)[0] ?? "";
	const s = first.replace(/\s+/g, " ").trim();
	if (s.includes(",") || !s.includes(" ")) {
		return s;
	}
	const parts = s.split(" ");
	if (parts[0] === "Sir" && parts.length > 2) {
		parts.shift();
	}
	let i = parts.length - 1;
	const surname = [parts[i] ?? ""];
	while (i > 1 && SURNAME_PARTICLES.has(parts[i - 1] ?? "")) {
		i--;
		surname.unshift(parts[i] ?? "");
	}
	const after: string[] = [];
	while (i > 1 && NAME_PARTICLES.has(parts[i - 1] ?? "")) {
		i--;
		after.unshift(parts[i] ?? "");
	}
	return `${surname.join(" ")}, ${[...parts.slice(0, i), ...after].join(" ")}`;
}
