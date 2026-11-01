// SPDX-License-Identifier: GPL-3.0-or-later
// Blocks of the library and barcodes pages of the Configurazione area (step 11.4): the item types
// with their replacements, and the start of the card counter. Permission `admin`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { draftCode } from "#lib/shared/input-schemas.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { refusal, refusing } from "#lib/server/http/errors.js";
import { changing } from "#lib/server/http/config-changes.js";
import { serverContext } from "#lib/server/context.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { configRefused, failureOf, failureWith } from "#lib/server/services/config-commit.js";
import {
	barcodePreview,
	CodesNotReadyError,
	itemTypeUsage,
	planItemTypes,
	saveCounterStart,
	saveItemTypes,
	symbologyOverrides,
} from "#lib/server/services/library-codes.js";
import { capacity } from "#lib/shared/barcodes/pattern.js";
import { codeTable } from "#lib/server/barcodes/table.js";

const replacements = v.pipe(
	v.record(draftCode, draftCode),
	v.check((r) => Object.keys(r).length <= 500, "too many replacements"),
);
const itemTypesDraft = v.pipe(
	v.array(
		v.object({
			code: draftCode,
			label: v.pipe(v.string(), v.maxLength(200)),
			notForLoan: v.boolean(),
		}),
	),
	v.maxLength(200),
);
const counterStart = v.union([
	v.literal("afterLegacyMax"),
	v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999_999_999)),
]);

/** Item types and sections with how many copies and students use each one. */
export const getLibraryCodes = query(() => {
	requireUser("admin");
	const config = getConfig();
	const db = getDb();
	return {
		itemTypes: config.library.itemTypes,
		itemTypeUsage: itemTypeUsage(db),
		overrides: Object.keys(config.circulation.itemTypeOverrides),
	};
});

export const planItemTypesChange = command(
	v.object({ draft: itemTypesDraft, replacements }),
	({ draft, replacements: moves }) => {
		requireUser("admin");
		return planItemTypes(serverContext(), draft, moves);
	},
);

export const saveItemTypesChange = command(
	v.object({ draft: itemTypesDraft, replacements }),
	({ draft, replacements: moves }) => {
		const user = requireUser("admin");
		return refusing(() => {
			const { change, copies } = saveItemTypes(serverContext(), draft, moves, user);
			void getLibraryCodes().refresh();
			return { ok: true as const, change: change.id, moved: copies };
		}, [
			// the plan's errors are the answer's: the block reads them in one place
			refusal(CodesNotReadyError, (e) => failureWith({ plan: e.plan }, e.plan.issues)),
			refusal(configRefused(), (e) => failureOf(e, { plan: null })),
		]);
	},
);

/** The card counter setting and the templates that force their own barcode type. */
export const getBarcodeSettings = query(() => {
	requireUser("admin");
	const config = getConfig();
	return {
		counterStart: config.barcodes.patron.counterStart,
		/** The largest counter the card format holds (the highest start allowed). */
		cardCapacity: capacity(codeTable(config).card.current),
		overrides: symbologyOverrides(config, env().CONFIG_DIR),
	};
});

/** The next card number and copy barcode with a counter start (nothing is used up). */
export const previewBarcodeCounters = command(
	v.object({ counterStart }),
	({ counterStart: start }) => {
		requireUser("admin");
		const config = getConfig();
		if (typeof start === "number" && start > capacity(codeTable(config).card.current)) {
			return null;
		}
		return barcodePreview(getDb(), config, start);
	},
);

export const saveBarcodeCounter = command(v.object({ counterStart }), ({ counterStart: start }) => {
	const user = requireUser("admin");
	return changing(() => {
		const change = saveCounterStart(getDb(), env().CONFIG_DIR, start, user);
		void getBarcodeSettings().refresh();
		return { ok: true as const, change: change.id };
	});
});
