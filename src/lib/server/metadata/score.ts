// SPDX-License-Identifier: GPL-3.0-or-later
// Completeness of a candidate record (step 9.14, Q85): one ISBN can have a record per reprint on
// SBN, more or less complete (7 for 9788884510495, one without the year, one with the publisher
// inside the physical description). The candidates are ordered by this score, ties to the most
// recent year, and an ISBN lookup opens the form with the first one.
import type { BiblioDraft } from "./types.js";

export interface ScoreOptions {
	/** `catalog.specialAuthors` and `catalog.unknownPublisher`: placeholders, not data. */
	specialAuthors: string[];
	unknownPublisher: string;
}

const filled = (v: string | null | undefined): boolean => Boolean(v?.trim());

/** Points for the fields the form uses; a placeholder or a malformed value earns less. */
export function completeness(d: BiblioDraft, o: ScoreOptions): number {
	let score = 0;
	if (filled(d.title)) {
		score += 4;
	}
	if (filled(d.author)) {
		score += o.specialAuthors.includes(d.author) ? 1 : 3;
	}
	if (filled(d.publisher) && d.publisher !== o.unknownPublisher) {
		score += 3;
	}
	if (filled(d.publicationPlace)) {
		// "Nuova ed" in the place is a misplaced edition statement
		score += /\bed\b\.?$/i.test(d.publicationPlace ?? "") ? 0 : 1;
	}
	if (d.publicationYear !== null) {
		score += 3;
	}
	if (filled(d.physicalDescription)) {
		// "120 p. : ill. ; 24 cm" earns the points; a whole description with publisher and place
		// squeezed into it ("Milano : Salani, 2023. - 652 p; 21 cm") only half
		const pd = d.physicalDescription ?? "";
		score += /\d+\s*p\b/.test(pd) && pd.length <= 60 ? 2 : 1;
	}
	if (filled(d.responsibility)) {
		score += 1;
	}
	if (filled(d.subtitle)) {
		score += 1;
	}
	if (d.isbn) {
		score += 1;
	}
	if (d.dewey) {
		score += 2;
	}
	if (d.subjects.length > 0) {
		score += 1;
	}
	if (filled(d.series)) {
		score += 1;
	}
	if (filled(d.originalTitle)) {
		score += 1;
	}
	return score;
}

/** Most complete first; equal scores: the most recent year first, then the provider order. */
export function byCompleteness(candidates: readonly BiblioDraft[], o: ScoreOptions): BiblioDraft[] {
	return candidates
		.map((d, i) => ({ d, i, score: completeness(d, o) }))
		.sort(
			(a, b) =>
				b.score - a.score ||
				(b.d.publicationYear ?? 0) - (a.d.publicationYear ?? 0) ||
				a.i - b.i,
		)
		.map((x) => x.d);
}
