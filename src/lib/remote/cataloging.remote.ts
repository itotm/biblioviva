// SPDX-License-Identifier: GPL-3.0-or-later
// "Nuovo libro" fast-add (step 3.6): duplicate check, parallel metadata lookup and the one-shot
// save of a record with its first copies.
import { form, query } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { formIssues } from "#lib/server/http/errors.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { lookupMetadata as lookupService } from "#lib/server/metadata/index.js";
import {
	catalogRules,
	type CatalogRules,
	CatalogValidationError,
	findBiblioByIsbn,
} from "#lib/server/services/catalog.js";
import { getBiblio } from "#lib/server/services/catalog-search.js";
import { fastAddBiblio } from "#lib/server/services/fast-add.js";
import { fastAddSchema } from "#lib/shared/catalog-schema.js";
import { normalizeIsbn } from "#lib/shared/isbn.js";

const rules = (): CatalogRules => catalogRules(getConfig());

const isbnSchema = v.pipe(v.string(), v.trim(), v.minLength(10), v.maxLength(20));

/** Is this ISBN already in the catalogue? Returns the record to offer "Aggiungi copia". */
export const checkIsbn = query(isbnSchema, (raw) => {
	requireUser("catalog");
	const isbn = normalizeIsbn(raw);
	if (!isbn) {
		return { isbn: null, existing: null };
	}
	const found = findBiblioByIsbn(getDb(), isbn);
	if (!found) {
		return { isbn, existing: null };
	}
	const detail = getBiblio(getDb(), found.id, rules());
	return {
		isbn,
		existing: {
			id: detail.id,
			title: detail.title,
			author: detail.author,
			publisher: detail.publisher,
			publicationYear: detail.publicationYear,
			kind: detail.kind,
			copies: detail.items.length,
		},
	};
});

const lookupSchema = v.variant("kind", [
	v.object({ kind: v.literal("isbn"), isbn: isbnSchema }),
	v.object({
		kind: v.literal("search"),
		title: v.optional(v.pipe(v.string(), v.maxLength(200)), ""),
		author: v.optional(v.pipe(v.string(), v.maxLength(200)), ""),
		words: v.optional(v.pipe(v.string(), v.maxLength(200)), ""),
	}),
]);

/** Every enabled provider in parallel; candidates plus the outcome of each provider. */
export const lookupMetadata = query(lookupSchema, async (input) => {
	requireUser("catalog");
	const config = getConfig();
	const q =
		input.kind === "isbn"
			? { kind: "isbn" as const, isbn: normalizeIsbn(input.isbn) ?? input.isbn }
			: {
					kind: "search" as const,
					title: input.title || undefined,
					author: input.author || undefined,
					words: input.words || undefined,
				};
	if (q.kind === "search" && !q.title && !q.author && !q.words) {
		return { candidates: [], providers: [] };
	}
	const result = await lookupService(getDb(), q, { config });
	return {
		candidates: result.candidates,
		providers: result.providers.map((p) => ({
			provider: p.provider,
			name: p.name,
			hits: p.hits,
			count: p.candidates.length,
			cached: p.cached,
			elapsedMs: p.elapsedMs,
			error: p.error?.code ?? null,
		})),
	};
});

/** Saves the record and its copies; returns what the confirmation screen shows. */
export const fastAdd = form(fastAddSchema, async (input, issue) => {
	const user = requireUser("catalog");
	try {
		const result = fastAddBiblio(getDb(), input, user, rules());
		// the cover is chosen next to the form and stored by the page after the save (`saveCoverData`)
		return { ...result, title: input.title, isbn: input.isbn };
	} catch (e) {
		if (e instanceof CatalogValidationError) {
			invalid(
				...(await formIssues("catalog", e.issues, issue, (field) =>
					field in fastAddSchema.entries
						? field
						: field === "value"
							? "itemValue"
							: field === "inventoryNumber"
								? "copies"
								: "title",
				)),
			);
		}
		throw e;
	}
});
