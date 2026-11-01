// SPDX-License-Identifier: GPL-3.0-or-later
// The template previews (step 2.5b, "Template di stampa: Anteprime"): overview of the template
// folders and previews of cards and labels. Permission `admin`, as the page: with the templates'
// editor they form one area of the configuration.
import { printWordSource } from "#lib/server/i18n/print-word-source.js";
import { query } from "$app/server";
import * as v from "valibot";
import { entryId } from "#lib/shared/input-schemas.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { refusal, refusing } from "#lib/server/http/errors.js";
import { getConfig } from "#lib/server/config/index.js";
import { serverContext } from "#lib/server/context.js";
import { env } from "#lib/server/env.js";
import { renderCardPreview } from "#lib/server/services/card-preview.js";
import { templatesOverview } from "#lib/server/services/print-preview.js";
import { TemplateError } from "#lib/server/templates/engine.js";
import {
	LabelGeometryError,
	renderLabelPreview,
	StockNotFoundError,
} from "#lib/server/services/labels.js";

const templateName = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9_-]*$/i));

/** A template that does not render: its problems, as the preview shows them. */
function templateProblems(e: TemplateError): { ok: false; problems: TemplateError["problems"] } {
	return { ok: false, problems: e.problems };
}

export const getTemplatesOverview = query(() => {
	requireUser("admin");
	return templatesOverview(getConfig(), env().CONFIG_DIR);
});

export const previewCardTemplate = query(
	v.object({
		template: templateName,
		patronId: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))), null),
		zoom: v.optional(v.picklist([1, 2]), 1),
	}),
	async ({ template, patronId, zoom }) => {
		requireUser("admin");
		const ctx = serverContext();
		const words = await printWordSource(ctx.config.ui.locale);
		return refusing(
			() => ({
				ok: true as const,
				...renderCardPreview(ctx, template, { patronId, zoom, words }),
			}),
			TemplateError,
			templateProblems,
		);
	},
);

/** One sample unit of a label template on a stock, as a standalone document (step 3.8). */
export const previewLabelTemplate = query(
	v.object({
		template: templateName,
		stock: v.optional(entryId),
		zoom: v.optional(v.picklist([1, 2]), 1),
		sample: v.optional(v.picklist(["fiction", "nonfiction"]), "fiction"),
	}),
	({ template, stock, zoom, sample }) => {
		requireUser("admin");
		return refusing(
			() => ({
				ok: true as const,
				...renderLabelPreview(getConfig(), env().CONFIG_DIR, template, {
					stockId: stock,
					zoom,
					sample,
				}),
			}),
			[
				refusal(TemplateError, templateProblems),
				refusal([LabelGeometryError, StockNotFoundError], (e) => ({
					ok: false as const,
					problems: [e.message],
				})),
			],
		);
	},
);
