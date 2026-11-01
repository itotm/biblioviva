// SPDX-License-Identifier: GPL-3.0-or-later
// Label templates (PLAN.md §3.12, step 3.8, Q56): the kinds of label, the `template.json` of a label
// folder (the unit of stacked cells, the variants chosen by the cell height, the barcode), the fields
// a cell may use and the loading of a template with the checks of its unit.
import * as v from "valibot";
import {
	listTemplates,
	loadTemplate,
	type LoadedTemplate,
	type TemplateStatus,
} from "#lib/server/templates/engine.js";

export const LABEL_KINDS = ["pair", "barcode", "spine"] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

const fileName = v.pipe(v.string(), v.regex(/^[\w.-]+\.html$/));

export const labelTemplateSchema = v.object({
	name: v.string(),
	description: v.optional(v.string(), ""),
	kind: v.picklist(LABEL_KINDS),
	unit: v.optional(
		v.object({
			cells: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)), 1),
			stack: v.optional(v.picklist(["vertical"]), "vertical"),
			/** One HTML file per cell, top to bottom; defaults: `label.html` or `top.html` + `bottom.html`. */
			files: v.optional(v.array(fileName)),
		}),
		{},
	),
	/** Stock ids the author designed the template for (informational; the first is the preview default). */
	stocks: v.optional(v.array(v.string()), []),
	/** Layouts chosen by the cell height (Q56); a variant without `files` keeps the unit's files. */
	variants: v.optional(
		v.record(
			v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*$/)),
			v.object({
				minCellHeightMm: v.optional(v.number()),
				maxCellHeightMm: v.optional(v.number()),
				files: v.optional(v.array(fileName)),
			}),
		),
		{},
	),
	barcode: v.optional(
		v.object({
			/** Left out: `barcodes.item.symbology` of the configuration. */
			symbology: v.optional(v.picklist(["code128", "code39"])),
			widthMm: v.optional(v.number(), 50),
			heightMm: v.optional(v.number(), 15),
			text: v.optional(v.boolean(), false),
		}),
		{},
	),
});
export type LabelTemplateMeta = v.InferOutput<typeof labelTemplateSchema>;

/** Fields a label template may use (docs/templates-authoring.md). */
export const LABEL_FIELDS = [
	"item.barcode",
	"item.call_number",
	"item.item_type",
	"call.head",
	"call.rest",
	"biblio.title_short",
	"biblio.author_short",
	"biblio.publication_year",
	"biblio.series",
	"biblio.series_number",
	"classification.kind",
	"classification.is_fiction",
	"classification.is_nonfiction",
	"classification.code",
	"classification.label",
	"classification.image_url",
	"classification.color",
	"classification.reading_level",
	"library.name",
	"labels.monochrome",
	"barcode_svg",
] as const;

/** The files of a unit: the declared ones or the convention by cell count. */
export function unitFiles(meta: LabelTemplateMeta): string[] {
	if (meta.unit.files && meta.unit.files.length > 0) {
		return meta.unit.files;
	}
	return meta.unit.cells === 1
		? ["label.html"]
		: Array.from({ length: meta.unit.cells }, (_, i) =>
				meta.unit.cells === 2
					? i === 0
						? "top.html"
						: "bottom.html"
					: `cell-${i + 1}.html`,
			);
}

/**
 * The variant that fits a cell height (first declared match wins) and the files to render:
 * a variant's own files, else the unit's. `null` variant when none matches.
 */
export function variantFor(
	meta: LabelTemplateMeta,
	cellHeightMm: number,
): { variant: string | null; files: string[] } {
	for (const [name, rule] of Object.entries(meta.variants)) {
		const min = rule.minCellHeightMm ?? -Infinity;
		const max = rule.maxCellHeightMm ?? Infinity;
		if (cellHeightMm >= min && cellHeightMm <= max) {
			return { variant: name, files: rule.files ?? unitFiles(meta) };
		}
	}
	return { variant: null, files: unitFiles(meta) };
}

/** The cells of every layout match the unit (one file per cell). */
function unitProblems(meta: LabelTemplateMeta): string[] {
	const problems: string[] = [];
	if (unitFiles(meta).length !== meta.unit.cells) {
		problems.push(`unit.files must list ${meta.unit.cells} file(s), one per cell`);
	}
	for (const [name, rule] of Object.entries(meta.variants)) {
		if (rule.files && rule.files.length !== meta.unit.cells) {
			problems.push(`variants.${name}.files must list ${meta.unit.cells} file(s)`);
		}
	}
	return problems;
}

const LABEL_TEMPLATES = {
	kind: "labels",
	schema: labelTemplateSchema,
	check: unitProblems,
} as const;

export type LoadedLabelTemplate = LoadedTemplate<LabelTemplateMeta>;

export function loadLabelTemplate(
	name: string,
	configDir: string,
	builtinRoot?: string,
): LoadedLabelTemplate {
	return loadTemplate(LABEL_TEMPLATES, name, configDir, builtinRoot);
}

export type LabelTemplateStatus = TemplateStatus<LabelTemplateMeta>;

export function listLabelTemplates(configDir: string, builtinRoot?: string): LabelTemplateStatus[] {
	return listTemplates(LABEL_TEMPLATES, configDir, builtinRoot);
}
