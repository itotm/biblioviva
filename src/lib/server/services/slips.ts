// SPDX-License-Identifier: GPL-3.0-or-later
// Slips (PLAN.md §3.12, step 4.6, Appendix H): template folders under `slips/templates/<name>/`
// with `template.json`, `slip.html` and `style.css`, rendered with the shared engine. Three
// built-ins: `overdue-by-class` (the library's "solleciti", one block per group), `overdue-patron`
// (one patron's overdue loans, for the desk) and `checkout-receipt` (the books of one checkout).
// A folder with the same name in CONFIG_DIR replaces a built-in. The built-ins take their fixed
// words from the dictionary (`words.*`, 9.41), so they print in the installation's language.
import { patronFullName } from "#lib/shared/patron-name.js";
import * as v from "valibot";
import type { AppConfig } from "#lib/server/config/schema.js";
import { PRINT_COLOURS, printDocument } from "#lib/server/templates/document.js";
import {
	listTemplates,
	loadTemplate,
	renderTemplate,
	type LoadedTemplate,
	type RenderedTemplate,
	type TemplateStatus,
} from "#lib/server/templates/engine.js";
import { pageSizeMm } from "#lib/shared/paper.js";
import { authorShort } from "#lib/shared/short-text.js";
import { slipDate, type OverdueGroup, type OverdueRow } from "./overdues.js";
import { printWords, WORD_FIELDS, type WordSource } from "#lib/server/i18n/print-words.js";

export const slipTemplateSchema = v.object({
	name: v.string(),
	description: v.optional(v.string(), ""),
	kind: v.picklist(["overdue", "overdue-patron", "receipt"]),
	/** CSS `@page` size: A4 or A5, portrait or landscape. */
	page: v.optional(v.pipe(v.string(), v.regex(/^A[45]( (portrait|landscape))?$/)), "A4 portrait"),
	marginMm: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(40)), 15),
	pageBreakPerGroup: v.optional(v.boolean()),
});

export type SlipTemplateMeta = v.InferOutput<typeof slipTemplateSchema>;
export type SlipKind = SlipTemplateMeta["kind"];

export const SLIP_TEMPLATES = {
	overdue: "overdue-by-class",
	"overdue-patron": "overdue-patron",
	receipt: "checkout-receipt",
} as const satisfies Record<SlipKind, string>;

const ROW_FIELDS = [
	"patron.full_name",
	"patron.first_name",
	"patron.last_name",
	"patron.class_label",
	"biblio.title",
	"biblio.author_short",
	"item.barcode",
	"due_date",
	"days_overdue",
] as const;

/** Field allowlist of every slip (documented in `docs/templates-authoring.md`). */
export const SLIP_FIELDS = [
	"group",
	"group.label",
	"group.kind",
	"date",
	"library.name",
	"rows",
	...ROW_FIELDS,
	...WORD_FIELDS,
];

const SLIP_TEMPLATE_TYPE = { kind: "slips", schema: slipTemplateSchema } as const;

export type LoadedSlipTemplate = LoadedTemplate<SlipTemplateMeta>;

/** A slip template of `kind`; a template of another kind is refused. */
export function loadSlipTemplate(
	name: string,
	configDir: string,
	kind: SlipKind,
	builtinRoot?: string,
): LoadedSlipTemplate {
	return loadTemplate(
		{
			...SLIP_TEMPLATE_TYPE,
			check: (meta) =>
				meta.kind === kind
					? []
					: [`template.json kind: expected "${kind}", got "${meta.kind}"`],
		},
		name,
		configDir,
		builtinRoot,
	);
}

/** One entry per discovered slip template: its folder, the parsed meta or the error that stops it. */
export type SlipTemplateStatus = TemplateStatus<SlipTemplateMeta>;

export function listSlipTemplates(configDir: string, builtinRoot?: string): SlipTemplateStatus[] {
	return listTemplates(SLIP_TEMPLATE_TYPE, configDir, builtinRoot);
}

interface SlipPatron {
	firstName: string;
	lastName: string;
	patronType: string;
	/** The class now (`3 B`, Phase 12); "" for teachers. */
	classLabel: string | null;
}

function patronContext(p: SlipPatron): Record<string, string> {
	return {
		full_name: patronFullName(p),
		first_name: p.firstName,
		last_name: p.lastName,
		class_label: p.patronType !== "teacher" ? (p.classLabel ?? "") : "",
	};
}

function rowContext(r: {
	title: string;
	author: string;
	barcode: string;
	dueDate: string;
	daysOverdue?: number;
	patron?: SlipPatron;
}): Record<string, unknown> {
	return {
		...(r.patron ? { patron: patronContext(r.patron) } : {}),
		biblio: { title: r.title, author_short: authorShort(r.author) },
		item: { barcode: r.barcode },
		due_date: slipDate(r.dueDate),
		days_overdue: r.daysOverdue ?? 0,
	};
}

/**
 * The printable document around the rendered blocks: page size, margins, page breaks. The paper
 * has no printer margin (`@page` margin 0, as cards and labels, so the browser is always set to
 * print without margins): the template's margin is the sheet's padding, repeated on every page
 * a long table runs onto (`box-decoration-break: clone`).
 */
export function slipDocument(
	title: string,
	meta: SlipTemplateMeta,
	blocks: RenderedTemplate[],
	options: { pageBreak?: boolean; lang: string },
): string {
	const { pageBreak = false } = options;
	const { width } = pageSizeMm(meta.page);
	const css = new Map<string, string>();
	for (const b of blocks) {
		css.set(b.scope, b.css);
	}
	const body = blocks
		.map(
			(b) =>
				`<div class="block ${b.scope}${pageBreak ? " page-break" : ""}">${b.html["slip.html"] ?? ""}</div>`,
		)
		.join("\n");
	return printDocument({
		title,
		lang: options.lang,
		styles: [
			`
@page { size: ${meta.page}; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; ${PRINT_COLOURS} }
.sheet { padding: ${meta.marginMm}mm; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.block.page-break { break-after: page; page-break-after: always; }
.block.page-break:last-child { break-after: auto; page-break-after: auto; }
@media screen { body { background: #eee; padding: 8mm 0; } .sheet { width: ${width}mm; box-sizing: border-box; margin: 0 auto; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.2); } }
`,
			[...css.values()].join("\n"),
		],
		body: `<div class="sheet">${body}</div>`,
	});
}

export interface SlipJob {
	html: string;
	/** Loans printed (rows). */
	count: number;
	template: string;
}

/** The overdue notices, one block per group (`overdue-by-class`). */
export function renderOverdueNotices(
	config: AppConfig,
	configDir: string,
	groups: readonly OverdueGroup[],
	options: {
		today: string;
		pageBreak?: boolean;
		template?: string;
		builtinRoot?: string;
		/** The words of the installation's language (Italian when left out). */
		words?: WordSource;
	},
): SlipJob {
	const name = options.template ?? config.circulation.overdueNotice.template;
	const t = loadSlipTemplate(name, configDir, "overdue", options.builtinRoot);
	const date = slipDate(options.today);
	const words = printWords(options.words, date);
	const blocks = groups.map((g) =>
		renderTemplate(
			t.folder,
			["slip.html"],
			{
				group: { label: g.label, kind: g.kind },
				date,
				words,
				library: { name: config.library.name },
				rows: g.rows.map((r) => rowContext({ ...r, patron: r })),
			},
			SLIP_FIELDS,
		),
	);
	const pageBreak =
		options.pageBreak ??
		t.meta.pageBreakPerGroup ??
		config.circulation.overdueNotice.pageBreakPerGroup;
	return {
		html: slipDocument(words.overdues_on, t.meta, blocks, {
			pageBreak,
			lang: config.ui.locale,
		}),
		count: groups.reduce((n, g) => n + g.rows.length, 0),
		template: name,
	};
}

/** One patron's overdue loans for the desk (`overdue-patron`). */
export function renderPatronOverdueSlip(
	config: AppConfig,
	configDir: string,
	patron: SlipPatron,
	rows: readonly OverdueRow[],
	options: { today: string; template?: string; builtinRoot?: string; words?: WordSource },
): SlipJob {
	const name = options.template ?? SLIP_TEMPLATES["overdue-patron"];
	const t = loadSlipTemplate(name, configDir, "overdue-patron", options.builtinRoot);
	const block = renderTemplate(
		t.folder,
		["slip.html"],
		{
			patron: patronContext(patron),
			date: slipDate(options.today),
			words: printWords(options.words, slipDate(options.today)),
			library: { name: config.library.name },
			rows: rows.map((r) => rowContext(r)),
		},
		SLIP_FIELDS,
	);
	return {
		html: slipDocument(patronFullName(patron), t.meta, [block], {
			lang: config.ui.locale,
		}),
		count: rows.length,
		template: name,
	};
}

/** The receipt of one checkout (`checkout-receipt`). */
export function renderReceipt(
	config: AppConfig,
	configDir: string,
	data: {
		patron: SlipPatron;
		rows: readonly { title: string; author: string; barcode: string; dueDate: string }[];
	},
	options: { today: string; template?: string; builtinRoot?: string; words?: WordSource },
): SlipJob {
	const name = options.template ?? SLIP_TEMPLATES.receipt;
	const t = loadSlipTemplate(name, configDir, "receipt", options.builtinRoot);
	const block = renderTemplate(
		t.folder,
		["slip.html"],
		{
			patron: patronContext(data.patron),
			date: slipDate(options.today),
			words: printWords(options.words, slipDate(options.today)),
			library: { name: config.library.name },
			rows: data.rows.map((r) => rowContext(r)),
		},
		SLIP_FIELDS,
	);
	return {
		html: slipDocument(patronFullName(data.patron), t.meta, [block], {
			lang: config.ui.locale,
		}),
		count: data.rows.length,
		template: name,
	};
}

/** Made-up groups for the template preview and the visual snapshot (never real patrons). */
export function sampleOverdueGroups(teacherLabel: string): OverdueGroup[] {
	const row = (
		loanId: number,
		firstName: string,
		lastName: string,
		title: string,
		daysOverdue: number,
		cls: [number, string, string] | null,
	): OverdueRow => ({
		loanId,
		patronId: loanId,
		firstName,
		lastName,
		patronType: cls ? "student" : "teacher",
		groupId: cls ? cls[0] : null,
		groupName: cls?.[2] ?? null,
		levelPosition: cls ? cls[0] : null,
		classLabel: cls?.[1] ?? null,
		title,
		author: "Autore, Esempio",
		barcode: `2026-${String(loanId).padStart(4, "0")}`,
		dueDate: "2026-05-01",
		daysOverdue,
		lastNoticeAt: null,
	});
	return [
		{
			key: "g1",
			kind: "class",
			label: "1 D",
			rows: [
				row(1, "Anna", "Bianchi", "Il piccolo principe", 164, [1, "1 D", "D"]),
				row(2, "Luca", "Esposito", "Pinocchio", 120, [1, "1 D", "D"]),
			],
		},
		{
			key: "g4",
			kind: "class",
			label: "4 D",
			rows: [row(3, "Sara", "Romano", "La fabbrica di cioccolato", 137, [4, "4 D", "D"])],
		},
		{
			key: "teacher",
			kind: "teacher",
			label: teacherLabel,
			rows: [
				row(4, "Maria", "Colombo", "Guida alla didattica", 203, null),
				row(5, "Maria", "Colombo", "Storia dell'arte", 184, null),
			],
		},
	];
}

/** The rows of the first made-up group, for the slips of one patron. */
function sampleRows(groups: readonly OverdueGroup[]): { first: OverdueRow; rows: OverdueRow[] } {
	const rows = groups[0]?.rows ?? [];
	const first = rows[0];
	if (!first) {
		throw new Error("no sample rows");
	}
	return { first, rows };
}

/** What a sample of each kind of slip prints: made-up groups and rows (`sampleOverdueGroups`). */
const SLIP_SAMPLES = {
	overdue: (config, configDir, template, groups, options) =>
		renderOverdueNotices(config, configDir, groups, { ...options, template }),
	"overdue-patron": (config, configDir, template, groups, options) => {
		const { first, rows } = sampleRows(groups);
		return renderPatronOverdueSlip(config, configDir, first, rows, { ...options, template });
	},
	receipt: (config, configDir, template, groups, options) => {
		const { first, rows } = sampleRows(groups);
		return renderReceipt(
			config,
			configDir,
			{
				patron: first,
				rows: rows.map((r) => ({
					title: r.title,
					author: r.author,
					barcode: r.barcode,
					dueDate: r.dueDate,
				})),
			},
			{ ...options, template },
		);
	},
} satisfies Record<
	SlipKind,
	(
		config: AppConfig,
		configDir: string,
		template: string,
		groups: readonly OverdueGroup[],
		options: { today: string; builtinRoot?: string; words?: WordSource },
	) => SlipJob
>;

/** A slip template printed with made-up rows, as its kind prints them (the template editor). */
export function renderSlipSample(
	config: AppConfig,
	configDir: string,
	name: string,
	options: { today: string; teacherLabel: string; builtinRoot?: string; words?: WordSource },
): SlipJob {
	const { kind } = loadTemplate(SLIP_TEMPLATE_TYPE, name, configDir, options.builtinRoot).meta;
	return SLIP_SAMPLES[kind](config, configDir, name, sampleOverdueGroups(options.teacherLabel), {
		today: options.today,
		builtinRoot: options.builtinRoot,
		words: options.words,
	});
}
