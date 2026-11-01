// SPDX-License-Identifier: GPL-3.0-or-later
// Printing in the Configurazione area (step 11.6): the card template of each patron type and the
// cut lines, the adhesive label stocks, the template folders (duplicate, rename, delete), the
// files of their `assets/` and the shipped card backgrounds (step 11.17). Permission `admin`.
import { command, form, query } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { megabytes } from "#lib/shared/bytes.js";
import { entryId, uploadedFile } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { failureOf, failureWith, type ConfigFailure } from "#lib/server/services/config-commit.js";
import { saveConfigKeys } from "#lib/server/services/config-sections.js";
import { saveStocks, stockEditorView, StockDraftError } from "#lib/server/services/label-stocks.js";
import { templatesOverview } from "#lib/server/services/print-preview.js";
import {
	addCardBackground,
	cardBackgrounds,
	deleteTemplate,
	deleteTemplateAsset,
	duplicateTemplate,
	MAX_ASSET_BYTES,
	renameTemplate,
	TEMPLATE_NAME,
	TemplateFolderError,
	templateFolders,
	uploadTemplateAsset,
} from "#lib/server/services/template-folders.js";
import { getConfigHistory, getConfigOverview } from "./config.remote.js";
import { BACKGROUND_NAME } from "#lib/shared/card-backgrounds.js";

const kind = v.picklist(["cards", "labels", "slips"]);
const templateName = v.pipe(v.string(), v.regex(TEMPLATE_NAME));
const mm = v.pipe(v.number(), v.minValue(0), v.maxValue(400));

/** A change that did not happen; `code`: the refusal of a template folder or of a label stock. */
type Failure = ConfigFailure<{ code: string | null; details: string[] }>;

/** A change that did not happen: the reasons the page shows. */
function failure(e: unknown): Failure {
	if (e instanceof TemplateFolderError || e instanceof StockDraftError) {
		return failureWith({ code: e.code, details: e.details });
	}
	return failureOf(e, { code: null, details: [] });
}

function refreshAll(): void {
	void getConfigOverview().refresh();
	void getConfigHistory().refresh();
}

// --- Cards ------------------------------------------------------------------------------------

export const getCardTemplateSettings = query(() => {
	requireUser("admin");
	const config = getConfig();
	const overview = templatesOverview(config, env().CONFIG_DIR);
	return {
		templates: overview.cards
			.filter((t) => t.error === null)
			.map((t) => ({ name: t.name, description: t.description, patronTypes: t.patronTypes })),
		defaultTemplate: config.cards.defaultTemplate,
		byPatronType: config.cards.templateByPatronType,
		cutLines: config.cards.sheet.cutLines,
	};
});

export const saveCardTemplateSettings = command(
	v.object({
		byPatronType: v.record(v.picklist(["student", "teacher"]), templateName),
		cutLines: v.nullable(
			v.object({
				color: v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i)),
				widthMm: v.pipe(v.number(), v.minValue(0.05), v.maxValue(2)),
			}),
		),
	}),
	({ byPatronType, cutLines }) => {
		const user = requireUser("admin");
		try {
			const change = saveConfigKeys(
				getDb(),
				env().CONFIG_DIR,
				"cards",
				{ "cards.templateByPatronType": byPatronType, "cards.sheet.cutLines": cutLines },
				user,
			);
			void getCardTemplateSettings().refresh();
			refreshAll();
			return { ok: true as const, change: change.id };
		} catch (e) {
			return failure(e);
		}
	},
);

// --- Stocks -----------------------------------------------------------------------------------

export const getLabelStocks = query(() => {
	requireUser("admin");
	return { stocks: stockEditorView(getConfig(), env().CONFIG_DIR) };
});

const stock = v.object({
	id: entryId,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	paper: v.literal("A4"),
	labelMm: v.object({ width: v.pipe(mm, v.minValue(1)), height: v.pipe(mm, v.minValue(1)) }),
	columns: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50)),
	rows: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
	marginMm: v.object({ top: mm, left: mm }),
	gapMm: v.object({ x: mm, y: mm }),
	cornerRadiusMm: mm,
});

export const saveLabelStocks = command(
	v.object({
		stocks: v.pipe(
			v.array(v.object({ originalId: v.nullable(entryId), stock })),
			v.minLength(1),
		),
	}),
	({ stocks }) => {
		const user = requireUser("admin");
		try {
			const change = saveStocks(getDb(), env().CONFIG_DIR, stocks, user);
			void getLabelStocks().refresh();
			refreshAll();
			return { ok: true as const, change: change.id };
		} catch (e) {
			return failure(e);
		}
	},
);

// --- Template folders -------------------------------------------------------------------------

export const getTemplateFolders = query(() => {
	requireUser("admin");
	return {
		templates: templateFolders(getConfig(), env().CONFIG_DIR),
		maxAssetMb: megabytes(MAX_ASSET_BYTES, requestLocale()),
	};
});

const done = <T extends { id: string }>(change: T): { ok: true; change: string } => {
	void getTemplateFolders().refresh();
	refreshAll();
	return { ok: true, change: change.id };
};

export const duplicateTemplateFolder = command(
	v.object({ kind, from: templateName, to: v.string() }),
	({ kind: k, from, to }) => {
		const user = requireUser("admin");
		try {
			return done(duplicateTemplate(getDb(), env().CONFIG_DIR, k, from, to, user));
		} catch (e) {
			return failure(e);
		}
	},
);

export const renameTemplateFolder = command(
	v.object({ kind, from: templateName, to: v.string() }),
	({ kind: k, from, to }) => {
		const user = requireUser("admin");
		try {
			return done(renameTemplate(getDb(), env().CONFIG_DIR, k, from, to, user));
		} catch (e) {
			return failure(e);
		}
	},
);

export const deleteTemplateFolder = command(
	v.object({ kind, name: templateName }),
	({ kind: k, name }) => {
		const user = requireUser("admin");
		try {
			return done(deleteTemplate(getDb(), env().CONFIG_DIR, k, name, user));
		} catch (e) {
			return failure(e);
		}
	},
);

export const deleteTemplateAssetFile = command(
	v.object({ kind, name: templateName, file: v.pipe(v.string(), v.maxLength(100)) }),
	({ kind: k, name, file }) => {
		const user = requireUser("admin");
		try {
			return done(deleteTemplateAsset(getDb(), env().CONFIG_DIR, k, name, file, user));
		} catch (e) {
			return failure(e);
		}
	},
);

export const uploadTemplateAssetFile = form(
	v.object({
		kind,
		name: templateName,
		/** The file name, sent apart: Bun's FormData hands over a Blob, which has none. */
		filename: v.pipe(v.string(), v.maxLength(100)),
		asset: uploadedFile,
	}),
	async ({ kind: k, name, filename, asset }, issue) => {
		const user = requireUser("admin");
		const file = filename.trim();
		try {
			done(
				uploadTemplateAsset(
					getDb(),
					env().CONFIG_DIR,
					k,
					name,
					file,
					new Uint8Array(await asset.arrayBuffer()),
					user,
				),
			);
			return { file };
		} catch (e) {
			if (e instanceof TemplateFolderError) {
				invalid(
					issue.asset(
						await tServer(requestLocale(), `config.templates.errors.${e.code}`, {
							name: file,
							maxMb: megabytes(MAX_ASSET_BYTES, requestLocale()),
							details: e.details.join(", "),
						}),
					),
				);
			}
			throw e;
		}
	},
);

// --- Shipped card backgrounds (step 11.17) ------------------------------------------------------

export const getCardBackgrounds = query(() => {
	requireUser("admin");
	return cardBackgrounds();
});

/** Copies a shipped background into the template's `assets/`: the file the face then names. */
export const useCardBackground = command(
	v.object({ name: templateName, background: v.pipe(v.string(), v.regex(BACKGROUND_NAME)) }),
	({ name, background }) => {
		const user = requireUser("admin");
		try {
			const file = addCardBackground(getDb(), env().CONFIG_DIR, name, background, user);
			void getTemplateFolders().refresh();
			refreshAll();
			return { ok: true as const, file };
		} catch (e) {
			return failure(e);
		}
	},
);
