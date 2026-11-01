// SPDX-License-Identifier: GPL-3.0-or-later
// The formats of copy barcodes and card numbers in the Configurazione area (step 12.2): the
// current ones with their plan, a draft planned, the draft saved. Permission `admin`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { refusal, refusing } from "#lib/server/http/errors.js";
import { serverContext } from "#lib/server/context.js";
import { getDb } from "#lib/server/db/index.js";
import { configRefused, failureOf, failureWith } from "#lib/server/services/config-commit.js";
import {
	BarcodeFormatsNotReadyError,
	currentBarcodeDraft,
	planBarcodeFormats,
	saveBarcodeFormats,
} from "#lib/server/services/barcode-formats.js";
import { libraryYear } from "#lib/server/services/calendar.js";
import { CHECK_ALGORITHMS } from "#lib/shared/barcodes/check.js";
import { getBarcodeSettings } from "./library-codes.remote.js";

const formatDef = v.object({
	pattern: v.pipe(v.string(), v.maxLength(40)),
	check: v.picklist([...CHECK_ALGORITHMS, "none"]),
});
const kindDraft = v.object({
	format: formatDef,
	retired: v.pipe(v.array(formatDef), v.maxLength(20)),
	legacy: v.pipe(v.array(formatDef), v.maxLength(20)),
});
const barcodeDraft = v.object({
	item: kindDraft,
	patron: kindDraft,
	libraryCode: v.pipe(v.string(), v.maxLength(8)),
	plainMaxLength: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(20)),
});

/** The formats of the configuration with their plan (usage, examples, the rule's verdict). */
export const getBarcodeFormats = query(() => {
	requireUser("admin");
	const config = getConfig();
	const draft = currentBarcodeDraft(config);
	return { draft, plan: planBarcodeFormats(getDb(), config, draft, libraryYear(config)) };
});

export const planBarcodeFormatsChange = command(v.object({ draft: barcodeDraft }), ({ draft }) => {
	requireUser("admin");
	const config = getConfig();
	return planBarcodeFormats(getDb(), config, draft, libraryYear(config));
});

export const saveBarcodeFormatsChange = command(v.object({ draft: barcodeDraft }), ({ draft }) => {
	const user = requireUser("admin");
	const ctx = serverContext();
	return refusing(() => {
		const change = saveBarcodeFormats(ctx, draft, libraryYear(ctx.config), user);
		void getBarcodeFormats().refresh();
		void getBarcodeSettings().refresh();
		return { ok: true as const, change: change.id };
	}, [
		// the plan's problems have their own shape: the block shows them from the plan
		refusal(BarcodeFormatsNotReadyError, (e) => failureWith({ plan: e.plan })),
		refusal(configRefused(), (e) => failureOf(e, { plan: null })),
	]);
});
