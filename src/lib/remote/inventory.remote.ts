// SPDX-License-Identifier: GPL-3.0-or-later
// Stocktaking campaigns (step 9.8): the campaign in progress with its progress by shelf, the scans,
// the copies still missing, the close with its summary and the reopen of a recent one. Permission
// `catalog`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { refusedWithCode, refusing } from "#lib/server/http/errors.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import {
	closedInventories,
	closeInventory,
	currentInventory,
	INVENTORY_NOTES_MAX,
	InventoryError,
	inventoryProgress,
	missingItems,
	openInventory,
	recordScan,
	reopenInventory,
	shelvesOf,
} from "#lib/server/services/inventory.js";

import { dbId as id, scannedCode } from "#lib/shared/input-schemas.js";

const MISSING_SHOWN = 50;

export const getInventory = query(() => {
	requireUser("catalog");
	const db = getDb();
	const locale = getConfig().ui.locale;
	const current = currentInventory(db);
	return {
		current,
		progress: current ? inventoryProgress(db, current.id, locale) : null,
		shelves: shelvesOf(db, locale),
		itemTypes: getConfig().library.itemTypes.map((t) => ({ code: t.code, label: t.label })),
		history: closedInventories(db).map((c) => ({
			...c,
			summary: c.summary ? { ...c.summary, lostItems: [] } : null,
		})),
	};
});

export const getMissingItems = query(
	v.object({
		inventoryId: id,
		shelf: v.nullable(v.pipe(v.string(), v.maxLength(40))),
		itemType: v.nullable(v.pipe(v.string(), v.maxLength(40))),
	}),
	({ inventoryId, shelf, itemType }) => {
		requireUser("catalog");
		const all = missingItems(getDb(), inventoryId, { shelf, itemType });
		return { total: all.length, items: all.slice(0, MISSING_SHOWN) };
	},
);

export const startInventory = command(
	v.object({
		name: v.pipe(v.string(), v.maxLength(120)),
		notes: v.optional(v.pipe(v.string(), v.maxLength(INVENTORY_NOTES_MAX))),
	}),
	(input) => {
		const user = requireUser("catalog");
		return refusing(
			() => {
				const campaign = openInventory(getDb(), input, user);
				void getInventory().refresh();
				return { ok: true as const, campaign };
			},
			InventoryError,
			refusedWithCode,
		);
	},
);

export const scanForInventory = command(
	v.object({
		inventoryId: id,
		code: scannedCode,
		shelf: v.nullable(v.pipe(v.string(), v.maxLength(40))),
	}),
	({ inventoryId, code, shelf }) => {
		const user = requireUser("catalog");
		return refusing(
			() => ({
				ok: true as const,
				outcome: recordScan(
					getDb(),
					inventoryId,
					code,
					shelf,
					codeTable(getConfig()),
					user,
				),
			}),
			InventoryError,
			refusedWithCode,
		);
	},
);

export const closeInventoryNow = command(v.object({ inventoryId: id }), ({ inventoryId }) => {
	const user = requireUser("catalog");
	return refusing(
		() => {
			const summary = closeInventory(getDb(), inventoryId, user);
			void getInventory().refresh();
			return { ok: true as const, summary: { ...summary, lostItems: [] } };
		},
		InventoryError,
		refusedWithCode,
	);
});

export const reopenInventoryNow = command(v.object({ inventoryId: id }), ({ inventoryId }) => {
	const user = requireUser("catalog");
	return refusing(
		() => {
			reopenInventory(getDb(), inventoryId, user);
			void getInventory().refresh();
			return { ok: true as const };
		},
		InventoryError,
		refusedWithCode,
	);
});
