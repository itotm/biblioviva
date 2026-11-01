// SPDX-License-Identifier: GPL-3.0-or-later
// Print lists (step 2.8): thin wrappers over `services/print-lists.ts`. Patron lists need the
// `patrons` permission, item lists (step 3.8) `catalog`.
import { schoolOf } from "#lib/server/school/structure.js";
import { command, query } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { orNotFound, refusing } from "#lib/server/http/errors.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { PRINT_LIST_KINDS } from "#lib/server/db/schema.js";
import { censusGroups, classOptions } from "#lib/server/services/patron-census.js";
import { catalogRules, classificationOptions } from "#lib/server/services/catalog.js";
import { recordGroupCardsPrinted } from "#lib/server/services/cards.js";
import { itemIdsOfBiblios } from "#lib/server/services/label-items.js";
import { LABEL_KINDS } from "#lib/server/services/label-templates.js";
import {
	addItemByBarcode as addItemByBarcodeService,
	addItemsByFilter as addItemsByFilterService,
	itemImportBatches,
	itemListRows,
} from "#lib/server/services/print-list-items.js";
import {
	addPatronByCard as addPatronByCardService,
	addPatronsByFilter as addPatronsByFilterService,
	patronImportBatches,
	patronListRows,
} from "#lib/server/services/print-list-patrons.js";
import {
	addEntries,
	clearPrintList,
	createPrintList,
	deletePrintList,
	getPrintList,
	isToPrint,
	listPrintLists,
	markPrinted,
	moveEntry,
	PrintListKindError,
	PrintListNameError,
	removeEntries,
	renamePrintList,
	reorderEntries,
	type PrintListKind,
} from "#lib/server/services/print-lists.js";
import type { Permission } from "#lib/shared/permissions.js";
import type { AuthUser } from "#lib/server/auth/types.js";
import type { PrintListSummary } from "#lib/server/services/print-lists.js";
import {
	configCode,
	dbId as id,
	dbIds,
	isoDay,
	levelCode,
	scannedCode,
} from "#lib/shared/input-schemas.js";

const ids = dbIds(5000);
const name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80));
const kind = v.picklist(PRINT_LIST_KINDS);

const PERMISSION: Record<PrintListKind, Permission> = { patrons: "patrons", items: "catalog" };

function requireListUser(listId: number): { user: AuthUser; list: PrintListSummary } {
	const user = requireUser();
	const list = orNotFound(() => getPrintList(getDb(), listId));
	requireUser(PERMISSION[list.kind]);
	return { user, list };
}

/** A list of the other kind answers 400: each page offers the adders of its own kind only. */
function ofItsKind<T>(add: () => T): T {
	try {
		return add();
	} catch (e) {
		if (e instanceof PrintListKindError) {
			error(400, e.expected === "patrons" ? "not a patron list" : "not an item list");
		}
		throw e;
	}
}

function visibleLists(user: AuthUser, k?: PrintListKind): PrintListSummary[] {
	return listPrintLists(getDb(), k).filter((l) => user.permissions.includes(PERMISSION[l.kind]));
}

/** Every list the account may see (kind filter optional). */
export const getPrintLists = query(v.optional(kind), (k) => {
	return { lists: visibleLists(requireUser(), k) };
});

/** The basket in the app bar: the lists still to print that the account may see. */
export const getPrintBasket = query(() => {
	return { lists: visibleLists(requireUser()).filter(isToPrint) };
});

/**
 * Stampe's classes (owner): every class with someone in it, printed like a list of patrons
 * (`/print/cards?group=<id>`), with the school's stages to show them stage by stage.
 */
export const getPrintClasses = query(() => {
	requireUser("patrons");
	const db = getDb();
	const school = schoolOf(getConfig());
	return {
		groups: censusGroups(db, school).filter((g) => g.groupId !== null && g.total > 0),
		stages: school.stages,
	};
});

export const getPrintListDetail = query(id, (listId) => {
	requireUser();
	const { list } = requireListUser(listId);
	const db = getDb();
	return {
		list,
		rows: list.kind === "patrons" ? patronListRows(db, listId) : [],
		itemRows: list.kind === "items" ? itemListRows(db, listId) : [],
		options: classOptions(db, schoolOf(getConfig())),
		batches: list.kind === "patrons" ? patronImportBatches(db) : itemImportBatches(db),
		classification:
			list.kind === "items" ? classificationOptions(catalogRules(getConfig())) : null,
	};
});

function refresh(listId: number): void {
	void getPrintListDetail(listId).refresh();
	void getPrintLists().refresh();
	void getPrintBasket().refresh();
}

export const createList = command(v.object({ kind, name }), (input) => {
	const user = requireUser(PERMISSION[input.kind]);
	const listId = createPrintList(getDb(), input.kind, input.name, user);
	void getPrintLists().refresh();
	void getPrintBasket().refresh();
	return { ok: true as const, id: listId };
});

export const renameList = command(v.object({ id, name }), (input) => {
	requireUser();
	const { user } = requireListUser(input.id);
	return refusing(
		() => {
			renamePrintList(getDb(), input.id, input.name, user);
			refresh(input.id);
			return { ok: true as const };
		},
		PrintListNameError,
		() => ({ ok: false as const, error: "name" as const }),
	);
});

export const deleteList = command(v.object({ id }), (input) => {
	requireUser();
	const { user } = requireListUser(input.id);
	deletePrintList(getDb(), input.id, user, new Date(), env().DATA_DIR);
	void getPrintLists().refresh();
	void getPrintBasket().refresh();
	return { ok: true as const };
});

/**
 * "Aggiungi alla lista": into an existing list, or into a new one named here. Entities already
 * in the list are reported as skipped, never duplicated. Item lists also accept `biblioIds`
 * (every copy of those records).
 */
export const addToList = command(
	v.object({
		listId: v.optional(id),
		newName: v.optional(name),
		kind: v.optional(kind, "patrons"),
		entityIds: v.optional(ids, []),
		biblioIds: v.optional(ids, []),
	}),
	(input) => {
		requireUser();
		let listId = input.listId;
		let user;
		let listKind: PrintListKind = input.kind;
		if (listId === undefined) {
			if (!input.newName) {
				return { ok: false as const, error: "name" as const };
			}
			user = requireUser(PERMISSION[input.kind]);
			listId = createPrintList(getDb(), input.kind, input.newName, user);
		} else {
			const found = requireListUser(listId);
			user = found.user;
			listKind = found.list.kind;
		}
		const entityIds =
			listKind === "items" && input.biblioIds.length > 0
				? [...new Set([...input.entityIds, ...itemIdsOfBiblios(getDb(), input.biblioIds)])]
				: input.entityIds;
		const result = addEntries(getDb(), listId, entityIds, user);
		refresh(listId);
		return { ok: true as const, listId, ...result };
	},
);

const quickFilterSchema = v.object({
	levelCode: v.optional(levelCode),
	groupId: v.optional(id),
	stage: v.optional(configCode),
	patronType: v.optional(v.picklist(["student", "teacher"])),
	withoutPrintedCard: v.optional(v.boolean()),
	withoutPhoto: v.optional(v.boolean()),
	importBatchId: v.optional(id),
	createdAfter: v.optional(isoDay),
});

/** Quick-filter adder of the patron list page. */
export const addPatronsByFilter = command(
	v.object({ listId: id, filter: quickFilterSchema }),
	(input) => {
		requireUser();
		const { user } = requireListUser(input.listId);
		const result = ofItsKind(() =>
			addPatronsByFilterService(getDb(), input.listId, input.filter, user),
		);
		refresh(input.listId);
		return { ok: true as const, ...result };
	},
);

/** Scan mode: one scanned card number adds its patron (duplicates reported, never added twice). */
export const addPatronByCard = command(
	// as typed or scanned: the service repairs and recognises it as the desk does
	v.object({ listId: id, cardNumber: scannedCode }),
	(input) => {
		requireUser();
		const { user } = requireListUser(input.listId);
		const added = ofItsKind(() =>
			addPatronByCardService(
				getDb(),
				input.listId,
				input.cardNumber,
				codeTable(getConfig()),
				user,
			),
		);
		if (added === null) {
			return { ok: false as const, error: "unknownCard" as const };
		}
		refresh(input.listId);
		return { ok: true as const, ...added };
	},
);

const itemFilterSchema = v.object({
	pendingLabels: v.optional(v.picklist(LABEL_KINDS)),
	acquiredFrom: v.optional(isoDay),
	acquiredTo: v.optional(isoDay),
	genreCode: v.optional(v.pipe(v.string(), v.maxLength(16))),
	classCode: v.optional(v.pipe(v.string(), v.maxLength(16))),
	itemType: v.optional(v.pipe(v.string(), v.maxLength(32))),
	importBatchId: v.optional(id),
});

/** Quick-filter adder of the item list page (a parent class includes its children). */
export const addItemsByFilter = command(
	v.object({ listId: id, filter: itemFilterSchema }),
	(input) => {
		requireUser();
		const { user } = requireListUser(input.listId);
		const scheme = catalogRules(getConfig()).scheme;
		const result = ofItsKind(() =>
			addItemsByFilterService(getDb(), scheme, input.listId, input.filter, user),
		);
		refresh(input.listId);
		return { ok: true as const, ...result };
	},
);

/** Scan mode: one scanned item barcode adds its copy (duplicates reported, never added twice). */
export const addItemByBarcode = command(v.object({ listId: id, barcode: scannedCode }), (input) => {
	requireUser();
	const { user } = requireListUser(input.listId);
	const added = ofItsKind(() =>
		addItemByBarcodeService(getDb(), input.listId, input.barcode, codeTable(getConfig()), user),
	);
	if (added === null) {
		return { ok: false as const, error: "unknownBarcode" as const };
	}
	refresh(input.listId);
	return { ok: true as const, ...added };
});

export const removeFromList = command(v.object({ listId: id, entityIds: ids }), (input) => {
	requireUser();
	const { user } = requireListUser(input.listId);
	const removed = removeEntries(getDb(), input.listId, input.entityIds, user);
	refresh(input.listId);
	return { ok: true as const, removed };
});

export const reorderList = command(v.object({ listId: id, orderedIds: ids }), (input) => {
	requireUser();
	const { user } = requireListUser(input.listId);
	const order = reorderEntries(getDb(), input.listId, input.orderedIds, user);
	refresh(input.listId);
	return { ok: true as const, order };
});

export const moveInList = command(
	v.object({ listId: id, entityId: id, direction: v.picklist(["up", "down"]) }),
	(input) => {
		requireUser();
		const { user } = requireListUser(input.listId);
		const order = moveEntry(getDb(), input.listId, input.entityId, input.direction, user);
		refresh(input.listId);
		return { ok: true as const, order };
	},
);

export const clearList = command(v.object({ listId: id }), (input) => {
	requireUser();
	const { user } = requireListUser(input.listId);
	const removed = clearPrintList(getDb(), input.listId, user);
	refresh(input.listId);
	return { ok: true as const, removed };
});

export const markListPrinted = command(
	v.object({
		listId: id,
		clear: v.optional(v.boolean(), false),
		/** Item lists: which labels were printed (pairs set both flags). */
		labelKind: v.optional(v.picklist(LABEL_KINDS)),
	}),
	(input) => {
		requireUser();
		const { user } = requireListUser(input.listId);
		const result = markPrinted(getDb(), input.listId, user, {
			clear: input.clear,
			labelKind: input.labelKind,
		});
		refresh(input.listId);
		return { ok: true as const, ...result };
	},
);

/** "Segna come stampate" for the cards of a class printed from Stampe → Classi (9.42). */
export const markClassCardsPrinted = command(v.object({ groupId: id }), (input) => {
	const user = requireUser("patrons");
	const marked = recordGroupCardsPrinted(getDb(), input.groupId, user);
	void getPrintClasses().refresh();
	return { ok: true as const, marked };
});
