// SPDX-License-Identifier: GPL-3.0-or-later
// Card templates (PLAN.md §3.12, step 2.5): the `template.json` of a card folder, the fields a face
// may use, the template of each patron type, the context of one patron's card and its two faces
// rendered on the template engine. Pure functions over the configuration and the template folders.
import * as v from "valibot";
import { renderBarcodeSvg, type Symbology } from "#lib/server/barcodes/render.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { dataUrl } from "#lib/server/templates/data-url.js";
import {
	listTemplates,
	loadTemplate,
	renderTemplate,
	type LoadedTemplate,
	type TemplateStatus,
} from "#lib/server/templates/engine.js";
import { isoDateIn } from "#lib/shared/dates.js";
import { schoolYearFor, schoolYearLabel } from "#lib/shared/school-year.js";
import { renderCardClass } from "#lib/shared/school.js";
import { printWords, WORD_FIELDS, type WordSource } from "#lib/server/i18n/print-words.js";

export const cardTemplateSchema = v.object({
	name: v.string(),
	description: v.optional(v.string(), ""),
	patronTypes: v.optional(v.array(v.picklist(["student", "teacher"])), ["student", "teacher"]),
	cardMm: v.optional(v.object({ width: v.number(), height: v.number() })),
	bleedMm: v.optional(v.number(), 0),
	barcode: v.optional(
		v.object({
			/** Left out: `barcodes.patron.symbology` of the configuration. */
			symbology: v.optional(v.picklist(["code128", "code39"])),
			widthMm: v.optional(v.number(), 40),
			heightMm: v.optional(v.number(), 7),
			text: v.optional(v.boolean(), false),
		}),
		{},
	),
});
export type CardTemplateMeta = v.InferOutput<typeof cardTemplateSchema>;

/** Fields a card template may use (docs/templates-authoring.md). */
export const CARD_FIELDS = [
	"library.name",
	"school_year",
	"issued_on",
	"valid_until",
	"photo_url",
	"barcode_svg",
	"patron.first_name",
	"patron.last_name",
	"patron.card_number",
	"patron.class_label",
	"patron.class_line",
	"patron.level_label",
	"patron.level_name",
	"patron.group",
	"school.group_word",
	"patron.patron_type",
	"patron.is_student",
	"patron.is_teacher",
	"patron.has_photo",
	...WORD_FIELDS,
];

export const PLACEHOLDER_PHOTO = dataUrl(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><rect width="120" height="160" fill="#e5e7eb"/><circle cx="60" cy="62" r="26" fill="#9ca3af"/><path d="M20 150c4-30 24-46 40-46s36 16 40 46z" fill="#9ca3af"/></svg>',
	"image/svg+xml",
);

export interface CardPatron {
	id: number;
	firstName: string;
	lastName: string;
	cardNumber: string | null;
	patronType: string;
	/** `3 B`, or the teachers group's name (Phase 12). */
	classLabel: string;
	levelLabel: string;
	levelName: string;
	/** The class's (or teachers group's) name: `B`. */
	groupName: string;
	photoPath: string | null;
	status: string;
}

export interface CardContext extends Record<string, unknown> {
	library: { name: string };
	/** `school.groupWord`: the word before the class's name (`Sezione` B). */
	school: { group_word: string };
	/** The fixed words of the shipped templates in the installation's language (9.41). */
	words: Record<string, string>;
	school_year: string;
	issued_on: string;
	valid_until: string;
	photo_url: string;
	barcode_svg: string;
	patron: {
		first_name: string;
		last_name: string;
		card_number: string;
		class_label: string;
		/** The class line of the card (`school.cardClass`, 9.41): `Sezione B`, `1年2組`. */
		class_line: string;
		level_label: string;
		level_name: string;
		group: string;
		patron_type: string;
		is_student: boolean;
		is_teacher: boolean;
		has_photo: boolean;
	};
}

export function buildCardContext(
	p: CardPatron,
	config: AppConfig,
	meta: CardTemplateMeta,
	photoDataUrl: string | null,
	now = new Date(),
	words?: WordSource,
): CardContext {
	const today = isoDateIn(now, config.library.timezone);
	const validUntil = config.cards.validityMonths
		? isoDateIn(
				new Date(now.getTime() + config.cards.validityMonths * 30.4375 * 86_400_000),
				config.library.timezone,
			)
		: "";
	const symbology = (meta.barcode.symbology ?? config.barcodes.patron.symbology) as Symbology;
	const barcode = p.cardNumber
		? renderBarcodeSvg(p.cardNumber, {
				symbology,
				text: meta.barcode.text,
				heightMm: meta.barcode.heightMm,
			})
		: "";
	return {
		library: { name: config.library.name },
		school: { group_word: config.school.groupWord },
		words: printWords(words),
		school_year: schoolYearLabel(
			schoolYearFor(today, config.library.schoolYearStart),
			config.library.schoolYearLabel,
		),
		issued_on: today,
		valid_until: validUntil,
		photo_url: photoDataUrl ?? PLACEHOLDER_PHOTO,
		barcode_svg: barcode,
		patron: {
			first_name: p.firstName,
			last_name: p.lastName,
			card_number: p.cardNumber ?? "",
			class_label: p.classLabel,
			class_line:
				p.patronType === "student" && p.levelLabel
					? renderCardClass(config.school.cardClass, {
							word: config.school.groupWord,
							group: p.groupName,
							level: p.levelLabel,
							class: p.classLabel,
						})
					: p.groupName,
			level_label: p.levelLabel,
			level_name: p.levelName,
			group: p.groupName,
			patron_type: p.patronType,
			is_student: p.patronType === "student",
			is_teacher: p.patronType === "teacher",
			has_photo: photoDataUrl !== null,
		},
	};
}

/** The template configured for a patron type (`cards.templateByPatronType`, else `cards.defaultTemplate`). */
export function templateNameFor(config: AppConfig, patronType: string): string {
	return config.cards.templateByPatronType[patronType] ?? config.cards.defaultTemplate;
}

const CARD_TEMPLATES = { kind: "cards", schema: cardTemplateSchema } as const;

export type LoadedCardTemplate = LoadedTemplate<CardTemplateMeta>;

export function loadCardTemplate(
	name: string,
	configDir: string,
	builtinRoot?: string,
): LoadedCardTemplate {
	return loadTemplate(CARD_TEMPLATES, name, configDir, builtinRoot);
}

/** One entry per discovered card template: its folder, the parsed meta or the error that stops it. */
export type CardTemplateStatus = TemplateStatus<CardTemplateMeta>;

export function listCardTemplates(configDir: string, builtinRoot?: string): CardTemplateStatus[] {
	return listTemplates(CARD_TEMPLATES, configDir, builtinRoot);
}

export interface RenderedCard {
	patronId: number;
	front: string;
	back: string;
	css: string;
	scope: string;
	template: string;
}

export function renderCard(
	template: LoadedCardTemplate,
	context: CardContext,
	patronId: number,
): RenderedCard {
	const rendered = renderTemplate(
		template.folder,
		["front.html", "back.html"],
		context,
		CARD_FIELDS,
	);
	return {
		patronId,
		front: rendered.html["front.html"] ?? "",
		back: rendered.html["back.html"] ?? "",
		css: rendered.css,
		scope: rendered.scope,
		template: template.folder.name,
	};
}
