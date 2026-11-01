// SPDX-License-Identifier: GPL-3.0-or-later
// Classification editor (step 11.1): the taxonomy as a draft, the plan of a save (what it does to
// the catalogue), the save, the spine band preview and the pictogram uploads. Permission `admin`.
import { command, form, query } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { megabytes } from "#lib/shared/bytes.js";
import { uploadedFile } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { serverContext } from "#lib/server/context.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { refusal, refusing } from "#lib/server/http/errors.js";
import { configRefused, failureOf, failureWith } from "#lib/server/services/config-commit.js";
import { sectionFile } from "#lib/server/services/config-edit.js";
import { LabelGeometryError, StockNotFoundError } from "#lib/server/services/labels.js";
import { MediaError } from "#lib/server/services/media.js";
import {
	DRAFT_IMAGE,
	orphanCodes,
	planTaxonomy,
	previewTaxonomyBand,
	saveTaxonomy,
	TAXONOMY_KINDS,
	taxonomyOf,
	taxonomyUsage,
	TaxonomyNodeNotFoundError,
	TaxonomyNotReadyError,
} from "#lib/server/services/taxonomy.js";
import {
	listPictogramFiles,
	PICTOGRAM_MAX_BYTES,
	stagePictogram,
} from "#lib/server/services/taxonomy-pictograms.js";
import { TemplateError } from "#lib/server/templates/engine.js";

const text = (
	max: number,
): v.SchemaWithPipe<
	readonly [v.StringSchema<undefined>, v.MaxLengthAction<string, number, undefined>]
> => v.pipe(v.string(), v.maxLength(max));
const leaf = v.object({
	code: text(64),
	label: text(200),
	image: v.nullable(text(200)),
	color: v.nullable(text(16)),
});
const draftSchema = v.object({
	fictionByClass: v.boolean(),
	readingLevels: v.pipe(
		v.array(
			v.object({
				code: v.pipe(v.string(), v.maxLength(32)),
				label: v.pipe(v.string(), v.maxLength(200)),
			}),
		),
		v.maxLength(100),
	),
	classPerItem: v.boolean(),
	genres: v.pipe(v.array(leaf), v.maxLength(500)),
	nonfiction: v.pipe(
		v.array(v.object({ ...leaf.entries, children: v.pipe(v.array(leaf), v.maxLength(500)) })),
		v.maxLength(500),
	),
	deweyMap: v.pipe(v.array(v.object({ prefix: text(8), code: text(64) })), v.maxLength(2000)),
	callNumber: v.object({
		fiction: text(200),
		fictionWithClass: text(200),
		nonfiction: text(200),
	}),
});
const replacementsSchema = v.pipe(
	v.record(text(64), text(64)),
	v.check((r) => Object.keys(r).length <= 1000, "too many replacements"),
);

/** The saved taxonomy, how much of the catalogue uses each code, and the pictogram files. */
export const getTaxonomyEditor = query(() => {
	requireUser("admin");
	const config = getConfig();
	const draft = taxonomyOf(config);
	const usage = taxonomyUsage(getDb());
	return {
		draft,
		usage,
		orphans: orphanCodes(usage, draft),
		images: listPictogramFiles(env().CONFIG_DIR),
		file: sectionFile(env().CONFIG_DIR, "classification"),
	};
});

/** What saving the draft would do (nothing is written). */
export const planTaxonomyChange = command(
	v.object({ draft: draftSchema, replacements: replacementsSchema }),
	({ draft, replacements }) => {
		requireUser("admin");
		return planTaxonomy(serverContext(), draft, replacements);
	},
);

export const saveTaxonomyChange = command(
	v.object({
		draft: draftSchema,
		replacements: replacementsSchema,
		reprintRestyled: v.boolean(),
	}),
	({ draft, replacements, reprintRestyled }) => {
		const user = requireUser("admin");
		return refusing(() => {
			const result = saveTaxonomy(
				serverContext(),
				draft,
				{ replacements, reprintRestyled },
				user,
			);
			return { ok: true as const, ...result };
		}, [
			// the dialog planned the save: what still blocks it are the plan's errors
			refusal(TaxonomyNotReadyError, (e) => failureWith({}, e.plan.issues)),
			refusal(configRefused(), (e) => failureOf(e)),
		]);
	},
);

/** The spine band of a sample book filed under one genre or class of the draft. */
export const previewTaxonomyBandOf = command(
	v.object({
		draft: draftSchema,
		kind: v.picklist(TAXONOMY_KINDS),
		code: text(64),
		zoom: v.optional(v.picklist([1, 2]), 1),
	}),
	({ draft, kind, code, zoom }) => {
		requireUser("admin");
		return refusing(
			() => ({
				ok: true as const,
				...previewTaxonomyBand(serverContext(), draft, { kind, code }, zoom),
			}),
			[
				refusal(TemplateError, (e) => ({ ok: false as const, problems: e.problems })),
				refusal(
					[LabelGeometryError, StockNotFoundError, TaxonomyNodeNotFoundError],
					(e) => ({
						ok: false as const,
						problems: [e.message],
					}),
				),
			],
		);
	},
);

/** A pictogram for the draft: PNG, JPEG or WebP, kept aside until the taxonomy is saved. */
export const uploadPictogram = form(
	v.object({
		image: uploadedFile,
	}),
	async ({ image }, issue) => {
		requireUser("admin");
		try {
			const token = await stagePictogram(
				env().DATA_DIR,
				new Uint8Array(await image.arrayBuffer()),
			);
			return { image: `${DRAFT_IMAGE}${token}` };
		} catch (e) {
			if (e instanceof MediaError) {
				invalid(
					issue.image(
						await tServer(
							requestLocale(),
							`config.taxonomy.pictogram.errors.${e.code}`,
							{
								maxMb: megabytes(PICTOGRAM_MAX_BYTES, requestLocale()),
							},
						),
					),
				);
			}
			throw e;
		}
	},
);
