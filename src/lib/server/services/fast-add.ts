// SPDX-License-Identifier: GPL-3.0-or-later
// "Nuovo libro" fast-add (PLAN.md step 3.6): the record and its first copies saved in one
// transaction (the audit rows are those of `createBiblio` and `addItems`), with the provenance of
// the metadata (provider and record id) on the biblio row.
import type { Db } from "#lib/server/db/client.js";
import type { FastAddInput } from "#lib/shared/catalog-schema.js";
import type { AuditActor } from "./audit.js";
import { CatalogValidationError, createBiblio, type CatalogRules } from "./catalog.js";
import { addItems } from "./catalog-items.js";

export interface FastAddResult {
	biblioId: number;
	itemIds: number[];
	barcodes: string[];
}

export function fastAddBiblio(
	db: Db,
	input: FastAddInput,
	actor: AuditActor,
	rules: CatalogRules,
	now = new Date(),
): FastAddResult {
	const copies = Number(input.copies);
	if (!Number.isInteger(copies) || copies < 1 || copies > 100) {
		throw new CatalogValidationError([{ field: "copies", code: "copiesOutOfRange" }]);
	}
	const {
		copies: _copies,
		itemCallText,
		itemReadingLevel,
		acquisitionDate,
		itemOrigin,
		itemValue,
		source,
		sourceId,
		...biblioInput
	} = input;
	return db.transaction((tx) => {
		const biblioId = createBiblio(tx, biblioInput, actor, rules, {
			source: source || "manual",
			sourceId: sourceId || null,
			now,
		});
		const { ids, barcodes } = addItems(
			tx,
			biblioId,
			{
				callText: itemCallText,
				readingLevel: itemReadingLevel,
				enumeration: "",
				acquisitionDate,
				notes: "",
				notForLoan: false,
				// the school inventory (9.64): the next numbers, the origin and value typed
				origin: itemOrigin,
				value: itemValue,
			},
			copies,
			actor,
			rules,
			now,
		);
		return { biblioId, itemIds: ids, barcodes };
	});
}
