// SPDX-License-Identifier: GPL-3.0-or-later
// What a label prints about a copy (PLAN.md §3.12, step 3.8, Appendix G): the copy with its record,
// the context of a label template (call number, short author and title, the classification with
// its pictogram and colour, the barcode) and the made-up copies of the previews and samples.
import { renderBarcodeSvg, type Symbology } from "#lib/server/barcodes/render.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import {
	classificationOf,
	classOf,
	splitCallNumber,
	type ClassificationScheme,
	type ResolvedNode,
} from "#lib/shared/classification.js";
import { authorShort, titleShort } from "#lib/shared/short-text.js";
import { catalogRules, suggestedCallNumber } from "./catalog.js";
import { classificationImage, pictogramUrl } from "./classification-media.js";
import type { LabelTemplateMeta } from "./label-templates.js";

export interface LabelItem {
	id: number;
	barcode: string;
	callNumber: string | null;
	itemType: string;
	readingLevel: string | null;
	biblioId: number;
	title: string;
	author: string;
	publicationYear: number | null;
	series?: string | null;
	seriesNumber?: string | null;
	/** Null for a record still to classify: no spine band yet (step 9.21). */
	kind: string | null;
	genreCode: string | null;
	classCode: string | null;
	biblioReadingLevel: string | null;
}

export interface LabelContext extends Record<string, unknown> {
	item: { barcode: string; call_number: string; item_type: string };
	call: { head: string; rest: string };
	biblio: {
		title_short: string;
		author_short: string;
		publication_year: string;
		series: string;
		series_number: string;
	};
	classification: {
		kind: string;
		is_fiction: boolean;
		is_nonfiction: boolean;
		code: string;
		label: string;
		image_url: string;
		color: string;
		reading_level: string;
	};
	library: { name: string };
	labels: { monochrome: boolean };
	barcode_svg: string;
}

/** The data URL of a classification pictogram (file or generated placeholder), cached per code. */
export function pictogramDataUrl(
	scheme: ClassificationScheme,
	configDir: string,
	node: ResolvedNode,
	cache = new Map<string, string>(),
): string {
	const cached = cache.get(node.code);
	if (cached !== undefined) {
		return cached;
	}
	const image = classificationImage(scheme, configDir, node.code);
	const url = pictogramUrl(node, image?.path ? { path: image.path, mime: image.mime } : null);
	cache.set(node.code, url);
	return url;
}

export function buildLabelContext(
	it: LabelItem,
	config: AppConfig,
	configDir: string,
	meta: LabelTemplateMeta,
	pictograms = new Map<string, string>(),
): LabelContext {
	const rules = catalogRules(config);
	const record = {
		kind: it.kind,
		genreCode: it.genreCode,
		classCode: it.classCode,
		readingLevel: it.biblioReadingLevel,
		author: it.author,
		title: it.title,
	};
	const callNumber = it.callNumber ?? suggestedCallNumber(rules, record, it.readingLevel);
	const node = classificationOf(rules.scheme, record);
	const readingLevel = rules.scheme.classPerItem ? it.readingLevel : it.biblioReadingLevel;
	const barcode = renderBarcodeSvg(it.barcode, {
		symbology: (meta.barcode.symbology ?? config.barcodes.item.symbology) as Symbology,
		text: meta.barcode.text,
		heightMm: meta.barcode.heightMm,
	});
	return {
		item: { barcode: it.barcode, call_number: callNumber, item_type: it.itemType },
		call: splitCallNumber(callNumber),
		biblio: {
			title_short: titleShort(it.title, config.labels.titleMaxChars),
			author_short: authorShort(it.author),
			publication_year: it.publicationYear === null ? "" : String(it.publicationYear),
			series: it.series ?? "",
			series_number: it.series ? (it.seriesNumber ?? "") : "",
		},
		classification: {
			kind: it.kind ?? "",
			is_fiction: it.kind === "fiction",
			is_nonfiction: it.kind === "nonfiction",
			code: node?.code ?? "",
			label: node?.label ?? "",
			image_url: node ? pictogramDataUrl(rules.scheme, configDir, node, pictograms) : "",
			color: node?.color ?? "",
			reading_level: readingLevel ?? "",
		},
		library: { name: config.library.name },
		labels: { monochrome: config.labels.monochrome },
		barcode_svg: barcode,
	};
}

/**
 * A made-up copy for previews and sample sheets: nothing here is a real book. `code` picks the
 * genre or class (the first one, or 590, by default); the call number comes from the configured
 * patterns, and the associated class sits where `classPerItem` puts it.
 */
export function sampleLabelItem(
	config: AppConfig,
	which: "fiction" | "nonfiction" = "fiction",
	code?: string,
): LabelItem {
	const scheme = catalogRules(config).scheme;
	if (which === "fiction") {
		const readingLevel = scheme.fictionByClass
			? (scheme.readingLevels[3]?.code ?? scheme.readingLevels[0]?.code ?? null)
			: null;
		return {
			id: 0,
			barcode: "2026-02678",
			callNumber: null,
			itemType: "libro",
			readingLevel: scheme.classPerItem ? readingLevel : null,
			biblioId: 0,
			title: "La casa segreta",
			author: "Delitto, Anna",
			publicationYear: 2024,
			kind: "fiction",
			genreCode: code ?? scheme.genres[0]?.code ?? "B",
			classCode: null,
			biblioReadingLevel: scheme.classPerItem ? null : readingLevel,
		};
	}
	const klass =
		code ??
		(classOf(scheme, "590") ? "590" : null) ??
		scheme.nonfiction[0]?.children?.[0]?.code ??
		scheme.nonfiction[0]?.code ??
		"590";
	return {
		id: 0,
		barcode: "2026-02686",
		callNumber: null,
		itemType: "libro",
		readingLevel: null,
		biblioId: 0,
		title: "Gli animali della fattoria e del bosco",
		author: "Rossi, Anna",
		publicationYear: 2023,
		kind: "nonfiction",
		genreCode: null,
		classCode: klass,
		biblioReadingLevel: null,
	};
}
