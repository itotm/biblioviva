// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { orNotFound } from "#lib/server/http/errors.js";
import { catalogRules, classificationOptions } from "#lib/server/services/catalog.js";
import { getBiblio } from "#lib/server/services/catalog-search.js";
import type { BiblioFormInput } from "#lib/shared/catalog-schema.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "catalog");
	if (!/^\d+$/.test(params.id)) {
		error(404, "biblio not found");
	}
	const rules = catalogRules(getConfig());
	const b = orNotFound(() => getBiblio(getDb(), Number(params.id), rules));
	// a record still to classify opens with "Classifica dopo" (step 9.21)
	const kind: BiblioFormInput["kind"] = b.kind ?? "";
	// exactly one copy: its fields are edited on the same page (owner review)
	const only = b.items.length === 1 ? b.items[0] : undefined;
	return {
		id: b.id,
		options: classificationOptions(rules),
		title: b.title,
		item: only
			? {
					id: only.id,
					barcode: only.barcode,
					itemType: only.itemType,
					callNumber: only.callNumber ?? "",
					readingLevel: only.readingLevel ?? "",
					enumeration: only.enumeration ?? "",
					acquisitionDate: only.acquisitionDate ?? "",
					notes: only.notes ?? "",
					notForLoan: only.notForLoan,
				}
			: null,
		initial: {
			title: b.title,
			subtitle: b.subtitle ?? "",
			originalTitle: b.originalTitle ?? "",
			responsibility: b.responsibility ?? "",
			author: b.author,
			publisher: b.publisher,
			publicationPlace: b.publicationPlace ?? "",
			publicationYear: b.publicationYear === null ? "" : String(b.publicationYear),
			isbn: b.isbn ?? "",
			issn: b.issn ?? "",
			ean: b.ean ?? "",
			physicalDescription: b.physicalDescription ?? "",
			series: b.series ?? "",
			seriesNumber: b.seriesNumber ?? "",
			dewey: b.dewey ?? "",
			kind,
			genreCode: b.genreCode ?? "",
			classCode: b.classCode ?? "",
			readingLevel: b.readingLevel ?? "",
			subjects: b.subjects.join("\n"),
			notes: b.notes ?? "",
		},
	};
};
