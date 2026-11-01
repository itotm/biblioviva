// SPDX-License-Identifier: GPL-3.0-or-later
// Label printing (step 3.8): what the print dialog needs (kinds, templates, stocks, units per
// page, pending counts) and "Segna come stampate" for a set of copies. Permission `catalog`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { catalogRules } from "#lib/server/services/catalog.js";
import { getBiblio } from "#lib/server/services/catalog-search.js";
import {
	markItemLabelsPrinted as markItemLabelsPrintedService,
	pendingLabelCounts,
	pendingLabelItemIds,
	unclassifiedCopyCount,
} from "#lib/server/services/label-items.js";
import { LABEL_KINDS } from "#lib/server/services/label-templates.js";
import { labelPrintOptions } from "#lib/server/services/labels.js";

export type { LabelKindOption } from "#lib/server/services/labels.js";

import { dbId as id, dbIds } from "#lib/shared/input-schemas.js";

/** Kinds, their configured template and stock, the stocks list and the pending counts. */
export const getLabelOptions = query(() => {
	requireUser("catalog");
	const config = getConfig();
	return {
		defaultKind: config.labels.default,
		kinds: labelPrintOptions(config, env().CONFIG_DIR),
		stocks: config.labels.stocks.map((s) => ({ id: s.id, name: s.name })),
		pending: pendingLabelCounts(getDb()),
		/** Copies printed without their spine band until their record is classified (step 9.21). */
		unclassified: unclassifiedCopyCount(getDb()),
	};
});

/** "Segna come stampate" for copies chosen outside a print list (record page, dialog). */
export const markItemLabelsPrinted = command(
	v.object({ kind: v.picklist(LABEL_KINDS), ids: dbIds(5000) }),
	(input) => {
		const user = requireUser("catalog");
		const marked = markItemLabelsPrintedService(getDb(), input.kind, input.ids, user);
		void getLabelOptions().refresh();
		return { ok: true as const, marked };
	},
);

/** The copies of the pending sheet of a kind, for "Segna come stampate" in the dashboard's dialog. */
export const getPendingLabelItemIds = query(v.picklist(LABEL_KINDS), (kind) => {
	requireUser("catalog");
	return pendingLabelItemIds(getDb(), kind);
});

/** The copies of a record (ids and barcodes) for the print dialog of the record page. */
export const getItemIdsOfBiblio = query(id, (biblioId) => {
	requireUser("catalog");
	const record = getBiblio(getDb(), biblioId, catalogRules(getConfig()));
	return record.items.map((i) => ({ id: i.id, barcode: i.barcode }));
});
