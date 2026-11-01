// SPDX-License-Identifier: GPL-3.0-or-later
// What the stages of the fast-add flow (step 3.6) hand to each other.

/** The record already in the catalogue with the scanned code. */
export interface ExistingRecord {
	id: number;
	title: string;
	author: string;
	publisher: string;
	publicationYear: number | null;
	copies: number;
}

/** The book just saved (or the copies just added), for the confirmation. */
export interface SavedBook {
	biblioId: number;
	title: string;
	barcodes: string[];
	itemIds: number[];
	copiesOnly: boolean;
	/** The cover chosen with the form: its picture and whether it was stored. */
	cover: {
		dataUrl: string;
		name: string | null;
		state: "saving" | "saved" | "failed";
	} | null;
}
