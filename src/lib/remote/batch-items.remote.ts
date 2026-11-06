// SPDX-License-Identifier: GPL-3.0-or-later
// Batch operations on copies (step 3.10): the copies of the records selected in the catalogue, or
// given one by one (the lists of Stampe only print, owner). Plan (writes nothing) → apply (one
// transaction). Reclassification of the selected records. Permission `catalog`.
import { command } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { refusing } from "#lib/server/http/errors.js";
import { getConfig } from "#lib/server/config/index.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { getDb } from "#lib/server/db/index.js";
import {
	applyBatch,
	applyReclassify,
	BatchOperationError,
	planBatch,
	planReclassify,
} from "#lib/server/services/batch-items.js";
import { catalogRules } from "#lib/server/services/catalog.js";
import { itemIdsOfBiblios } from "#lib/server/services/label-items.js";
import type { AuthUser } from "#lib/server/auth/types.js";
import { ITEM_STATUS_VALUES } from "#lib/shared/catalog-schema.js";
import { dbIds, isoDay, levelCode, levelCodeOrEmpty } from "#lib/shared/input-schemas.js";

const ids = dbIds(5000);

const sourceSchema = v.union([v.object({ itemIds: ids }), v.object({ biblioIds: ids })]);

const operationSchema = v.variant("kind", [
	v.object({
		kind: v.literal("status"),
		status: v.picklist(ITEM_STATUS_VALUES),
		reason: v.optional(v.pipe(v.string(), v.maxLength(200)), ""),
	}),
	v.object({ kind: v.literal("itemType"), itemType: v.pipe(v.string(), v.maxLength(32)) }),
	v.object({ kind: v.literal("notForLoan"), notForLoan: v.boolean() }),
	v.object({
		kind: v.literal("readingLevel"),
		readingLevel: v.nullable(levelCode),
	}),
	v.object({
		kind: v.literal("acquisitionDate"),
		acquisitionDate: isoDay,
	}),
]);

function itemIdsOf(db: DbOrTx, source: v.InferOutput<typeof sourceSchema>): number[] {
	return "itemIds" in source ? source.itemIds : itemIdsOfBiblios(db, source.biblioIds);
}

function guarded<T>(fn: () => T): T | { ok: false; error: BatchOperationError["code"] } {
	return refusing(fn, BatchOperationError, (e) => ({ ok: false as const, error: e.code }));
}

/** The validate phase: what changes and what stays, nothing written. */
export const planItemBatch = command(
	v.object({ source: sourceSchema, operation: operationSchema }),
	({ source, operation }) => {
		requireUser("catalog");
		const db = getDb();
		return guarded(() => ({
			ok: true as const,
			...planBatch(db, itemIdsOf(db, source), operation, catalogRules(getConfig())),
		}));
	},
);

export const applyItemBatch = command(
	v.object({ source: sourceSchema, operation: operationSchema }),
	({ source, operation }) => {
		const user: AuthUser = requireUser("catalog");
		const db = getDb();
		return guarded(() => {
			const result = applyBatch(
				db,
				itemIdsOf(db, source),
				operation,
				catalogRules(getConfig()),
				user,
			);
			return { ok: true as const, ...result };
		});
	},
);

const reclassifySchema = v.object({
	biblioIds: ids,
	kind: v.picklist(["fiction", "nonfiction"]),
	genreCode: v.optional(v.pipe(v.string(), v.maxLength(16)), ""),
	classCode: v.optional(v.pipe(v.string(), v.maxLength(16)), ""),
	readingLevel: v.optional(levelCodeOrEmpty, ""),
});

export const planRecordReclassify = command(reclassifySchema, ({ biblioIds, ...target }) => {
	requireUser("catalog");
	return guarded(() => ({
		ok: true as const,
		...planReclassify(getDb(), biblioIds, target, catalogRules(getConfig())),
	}));
});

export const applyRecordReclassify = command(reclassifySchema, ({ biblioIds, ...target }) => {
	const user = requireUser("catalog");
	return guarded(() => ({
		ok: true as const,
		...applyReclassify(getDb(), biblioIds, target, catalogRules(getConfig()), user),
	}));
});
