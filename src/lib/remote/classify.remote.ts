// SPDX-License-Identifier: GPL-3.0-or-later
// Books to classify (step 9.21, Q117): the records saved without classification, oldest first, and
// the flow that classifies them one after another. Permission `catalog`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { issueMessages, orNotFound, refusing } from "#lib/server/http/errors.js";
import { CatalogValidationError, catalogRules } from "#lib/server/services/catalog.js";
import { getBiblio } from "#lib/server/services/catalog-search.js";
import {
	classifiedCallNumber,
	classifyBiblio,
	listUnclassified,
	nextUnclassified,
} from "#lib/server/services/catalog-classify.js";
import { BIBLIO_KIND_VALUES } from "#lib/shared/catalog-schema.js";
import { suggestClassFromDewey } from "#lib/shared/classification.js";

import { dbId as id, levelCodeOrEmpty } from "#lib/shared/input-schemas.js";

/** The list of the tab "Da classificare". */
export const getUnclassified = query(() => {
	requireUser("catalog");
	return listUnclassified(getDb());
});

/** One record of the flow: what helps to classify it, and the record that follows it. */
export const getClassifyTarget = query(id, (biblioId) => {
	requireUser("catalog");
	const db = getDb();
	const rules = catalogRules(getConfig());
	const b = orNotFound(() => getBiblio(db, biblioId, rules));
	return {
		id: b.id,
		title: b.title,
		subtitle: b.subtitle,
		author: b.author,
		publisher: b.publisher,
		publicationYear: b.publicationYear,
		isbn: b.isbn,
		series: b.series,
		seriesNumber: b.seriesNumber,
		dewey: b.dewey,
		subjects: b.subjects,
		notes: b.notes,
		hasCover: b.hasCover,
		classified: b.kind !== null,
		copies: b.items.filter((i) => i.status !== "withdrawn").length,
		/** The class the Dewey number points to (§3.17), proposed first. */
		deweyClass: suggestClassFromDewey(rules.scheme, b.dewey),
		next: nextUnclassified(db, b.id),
	};
});

const classificationSchema = v.object({
	id,
	kind: v.picklist(BIBLIO_KIND_VALUES),
	genreCode: v.pipe(v.string(), v.maxLength(16)),
	classCode: v.pipe(v.string(), v.maxLength(16)),
	readingLevel: levelCodeOrEmpty,
});

/** The call number the copies will get with this classification (shown before saving). */
export const previewClassifiedCallNumber = query(classificationSchema, (input) => {
	requireUser("catalog");
	const { id: biblioId, ...classification } = input;
	return classifiedCallNumber(getDb(), biblioId, classification, catalogRules(getConfig()));
});

/** "Salva e avanti": classifies the record and names the next one still to classify. */
export const classifyRecord = command(classificationSchema, async (input) => {
	const user = requireUser("catalog");
	const db = getDb();
	const { id: biblioId, ...classification } = input;
	return refusing(
		() => {
			classifyBiblio(db, biblioId, classification, user, catalogRules(getConfig()));
			void getUnclassified().refresh();
			return { ok: true as const, next: nextUnclassified(db, biblioId) };
		},
		CatalogValidationError,
		// the same messages as the record form (`catalog.errors.<code>`)
		async (e) => ({
			ok: false as const,
			issues: (await issueMessages("catalog", e.issues)).map((i) => i.message),
		}),
	);
});
